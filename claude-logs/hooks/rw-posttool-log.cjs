#!/usr/bin/env node
'use strict';

/**
 * RIAWORKS PostToolUse Hook — Write/Edit Result Logger
 *
 * Logs the result of Write/Edit tool executions after they complete.
 * No injection — the tool has already executed.
 *
 * Stdin: { tool_name, tool_input: { file_path }, tool_result, cwd }
 * Stdout: (none — observation only)
 *
 * Logging: RW_HOOK_LOG=1 (summary) or RW_HOOK_LOG=2 (verbose)
 * Output:  .logs/rw-hooks.log (unified)
 *
 * @module riaworks/rw-posttool-log
 */

const fs = require('fs');
const path = require('path');

// ── RIAWORKS lib (zero AIOX dependency) ─────────────────
const logger = require('./lib/rw-hook-logger');

/** Tools to log results for. */
const TARGET_TOOLS = new Set(['Write', 'Edit']);

/** Safety timeout (ms). */
const HOOK_TIMEOUT_MS = 3000;

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

/** Main execution. */
function main() {
  const stdinData = readStdinSync();
  if (!stdinData) return;

  const input = parseStdin(stdinData);
  if (!input) return;

  const toolName = input.tool_name;
  if (!toolName || !TARGET_TOOLS.has(toolName)) return;

  const cwd = input.cwd || process.cwd();
  logger.init(cwd);

  const filePath = input.tool_input && input.tool_input.file_path;
  const toolResult = input.tool_result || '';

  // Determine success/failure from result
  const isError = typeof toolResult === 'string' && (
    toolResult.includes('Error') ||
    toolResult.includes('error') ||
    toolResult.includes('FAILED')
  );

  logger.logPostTool(cwd, {
    toolName,
    filePath: filePath || '(unknown)',
    success: !isError,
    resultSize: typeof toolResult === 'string' ? toolResult.length : JSON.stringify(toolResult).length,
    result: toolResult,
  });
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
      logger.logOp('ERROR', `rw-posttool-log crashed: ${err.message}`);
    } catch (_) {}
  }
}

if (require.main === module) run();

module.exports = { main, run, HOOK_TIMEOUT_MS, TARGET_TOOLS };
