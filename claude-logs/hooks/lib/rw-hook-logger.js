'use strict';

/**
 * Unified hook logger — single log file, zero AIOX dependencies.
 *
 * Env: RW_HOOK_LOG = 0 (off) | 1 (summary) | 2 (verbose with full XML)
 * File: .logs/rw-hooks.log
 *
 * Replaces: RW_SYNAPSE_TRACE, RW_CONTEXT_LOG_FULL, RW_INTEL_CONTEXT_LOG
 * Note: AIOX core writes to .logs/rw-aiox-log.log via rwHooksLog (env: RW_AIOX_LOG=1).
 *
 * @module riaworks/lib/rw-hook-logger
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = 'rw-hooks.log';

// ── Config ─────────────────────────────────────────────

/**
 * Get log level from RW_HOOK_LOG env var.
 * @returns {number} 0=off, 1=summary, 2=verbose (full XML included)
 */
function getLogLevel() {
  const val = process.env.RW_HOOK_LOG;
  if (val === '2' || val === 'verbose') return 2;
  if (val === '1' || val === 'true' || val === 'summary') return 1;
  return 0;
}

// ── Internal State ─────────────────────────────────────

/** @type {string|null} */
let _logsDir = null;

/**
 * Initialize logger. Must be called before any log* function.
 * Creates .logs/ directory with .gitignore if needed.
 * @param {string} cwd - Project root
 */
function init(cwd) {
  if (!cwd) return;
  _logsDir = path.join(cwd, '.logs');
  try {
    if (!fs.existsSync(_logsDir)) {
      fs.mkdirSync(_logsDir, { recursive: true });
      const gi = path.join(_logsDir, '.gitignore');
      if (!fs.existsSync(gi)) fs.writeFileSync(gi, '*\n!.gitignore\n');
    }
  } catch (_) { /* fire-and-forget */ }
}

// ── Helpers ────────────────────────────────────────────

/**
 * Append text to unified log file (fire-and-forget).
 * @param {string} text
 */
function append(text) {
  if (!_logsDir) return;
  try {
    fs.appendFileSync(path.join(_logsDir, LOG_FILE), text);
  } catch (_) { /* never block */ }
}

/** @returns {string} HH:MM:SS */
function timeShort() {
  return new Date().toISOString().slice(11, 19);
}

/** @returns {string} Full ISO timestamp */
function timeFull() {
  return new Date().toISOString();
}

/**
 * Format bytes as human-readable.
 * @param {number} bytes
 * @returns {string}
 */
