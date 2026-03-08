#!/usr/bin/env node
'use strict';

/**
 * SYNAPSE Hook Entry Point — UserPromptSubmit
 *
 * Thin wrapper that reads JSON from stdin, delegates to SynapseEngine,
 * and writes <synapse-rules> context to stdout.
 *
 * - Silent exit on missing .synapse/ directory
 * - Silent exit on any error (never blocks the user prompt)
 * - 5s safety timeout as defense-in-depth
 *
 * @module synapse-engine-hook
 */

const path = require('path');
const { resolveHookRuntime, buildHookOutput, hookLog } = require(
  path.join(__dirname, '..', '..', '.aios-core', 'core', 'synapse', 'runtime', 'hook-runtime.js'),
);

/** Safety timeout (ms) — defense-in-depth; Claude Code also manages hook timeout. */
const HOOK_TIMEOUT_MS = 5000;

/**
 * Read all data from stdin as a JSON object.
 * @returns {Promise<object>} Parsed JSON input
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('error', (e) => reject(e));
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
  });
}

/** Main hook execution pipeline. */
async function main() {
  const input = await readStdin();
  const runtime = resolveHookRuntime(input);
  if (!runtime) return;

  const result = await runtime.engine.process(input.prompt, runtime.session);

  // Persist bracket transitions after each prompt
  if (runtime.sessionId && runtime.sessionsDir) {
    try {
      const { updateSession } = require(
        path.join(runtime.cwd, '.aios-core', 'core', 'synapse', 'session', 'session-manager.js'),
      );
      updateSession(runtime.sessionId, runtime.sessionsDir, {
        context: { last_bracket: result.bracket || 'FRESH' },
      });
    } catch (_err) {
      // Fire-and-forget — never block the prompt
    }
  }

  const output = JSON.stringify(buildHookOutput(result.xml));
  hookLog(runtime.cwd, 'INFO', `Hook output: ${result.metrics?.total_rules || 0} rules, bracket=${result.bracket}, xml=${output.length} bytes`);

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
        hookLog(cwd, 'ERROR', `Hook crashed: ${err.message}`);
      } catch (_) {}
    });
}

if (require.main === module) run();

module.exports = { readStdin, main, run, HOOK_TIMEOUT_MS };
