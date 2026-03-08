#!/usr/bin/env node
/**
 * Claude Code Hook: PreCompact Session Digest
 *
 * Registered as PreCompact event — fires before context compaction.
 * Reads JSON from stdin (Claude Code hook protocol), delegates to
 * the unified hook runner in aios-core.
 *
 * Stdin format (PreCompact):
 * {
 *   "session_id": "abc123",
 *   "transcript_path": "/path/to/session.jsonl",
 *   "cwd": "/path/to/project",
 *   "hook_event_name": "PreCompact",
 *   "trigger": "auto" | "manual"
 * }
 *
 * @see .aios-core/hooks/unified/runners/precompact-runner.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Resolve project root via __dirname (same pattern as synapse-engine.cjs)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Safety timeout (ms) — defense-in-depth; Claude Code also manages hook timeout. */
const HOOK_TIMEOUT_MS = 9000;

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

  // Try both possible locations for the runner:
  // 1. Installed via npm: node_modules/aios-core/.aios-core/hooks/...
  // 2. In the repo itself: .aios-core/hooks/...
  const candidates = [
    path.join(PROJECT_ROOT, 'node_modules', 'aios-core', '.aios-core', 'hooks', 'unified', 'runners', 'precompact-runner.js'),
    path.join(PROJECT_ROOT, '.aios-core', 'hooks', 'unified', 'runners', 'precompact-runner.js'),
  ];

  let runnerPath = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      runnerPath = candidate;
      break;
    }
  }

  if (!runnerPath) {
    // Runner not found in any location — skip silently
    return;
  }

  // Build context object expected by onPreCompact
  const context = {
    sessionId: input.session_id,
    projectDir: input.cwd || PROJECT_ROOT,
    transcriptPath: input.transcript_path,
    trigger: input.trigger || 'auto',
    hookEventName: input.hook_event_name || 'PreCompact',
    permissionMode: input.permission_mode,
    conversation: input,
    provider: 'claude',
  };

  try {
    const { onPreCompact } = require(runnerPath);
    if (typeof onPreCompact === 'function') {
      await onPreCompact(context);
    }
  } catch (_err) {
    // Silent — never block precompaction flow
  }
}

// No process.exit() — let Node exit naturally (Windows pipe fix)
function run() {
  const timer = setTimeout(() => {}, HOOK_TIMEOUT_MS);
  timer.unref();
  main()
    .then(() => {})
    .catch(() => {});
}

if (require.main === module) run();

module.exports = { readStdin, main, run, HOOK_TIMEOUT_MS };