function fmtSize(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1048576).toFixed(1)}M`;
}

/**
 * Truncate string for summary display.
 * @param {string} str
 * @param {number} [max=70]
 * @returns {string}
 */
function truncate(str, max = 70) {
  if (!str) return '(empty)';
  const clean = str.replace(/[\n\r]+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

/**
 * List static context files and return compact summary.
 * @param {string} cwd
 * @returns {string}
 */
function staticContextSummary(cwd) {
  const items = [];
  try {
    const claudeDir = path.join(cwd, '.claude');

    // CLAUDE.md
    try {
      const st = fs.statSync(path.join(claudeDir, 'CLAUDE.md'));
      items.push(`CLAUDE.md(${fmtSize(st.size)})`);
    } catch (_) {}

    // Rules
    try {
      const rulesDir = path.join(claudeDir, 'rules');
      const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
      let total = 0;
      for (const f of files) {
        try { total += fs.statSync(path.join(rulesDir, f)).size; } catch (_) {}
      }
      if (files.length > 0) items.push(`rules/${files.length}(${fmtSize(total)})`);
    } catch (_) {}

    // MEMORY.md
    for (const mp of [
      path.join(claudeDir, 'memory', 'MEMORY.md'),
      path.join(cwd, 'MEMORY.md'),
    ]) {
      try {
        const st = fs.statSync(mp);
        items.push(`MEMORY.md(${fmtSize(st.size)})`);
        break;
      } catch (_) {}
    }
  } catch (_) {}
  return items.length > 0 ? items.join(', ') : '(none)';
}

// ── Event Loggers ──────────────────────────────────────

/**
 * Log Synapse (UserPromptSubmit) injection.
 *
 * @param {string} cwd - Project root
 * @param {object} params
 * @param {string} params.prompt - User prompt text
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.bracket - Context bracket (FRESH, etc.)
 * @param {number} params.rules - Number of rules injected
 * @param {number} params.xmlSize - Size of JSON output in bytes
 * @param {string} [params.xml] - Full XML (only logged at level 2)
 */
function logSynapse(cwd, { prompt, sessionId, bracket, rules, xmlSize, xml }) {
  const level = getLogLevel();
  if (level === 0) return;

  const sid = (sessionId || '????????').slice(0, 8);
  const lines = [
    '',
    `--- SYNAPSE ---------------------------------------- ${timeShort()} ---`,
    `  prompt:  ${truncate(prompt)}`,
    `  session: ${sid} | bracket: ${bracket || '?'} | rules: ${rules || 0} | xml: ${fmtSize(xmlSize || 0)}`,
    `  static:  ${staticContextSummary(cwd)}`,
  ];

  if (level >= 2 && xml) {
    lines.push('  --- injected xml ---');
    // Indent XML for readability
    const indented = xml.split('\n').map(l => `  ${l}`).join('\n');
    lines.push(indented);
    lines.push('  --- end xml ---');
  }

  lines.push('');
  append(lines.join('\n') + '\n');
}

/**
 * Log Code-Intel (PreToolUse Write/Edit) injection.
 *
 * @param {string} cwd - Project root
 * @param {object} params
 * @param {string} params.toolName - Write or Edit
 * @param {string} params.filePath - Absolute path to target file
 * @param {string} params.xml - Code-intel XML injected
 */
function logCodeIntel(cwd, { toolName, filePath, xml }) {
  const level = getLogLevel();
  if (level === 0) return;

  // Parse XML summary without loading any external parser
  let entity = '';
  let refs = 0;
  let deps = 0;
  let depNames = [];
  if (xml) {
    const em = xml.match(/<path>([^<]+)<\/path>/);
    if (em) entity = em[1];
    const rm = xml.match(/referenced-by count="(\d+)"/);
    if (rm) refs = parseInt(rm[1], 10);
    const dm = xml.match(/dependencies count="(\d+)"/);
    if (dm) deps = parseInt(dm[1], 10);
    const depMatches = xml.matchAll(/<dep name="([^"]+)" layer="([^"]+)"/g);
    for (const m of depMatches) depNames.push(`${m[1]}@${m[2]}`);
  }

  const relPath = filePath
    ? path.relative(cwd, filePath).replace(/\\/g, '/')
    : filePath;

  const lines = [
    '',
    `--- CODE-INTEL ------------------------------------- ${timeShort()} ---`,
    `  tool:   ${toolName} -> ${relPath}`,
    `  entity: ${entity || '(none)'}`,
    `  refs: ${refs} | deps: ${deps}${depNames.length > 0 ? ` (${depNames.join(', ')})` : ''}`,
  ];

  if (level >= 2 && xml) {
    lines.push('  --- injected xml ---');
    const indented = xml.split('\n').map(l => `  ${l}`).join('\n');
    lines.push(indented);
    lines.push('  --- end xml ---');
  }

  lines.push('');
  append(lines.join('\n') + '\n');
}

/**
 * Log Code-Intel skip (no entity data found — no injection).
 *
 * @param {string} cwd - Project root
 * @param {object} params
 * @param {string} params.toolName - Write or Edit
 * @param {string} params.filePath - Absolute path to target file
 */
function logCodeIntelSkip(cwd, { toolName, filePath }) {
  const level = getLogLevel();
  if (level === 0) return;

  const relPath = filePath
    ? path.relative(cwd, filePath).replace(/\\/g, '/')
    : filePath;

  const lines = [
    '',
    `--- CODE-INTEL ------------------------------------- ${timeShort()} ---`,
    `  tool:   ${toolName} -> ${relPath}`,
    `  entity: (none) | no injection`,
    '',
  ];

  append(lines.join('\n') + '\n');
}

/**
 * Log Skill/agent activation (NOT injected by hook — Skill tool does it).
 *
 * @param {string} cwd - Project root
 * @param {object} params
 * @param {string} params.skillName - Skill identifier (e.g. AIOX:agents:pm)
 * @param {string} params.resolvedPath - Resolved file path
 * @param {number} params.contentSize - File size in bytes
 */
function logSkill(cwd, { skillName, resolvedPath, contentSize }) {
  const level = getLogLevel();
  if (level === 0) return;

  const lines = [
    '',
    `--- SKILL ------------------------------------------ ${timeShort()} ---`,
    `  skill: ${skillName}`,
    `  file:  ${resolvedPath || '(built-in)'}`,
    `  size:  ${fmtSize(contentSize || 0)} (loaded by Skill tool, NOT by this hook)`,
    '',
  ];

  append(lines.join('\n') + '\n');
}

/**
 * Log Synapse engine internal metrics (what the pipeline actually did).
 * Shows per-layer breakdown: which layers ran, skipped, errored, durations.
 *
 * @param {object} metrics - result.metrics from engine.process()
 * @param {number} metrics.total_ms - Total pipeline duration
 * @param {number} metrics.layers_loaded - Layers that produced rules
 * @param {number} metrics.layers_skipped - Layers filtered by bracket
 * @param {number} metrics.layers_errored - Layers that threw
 * @param {number} metrics.total_rules - Sum of rules across layers
 * @param {object} metrics.per_layer - Per-layer detail { status, duration, rules }
 */
function logEngineMetrics(metrics) {
  const level = getLogLevel();
  if (level === 0 || !metrics) return;

  const lines = [
    `  --- engine metrics ---`,
    `  pipeline: ${(metrics.total_ms || 0).toFixed(1)}ms | loaded: ${metrics.layers_loaded || 0} | skipped: ${metrics.layers_skipped || 0} | errors: ${metrics.layers_errored || 0} | rules: ${metrics.total_rules || 0}`,
  ];

  // Per-layer detail (always shown at level 1+)
  const perLayer = metrics.per_layer || {};
  const layerNames = Object.keys(perLayer);
  if (layerNames.length > 0) {
    const parts = [];
    for (const name of layerNames) {
      const info = perLayer[name];
      const st = info.status || '?';
      if (st === 'ok') {
        parts.push(`${name}:${info.rules || 0}r/${(info.duration || 0).toFixed(1)}ms`);
      } else if (st === 'skipped') {
        parts.push(`${name}:skip`);
      } else {
        parts.push(`${name}:ERR`);
      }
    }
    lines.push(`  layers:   [${parts.join(', ')}]`);
  }

  lines.push('  --- end metrics ---');
  append(lines.join('\n') + '\n');
}

/**
 * Log AIOX-RUNTIME event — synapse pipeline internal flow.
 * Captures bracket, layers, timing from the AIOX engine metrics file.
 *
 * @param {string} cwd - Project root
 * @param {object} metrics - Metrics from .synapse/metrics/hook-metrics.json
 */
function logAioxRuntime(cwd, metrics) {
  const level = getLogLevel();
  if (level === 0 || !metrics) return;

  const bracket = metrics.context_bracket || '?';
  const promptCount = metrics.prompt_count || 0;

  const lines = [
    '',
    `--- AIOX-RUNTIME ----------------------------------- ${timeShort()} ---`,
    `  bracket: ${bracket} | prompt#: ${promptCount}`,
    `  pipeline: ${(metrics.total_ms || 0).toFixed(1)}ms | loaded: ${metrics.layers_loaded || 0} | skipped: ${metrics.layers_skipped || 0} | errors: ${metrics.layers_errored || 0}`,
  ];

  // Per-layer detail
  const perLayer = metrics.per_layer || {};
  const layerNames = Object.keys(perLayer);
  if (layerNames.length > 0) {
    const parts = [];
    for (const name of layerNames) {
      const info = perLayer[name];
      const st = info.status || '?';
      if (st === 'ok') {
        parts.push(`${name}:${info.rules || 0}r/${(info.duration || 0).toFixed(1)}ms`);
      } else if (st === 'skipped') {
        parts.push(`${name}:skip`);
      } else {
        parts.push(`${name}:ERR`);
      }
    }
    lines.push(`  layers:   [${parts.join(', ')}]`);
  }

  lines.push('');
  append(lines.join('\n') + '\n');
}

