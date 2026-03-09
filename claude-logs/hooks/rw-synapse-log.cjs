#!/usr/bin/env node
'use strict';

/**
 * RIAWORKS Synapse Hook Wrapper — UserPromptSubmit
 *
 * Wraps the AIOX synapse-engine pipeline and adds RIAWORKS logging.
 * The original AIOX hook lives at .claude/hooks/synapse-engine.cjs (untouched).
 *
 * This wrapper:
 * 1. Reads stdin via RIAWORKS lib (Windows-safe)
 * 2. Delegates to AIOX resolveHookRuntime + SynapseEngine
 * 3. Logs injection details via RIAWORKS hook-logger
 * 4. Writes output to stdout for Claude Code
 *
 * Logging: RW_HOOK_LOG=1 (summary) or RW_HOOK_LOG=2 (verbose with XML)
 * Output:  .logs/rw-hooks.log (unified)
 *
 * @module riaworks/rw-synapse-log
 * @see .claude/hooks/synapse-engine.cjs (AIOX original)
 */

const path = require('path');

// ── RIAWORKS lib (zero AIOX dependency) ─────────────────
const { readStdin } = require('./lib/rw-read-stdin');
const logger = require('./lib/rw-hook-logger');

// ── AIOX core paths (resolved from project root) ────────
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const AIOX_HOOK_RUNTIME = path.join(PROJECT_ROOT, '.aiox-core', 'core', 'synapse', 'runtime', 'hook-runtime.js');
const AIOX_SESSION_MGR = path.join(PROJECT_ROOT, '.aiox-core', 'core', 'synapse', 'session', 'session-manager.js');

/** Safety timeout (ms) — defense-in-depth; Claude Code also manages hook timeout. */
const HOOK_TIMEOUT_MS = 5000;

/** Main hook execution pipeline. */
async function main() {
  const input = await readStdin();

  // ── AIOX: resolve runtime ──
  const { resolveHookRuntime, buildHookOutput } = require(AIOX_HOOK_RUNTIME);
  const runtime = resolveHookRuntime(input);
  if (!runtime) return;

  // ── Init RIAWORKS logger ──
  logger.init(runtime.cwd);

  // ── AIOX: execute Synapse pipeline ──
  const result = await runtime.engine.process(input.prompt, runtime.session);

  // ── AIOX: persist bracket transition ──
  if (runtime.sessionId && runtime.sessionsDir) {
    try {
      const { updateSession } = require(AIOX_SESSION_MGR);
      updateSession(runtime.sessionId, runtime.sessionsDir, {
        context: { last_bracket: result.bracket || 'FRESH' },
      });
    } catch (_) { /* fire-and-forget */ }
  }

  // ── Build output ──
  const hookOutput = buildHookOutput(result.xml);
  const output = JSON.stringify(hookOutput);

  // ── RIAWORKS: Log (single entry — no duplication) ──
  logger.logSynapse(runtime.cwd, {
    prompt: input.prompt,
    sessionId: runtime.sessionId,
    bracket: result.bracket,
    rules: result.metrics?.total_rules || 0,
    xmlSize: (result.xml || '').length,
    xml: result.xml,
  });
  logger.logEngineMetrics(result.metrics);

  // ── Write to stdout ──
  const flushed = process.stdout.write(output);
  if (!flushed) {
    await new Promise((resolve) => process.stdout.once('drain', resolve));
  }
}

// No process.exit() — let Node exit naturally after stdout flushes.
// process.exit() on Windows kills the pipe before Claude Code reads it.
function run() {
  const timer = setTimeout(() => {}, HOOK_TIMEOUT_MS);
  timer.unref();
  main()
    .then(() => {})
    .catch((err) => {
      try {
        const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        logger.init(cwd);
        logger.logOp('ERROR', `rw-synapse-log crashed: ${err.message}`);
      } catch (_) {}
    });
}

if (require.main === module) run();

module.exports = { main, run, HOOK_TIMEOUT_MS };
