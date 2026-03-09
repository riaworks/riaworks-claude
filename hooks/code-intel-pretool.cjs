#!/usr/bin/env node
'use strict';

/**
 * Code-Intel PreToolUse Hook
 *
 * - Write/Edit: injects code-intel context from entity registry
 * - Skill: logs agent activation (no injection)
 * - Silent exit on any error (never blocks the tool call)
 *
 * Logging: RW_HOOK_LOG=1 (summary) or RW_HOOK_LOG=2 (verbose with XML)
 * Output:  .logs/rw-hooks.log (unified)
 *
 * @module code-intel-pretool-hook
 */

const path = require('path');
const fs = require('fs');

// ── Local lib (zero AIOX dependency) ───────────────────
const { readStdin } = require('./lib/read-stdin');
const logger = require('./lib/hook-logger');

// ── AIOX core path (resolved lazily) ───────────────────
const AIOX_CODE_INTEL = path.join(__dirname, '..', '..', '.aiox-core', 'core', 'code-intel', 'hook-runtime.js');

/** Tools that trigger code-intel injection. */
const TARGET_TOOLS = new Set(['Write', 'Edit']);

/** Safety timeout (ms) — defense-in-depth. */
const HOOK_TIMEOUT_MS = 4000;

// ── Handlers ───────────────────────────────────────────

/**
 * Handle Skill activation — log only, no injection.
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
    } catch (_) { /* file not found — built-in skill */ }
  }

  logger.logSkill(cwd, { skillName, resolvedPath, contentSize });
}

/**
 * Handle Write/Edit — inject code-intel context.
 * @param {string} cwd
 * @param {object} input
 */
async function handleWriteEdit(cwd, input) {
  const toolName = input.tool_name;
  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) return;

  // ── AIOX: resolve code-intel (lazy load) ──
  const { resolveCodeIntel, formatAsXml } = require(AIOX_CODE_INTEL);

  const intel = await resolveCodeIntel(filePath, cwd);
  const xml = formatAsXml(intel, filePath);
  if (!xml) return;

  // Log (single entry)
  logger.logCodeIntel(cwd, { toolName, filePath, xml });

  // Output for Claude Code
  const output = JSON.stringify({
    hookSpecificOutput: { additionalContext: xml },
  });

  const flushed = process.stdout.write(output);
  if (!flushed) {
    await new Promise((resolve) => process.stdout.once('drain', resolve));
  }
}

// ── Main ───────────────────────────────────────────────

async function main() {
  const input = await readStdin();
  const toolName = input && input.tool_name;
  if (!toolName) return;

  const cwd = input.cwd || process.cwd();
  logger.init(cwd);

  if (toolName === 'Skill') {
    handleSkill(cwd, input);
    return;
  }

  if (TARGET_TOOLS.has(toolName)) {
    await handleWriteEdit(cwd, input);
  }
}

// No process.exit() — let Node exit naturally after stdout flushes.
function run() {
  const timer = setTimeout(() => {}, HOOK_TIMEOUT_MS);
  timer.unref();
  main()
    .then(() => {})
    .catch((err) => {
      try {
        const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        logger.init(cwd);
        logger.logOp('ERROR', `code-intel crashed: ${err.message}`);
      } catch (_) {}
    });
}

if (require.main === module) run();

module.exports = { main, run, HOOK_TIMEOUT_MS, TARGET_TOOLS };