/**
 * Log PostToolUse result — what happened after Write/Edit executed.
 *
 * @param {string} cwd - Project root
 * @param {object} params
 * @param {string} params.toolName - Write or Edit
 * @param {string} params.filePath - Target file path
 * @param {boolean} params.success - Whether the tool succeeded
 * @param {number} params.resultSize - Size of tool result in bytes
 * @param {string} [params.result] - Full result (only logged at level 2)
 */
function logPostTool(cwd, { toolName, filePath, success, resultSize, result }) {
  const level = getLogLevel();
  if (level === 0) return;

  const relPath = filePath
    ? path.relative(cwd, filePath).replace(/\\/g, '/')
    : filePath;

  const status = success ? 'OK' : 'FAIL';

  const lines = [
    '',
    `--- POSTTOOL --------------------------------------- ${timeShort()} ---`,
    `  tool:   ${toolName} -> ${relPath}`,
    `  status: ${status} | result: ${fmtSize(resultSize || 0)}`,
  ];

  if (level >= 2 && result && !success) {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    lines.push(`  --- result ---`);
    lines.push(`  ${truncate(resultStr, 200)}`);
    lines.push(`  --- end result ---`);
  }

  lines.push('');
  append(lines.join('\n') + '\n');
}

/**
 * Log operational message.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} message
 */
function logOp(level, message) {
  if (getLogLevel() === 0) return;
  append(`[${timeFull()}] [${level}] ${message}\n`);
}

module.exports = {
  init,
  getLogLevel,
  logSynapse,
  logEngineMetrics,
  logAioxRuntime,
  logCodeIntel,
  logCodeIntelSkip,
  logSkill,
  logPostTool,
  logOp,
  staticContextSummary,
  fmtSize,
  truncate,
  LOG_FILE,
};
