#!/usr/bin/env node
'use strict';

/**
 * RIAWORKS Code-Intel PreToolUse Hook Wrapper
 *
 * - Write/Edit: executes AIOX code-intel-pretool.cjs as SUBPROCESS
 * - Skill: logs agent activation directly (no AIOX subprocess needed)
 * - Silent exit on any error (never blocks the tool call)
 *
 * Zero hard-dependency on AIOX internal modules.
 *
 * Architecture:
 *   Claude Code stdin → this wrapper
 *     → if Skill: log only (no subprocess)
 *     → if Write/Edit: subprocess(code-intel-pretool.cjs) → capture stdout
 *       → log via rw-hook-logger → forward stdout to Claude Code
 *
 * Logging: RW_HOOK_LOG=1 (summary) or RW_HOOK_LOG=2 (verbose with XML)
 * Output:  .logs/rw-hooks.log (unified)
 *
 * @module riaworks/rw-pretool-log
 * @see .claude/hooks/code-intel-pretool.cjs (AIOX — executed as subprocess)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── RIAWORKS lib (zero AIOX dependency) ─────────────────
const logger = require('./lib/rw-hook-logger');

// ── Paths ───────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const AIOX_CODE_INTEL_HOOK = path.join(PROJECT_ROOT, '.claude', 'hooks', 'code-intel-pretool.cjs');

/** Tools that trigger code-intel subprocess. */
const TARGET_TOOLS = new Set(['Write', 'Edit']);

/** Subprocess timeout (ms). */
const SUBPROCESS_TIMEOUT_MS = 5000;

/** Safety timeout for this wrapper (ms). */
const HOOK_TIMEOUT_MS = 7000;

/**
 * Read all stdin synchronously.
 * @returns {string}
 */
function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

/**
 * Parse stdin JSON (tolerant of Windows backslash issues).
 * @param {string} raw
 * @returns {object|null}
 */
function parseStdin(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    try {
      return JSON.parse(raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
    } catch (_2) {
      return null;
    }
  }
}

/**
 * Parse AIOX code-intel output for logging.
 * @param {string} raw
 * @returns {{ xml: string } | null}
 */
function parseAioxOutput(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const hso = obj.hookSpecificOutput || {};
    return { xml: hso.additionalContext || '' };
  } catch (_) {
    return null;
  }
}

// ── Handlers ───────────────────────────────────────────

/**
 * Handle Skill activation — log only, no AIOX subprocess.
 * @param {string} cwd
 * @param {object} input
 */
function handleSkill(cwd, input) {
  const skillName = input.tool_input && input.tool_input.skill;
  if (!skillName) return;

  let resolvedPath = skillName;
  let contentSize = 0;

  const agentMatch = skillName.match(/^AIOX:agents:(.+)$/);
  if (agentMatch) {
    const agentFile = path.join(cwd, '.aiox-core', 'development', 'agents', `${agentMatch[1]}.md`);
    try {
      const st = fs.statSync(agentFile);
      resolvedPath = `.aiox-core/development/agents/${agentMatch[1]}.md`;
      contentSize = st.size;
    } catch (_) { /* built-in skill */ }
  }

  logger.logSkill(cwd, { skillName, resolvedPath, contentSize });
}

/**
 * Handle Write/Edit — execute AIOX code-intel hook as subprocess.
 * @param {string} cwd
 * @param {object} input
 * @param {string} stdinData - Raw stdin to pass to subprocess
 */
function handleWriteEdit(cwd, input, stdinData) {
  const toolName = input.tool_name;
  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) return;

  // ── Execute AIOX code-intel hook as subprocess ──
  let aioxStdout = '';

  try {
    const result = execFileSync(process.execPath, [AIOX_CODE_INTEL_HOOK], {
      input: stdinData,
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 512 * 1024,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    aioxStdout = result.toString('utf8');
  } catch (err) {
    // If subprocess crashed but produced stdout, still use it
    if (err.stdout && err.stdout.length > 0) {
      aioxStdout = err.stdout.toString('utf8');
    }
  }

  // ── Parse and log ──
  const parsed = parseAioxOutput(aioxStdout);

  if (parsed && parsed.xml) {
    logger.logCodeIntel(cwd, { toolName, filePath, xml: parsed.xml });
  } else {
    logger.logCodeIntelSkip(cwd, { toolName, filePath });
  }

  // ── Forward AIOX output to Claude Code ──
  if (aioxStdout) {
    process.stdout.write(aioxStdout);
  }
}

// ── Main ───────────────────────────────────────────────

function main() {
  const stdinData = readStdinSync();
  if (!stdinData) return;

  const input = parseStdin(stdinData);
  if (!input) return;

  const toolName = input.tool_name;
  if (!toolName) return;

  const cwd = input.cwd || PROJECT_ROOT;
  logger.init(cwd);

  if (toolName === 'Skill') {
    handleSkill(cwd, input);
    return;
  }

  if (TARGET_TOOLS.has(toolName)) {
    handleWriteEdit(cwd, input, stdinData);
  }
}

// No process.exit() — let Node exit naturally.
function run() {
  const timer = setTimeout(() => {}, HOOK_TIMEOUT_MS);
  timer.unref();
  try {
    main();
  } catch (err) {
    try {
      const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
      logger.init(cwd);
      logger.logOp('ERROR', `rw-pretool-log crashed: ${err.message}`);
    } catch (_) {}
  }
}

if (require.main === module) run();

module.exports = { main, run, HOOK_TIMEOUT_MS, TARGET_TOOLS, SUBPROCESS_TIMEOUT_MS };
