#!/usr/bin/env node
'use strict';

/**
 * RIAWORKS Synapse Hook Wrapper — UserPromptSubmit
 *
 * Executes the AIOX synapse-engine.cjs as a SUBPROCESS and captures its output.
 * Zero hard-dependency on AIOX internal modules.
 *
 * Architecture:
 *   Claude Code stdin → this wrapper → subprocess(synapse-engine.cjs) → capture stdout
 *     → log via rw-hook-logger → forward stdout to Claude Code
 *
 * Logging: RW_HOOK_LOG=1 (summary) or RW_HOOK_LOG=2 (verbose with XML)
 * Output:  .logs/rw-hooks.log (unified)
 *
 * @module riaworks/rw-synapse-log
 * @see .claude/hooks/synapse-engine.cjs (AIOX original — executed as subprocess)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── RIAWORKS lib (zero AIOX dependency) ─────────────────
const logger = require('./lib/rw-hook-logger');

// ── Paths ───────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const AIOX_SYNAPSE_ENGINE = path.join(PROJECT_ROOT, '.claude', 'hooks', 'synapse-engine.cjs');

/** Subprocess timeout (ms). */
const SUBPROCESS_TIMEOUT_MS = 8000;

/** Safety timeout for this wrapper (ms). */
const HOOK_TIMEOUT_MS = 10000;

/**
 * Read all stdin synchronously (same pattern as synapse-wrapper.cjs).
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
 * Extract prompt from stdin JSON (best-effort, tolerant of parse errors).
 * @param {string} raw
 * @returns {{ prompt: string, sessionId: string, cwd: string }}
 */
function parseStdinInfo(raw) {
  try {
    const obj = JSON.parse(raw);
    return {
      prompt: obj.prompt || '',
      sessionId: obj.session_id || '',
      cwd: obj.cwd || PROJECT_ROOT,
    };
  } catch (_) {
    // Fallback: try with Windows backslash sanitization
    try {
      const sanitized = raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      const obj = JSON.parse(sanitized);
      return {
        prompt: obj.prompt || '',
        sessionId: obj.session_id || '',
        cwd: obj.cwd || PROJECT_ROOT,
      };
    } catch (_2) {
      return { prompt: '', sessionId: '', cwd: PROJECT_ROOT };
    }
  }
}

/**
 * Parse AIOX hook output JSON to extract metrics for logging.
 * @param {string} raw - Raw stdout from subprocess
 * @returns {{ xml: string, hookEventName: string } | null}
 */
function parseAioxOutput(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const hso = obj.hookSpecificOutput || {};
    return {
      xml: hso.additionalContext || '',
      hookEventName: hso.hookEventName || 'UserPromptSubmit',
    };
  } catch (_) {
    return null;
  }
}

/**
 * Extract engine metrics from .synapse/metrics/hook-metrics.json.
 * The AIOX engine persists metrics to disk after each prompt.
 * @param {string} cwd
 * @returns {object|null}
 */
function readEngineMetrics(cwd) {
  try {
    const metricsPath = path.join(cwd, '.synapse', 'metrics', 'hook-metrics.json');
    const raw = fs.readFileSync(metricsPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Count synapse rules from XML content.
 * @param {string} xml
 * @returns {number}
 */
function countRules(xml) {
  if (!xml) return 0;
  const match = xml.match(/MUST:|SHOULD:|NON-NEGOTIABLE/g);
  return match ? match.length : 0;
}

/** Main execution. */
function main() {
  const stdinData = readStdinSync();
  if (!stdinData) return;

  const info = parseStdinInfo(stdinData);
  logger.init(info.cwd);

  // ── Execute AIOX hook as subprocess ──
  let aioxStdout = '';
  let subprocessError = null;

  try {
    const result = execFileSync(process.execPath, [AIOX_SYNAPSE_ENGINE], {
      input: stdinData,
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    aioxStdout = result.toString('utf8');
  } catch (err) {
    subprocessError = err;
    // If subprocess crashed but produced stdout, still use it
    if (err.stdout && err.stdout.length > 0) {
      aioxStdout = err.stdout.toString('utf8');
    }
  }

  // ── Parse AIOX output ──
  const parsed = parseAioxOutput(aioxStdout);

  // ── Read engine metrics (persisted by AIOX to disk) ──
  const metrics = readEngineMetrics(info.cwd);

  // ── RIAWORKS: Log ──
  if (parsed) {
    logger.logSynapse(info.cwd, {
      prompt: info.prompt,
      sessionId: info.sessionId,
      bracket: metrics?.context_bracket || '?',
      rules: countRules(parsed.xml),
      xmlSize: (parsed.xml || '').length,
      xml: parsed.xml,
    });
  } else {
    // AIOX produced no output or crashed
    logger.logSynapse(info.cwd, {
      prompt: info.prompt,
      sessionId: info.sessionId,
      bracket: '?',
      rules: 0,
      xmlSize: 0,
      xml: '',
    });
    if (subprocessError) {
      logger.logOp('WARN', `AIOX synapse subprocess error: ${subprocessError.message}`);
    }
  }

  // ── Log AIOX-RUNTIME metrics ──
  if (metrics) {
    logger.logEngineMetrics(metrics);
    // Log AIOX-RUNTIME event (new in v2)
    logger.logAioxRuntime(info.cwd, metrics);
  }

  // ── Forward AIOX output to Claude Code ──
  if (aioxStdout) {
    process.stdout.write(aioxStdout);
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
      logger.logOp('ERROR', `rw-synapse-log crashed: ${err.message}`);
    } catch (_) {}
  }
}

if (require.main === module) run();

module.exports = { main, run, HOOK_TIMEOUT_MS, SUBPROCESS_TIMEOUT_MS };
