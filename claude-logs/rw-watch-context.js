'use strict';

const fs = require('fs');
const path = require('path');

// ===========================================================================
// rw-watch-context.js — Real-time monitor for Claude Code hook logs
//
// Tail-follows RIAWORKS hook log files to show in real time what is being
// injected into the Claude session context.
//
// Claude's JSONL does NOT store context injections (they are ephemeral).
// The only way to capture them is via hook logs:
//   .logs/rw-hooks.log             — unified log (RIAWORKS wrapper hooks)
//   .logs/rw-aiox-log.log          — AIOX core operational log (env: RW_AIOX_LOG=1)
//
// Usage:
//   node rw-watch-context.js                 # Interactive menu
//   node rw-watch-context.js --log unified   # Unified log only (rw-hooks.log)
//   node rw-watch-context.js --log aiox      # AIOX core operational log
//   node rw-watch-context.js --cwd /path     # Different project
//   node rw-watch-context.js --no-color      # No ANSI colors
//   node rw-watch-context.js --since 5m      # Last 5 minutes only
//
// By RIAWORKS
// ===========================================================================

// ── ANSI colors ─────────────────────────────────────────────────────────────

let useColor = true;

const C = {
  reset: () => useColor ? '\x1b[0m' : '',
  dim: () => useColor ? '\x1b[2m' : '',
  bold: () => useColor ? '\x1b[1m' : '',
  cyan: () => useColor ? '\x1b[36m' : '',
  yellow: () => useColor ? '\x1b[33m' : '',
  green: () => useColor ? '\x1b[32m' : '',
  magenta: () => useColor ? '\x1b[35m' : '',
  red: () => useColor ? '\x1b[31m' : '',
  blue: () => useColor ? '\x1b[34m' : '',
  white: () => useColor ? '\x1b[37m' : '',
};

// ── Section colors for unified log ────────────────────────────────────────

const SECTION_COLORS = {
  'SYNAPSE': C.cyan,
  'CODE-INTEL': C.blue,
  'SKILL': C.magenta,
  'AIOX-RUNTIME': C.yellow,
  'POSTTOOL': C.green,
  'ERROR': C.red,
};

// ── Time helpers ────────────────────────────────────────────────────────────

function toLocalTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getGMTLabel() {
  const offsetMin = new Date().getTimezoneOffset();
  const sign = offsetMin <= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return m > 0 ? `GMT${sign}${h}:${String(m).padStart(2, '0')}` : `GMT${sign}${h}`;
}

/**
 * Parse duration string like "5m", "1h", "30s" to milliseconds.
 */
function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 60 * 60 * 1000;
  return 0;
}

// ── Log file definitions ────────────────────────────────────────────────────

const LOG_FILES = {
  unified: {
    filename: 'rw-hooks.log',
    label: 'UNIFIED',
    color: C.green,
    description: 'Unified RIAWORKS log (synapse + code-intel + skills)',
  },
  aiox: {
    filename: 'rw-aiox-log.log',
    label: 'AIOX',
    color: C.yellow,
    description: 'AIOX core operational log (session, cleanup, runtime)',
  },
};

// ── Tail-follow engine ──────────────────────────────────────────────────────

/**
 * Monitora um arquivo de log, mostrando novas linhas em tempo real.
 *
 * @param {string} filePath
 * @param {string} label
 * @param {Function} colorFn
 * @param {number} sinceMs - Mostrar apenas linhas dos ultimos N ms (0 = tudo novo)
 * @returns {{ stop: Function }}
 */
function tailFile(filePath, label, colorFn, sinceMs) {
  let fileSize = 0;
  let lineBuffer = '';
  let initialDump = true;
  let currentSection = null; // Track active section type for unified log coloring

  try {
    const stat = fs.statSync(filePath);
    if (sinceMs > 0) {
      // Read existing content and show recent lines
      fileSize = 0; // Read from beginning to filter by time
    } else {
      // Start from end of file (only show new content)
      fileSize = stat.size;
    }
  } catch {
    // File doesn't exist yet — will watch for creation
  }

  function processNewData() {
    let currentSize;
    try {
      currentSize = fs.statSync(filePath).size;
    } catch {
      return; // File doesn't exist yet
    }

    if (currentSize <= fileSize && !initialDump) return;
    if (currentSize === fileSize) { initialDump = false; return; }

    const fd = fs.openSync(filePath, 'r');
    const bytesToRead = currentSize - fileSize;
    const buf = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buf, 0, bytesToRead, fileSize);
    fs.closeSync(fd);

    fileSize = currentSize;
    initialDump = false;

    const chunk = lineBuffer + buf.toString('utf8');
    const lines = chunk.split('\n');
    lineBuffer = lines.pop() || '';

    const now = Date.now();
    const color = colorFn();
    const dim = C.dim();
    const reset = C.reset();
    const bold = C.bold();

    for (const line of lines) {
      if (!line.trim()) continue;

      // If --since is set, filter by timestamp in the line
      if (sinceMs > 0) {
        const tsMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
        if (tsMatch) {
          const lineTime = new Date(tsMatch[1]).getTime();
          if (now - lineTime > sinceMs) continue;
        }
      }

      // ── Unified log: section-aware colored rendering ──────────
      if (label === 'UNIFIED') {
        // Section headers: --- SYNAPSE ---- HH:MM:SS ---
        const sectionMatch = line.match(/^--- (\S+) -+ (\d{2}:\d{2}:\d{2}) ---$/);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
          const sTime = sectionMatch[2];
          const sColorFn = SECTION_COLORS[currentSection] || C.yellow;
          const sCol = sColorFn();
          const today = new Date().toLocaleDateString('sv-SE');
          console.log('');
          console.log(`${dim}${'─'.repeat(70)}${reset}`);
          console.log(`  ${sCol}${bold}${currentSection}${reset}  ${dim}${today} ${sTime}${reset}`);
          console.log(`${dim}${'─'.repeat(70)}${reset}`);
          continue;
        }

        const sColorFn = SECTION_COLORS[currentSection] || C.yellow;
        const sCol = sColorFn();

        // Sub-section markers: --- injected xml ---, --- end xml ---, etc.
        const subMatch = line.match(/^\s*--- (.+) ---\s*$/);
        if (subMatch) {
          console.log(`  ${dim}${sCol}\u25b8 ${subMatch[1]}${reset}`);
          continue;
        }

        // Constitution / NON-NEGOTIABLE (before kv match — "MUST:" matches kv regex)
        if (line.includes('[CONSTITUTION]') || line.includes('NON-NEGOTIABLE')) {
          console.log(`    ${C.red()}${bold}${line.trim()}${reset}`);
          continue;
        }

        // Context bracket (before kv match — "CONTEXT BRACKET:" matches kv regex)
        if (line.includes('CONTEXT BRACKET') || line.match(/\[(FRESH|WARM|HOT)\]/)) {
          console.log(`    ${C.green()}${bold}${line.trim()}${reset}`);
          continue;
        }

        // MUST / SHOULD rules (before kv match)
        if (line.includes('MUST:') || line.includes('MUST NOT:') || line.includes('SHOULD:') || line.includes('SHOULD NOT:') || line.includes('EXCEPTION:')) {
          console.log(`    ${dim}${line.trim()}${reset}`);
          continue;
        }

        // XML tags (before kv match)
        if (line.trim().startsWith('<') || line.trim().startsWith('</')) {
          console.log(`    ${dim}${line.trim()}${reset}`);
          continue;
        }

        // Numbered rules (before kv match)
        if (line.trim().match(/^\d+\.\s/)) {
          console.log(`    ${dim}${line.trim()}${reset}`);
          continue;
        }

        // Pipeline/layers metrics (before kv match)
        if (line.includes('pipeline:') || line.includes('layers:')) {
          console.log(`  ${sCol}${line.trim()}${reset}`);
          continue;
        }

        // Key-value lines: "  key:  value" or "  key: value"
        const kvMatch = line.match(/^(\s+)([\w][\w\s-]*?):\s{1,}(.+)$/);
        if (kvMatch) {
          console.log(`  ${sCol}${bold}${kvMatch[2]}:${reset} ${kvMatch[3]}`);
          continue;
        }

        // Operational log: [ISO] [LEVEL] message
        const opMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]\s*\[(\w+)\]\s*(.+)$/);
        if (opMatch) {
          const lvlColor = opMatch[2] === 'ERROR' ? C.red() : opMatch[2] === 'WARN' ? C.yellow() : dim;
          console.log(`  ${dim}${toLocalTime(new Date(opMatch[1]))}${reset} ${lvlColor}${bold}[${opMatch[2]}]${reset} ${opMatch[3]}`);
          continue;
        }

        // Everything else
        console.log(`  ${line.trim()}`);
        continue;
      }

      // ── Legacy log rendering ──────────────────────────────────
      const isSection = line.startsWith('[') && line.includes(']');
      const isXmlTag = line.trim().startsWith('<') || line.trim().startsWith('</');
      const isRule = line.trim().match(/^\d+\.\s/) || line.includes('MUST:') || line.includes('SHOULD:');
      const isBracket = line.includes('CONTEXT BRACKET') || line.includes('[FRESH]') || line.includes('[WARM]') || line.includes('[HOT]');
      const isConstitution = line.includes('[CONSTITUTION]') || line.includes('NON-NEGOTIABLE');
      const isStatic = line.includes('[STATIC CONTEXT]');
      const isMetric = line.includes('Hook output:') || line.includes('Runtime resolved');
      const isSkill = line.includes('SKILL ACTIVATION') || line.includes('[SKILL]') || line.includes('[AGENT PROMPT]');

      let prefix = `${dim}${color}[${label}]${reset} `;

      if (isSkill) {
        console.log(`${prefix}${C.magenta()}${bold}${line}${reset}`);
      } else if (isConstitution) {
        console.log(`${prefix}${C.red()}${bold}${line}${reset}`);
      } else if (isBracket) {
        console.log(`${prefix}${C.green()}${bold}${line}${reset}`);
      } else if (isStatic) {
        console.log(`${prefix}${C.blue()}${bold}${line}${reset}`);
      } else if (isMetric) {
        const localTs = line.match(/^\[(.+?)\]/)
          ? toLocalTime(new Date(line.match(/^\[(.+?)\]/)[1]))
          : '';
        const rest = line.replace(/^\[.+?\]\s*\[.+?\]\s*/, '');
        console.log(`${prefix}${dim}${localTs}${reset} ${color}${rest}${reset}`);
      } else if (isXmlTag) {
        console.log(`${prefix}${dim}${line}${reset}`);
      } else if (isRule) {
        console.log(`${prefix}  ${line}`);
      } else if (isSection) {
        const localTs = line.match(/^\[(.+?)\]/)
          ? toLocalTime(new Date(line.match(/^\[(.+?)\]/)[1]))
          : '';
        const rest = line.replace(/^\[.+?\]\s*/, '');
        console.log(`${prefix}${dim}${localTs}${reset} ${rest}`);
      } else {
        console.log(`${prefix}${line}`);
      }
    }
  }

  const interval = setInterval(processNewData, 500);
  processNewData(); // Initial read

  return { stop: () => clearInterval(interval) };
}

// ── Interactive menu ─────────────────────────────────────────────────────────

const readline = require('readline');

/**
 * Show an interactive arrow-key menu and return the selected index.
 * Uses readline.emitKeypressEvents for correct escape sequence parsing on Windows.
 *
 * @param {string} title - Menu section title
 * @param {Array<{label: string, value: string, desc?: string}>} items
 * @returns {Promise<number>} Selected index
 */
function showMenu(title, items) {
  return new Promise((resolve) => {
    let selected = 0;
    const bold = C.bold();
    const dim = C.dim();
    const cyan = C.cyan();
    const green = C.green();
    const reset = C.reset();

    function render() {
      // Move cursor up to overwrite previous render (except first time)
      if (render._rendered) {
        process.stdout.write(`\x1b[${items.length}A`);
      }
      for (let i = 0; i < items.length; i++) {
        const prefix = i === selected
          ? `  ${green}${bold}> ${reset}${bold}`
          : `    ${dim}`;
        const suffix = items[i].desc ? `  ${dim}${items[i].desc}${reset}` : '';
        const line = `${prefix}${items[i].label}${reset}${suffix}`;
        process.stdout.write(`\x1b[2K${line}\n`);
      }
      render._rendered = true;
    }

    console.log(`\n  ${cyan}${bold}${title}${reset}`);
    console.log('');

    render();

    if (!process.stdin.isTTY) {
      resolve(0);
      return;
    }

    // Use readline keypress events — correctly parses escape sequences on Windows
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKeypress = (str, key) => {
      if (!key) return;

      if (key.name === 'up' || key.name === 'k') {
        selected = (selected - 1 + items.length) % items.length;
        render();
      } else if (key.name === 'down' || key.name === 'j') {
        selected = (selected + 1) % items.length;
        render();
      } else if (key.name === 'return' || key.name === 'space') {
        process.stdin.removeListener('keypress', onKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(selected);
      } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        process.stdin.setRawMode(false);
        console.log('');
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Run the interactive menu flow and return chosen options.
 * @param {Object} available - Available log files
 * @returns {Promise<{logFilter: string|null, sinceStr: string|null}>}
 */
async function interactiveMenu(available) {
  const bold = C.bold();
  const cyan = C.cyan();
  const dim = C.dim();
  const reset = C.reset();

  console.log('');
  console.log(`${cyan}${bold}  ╔══════════════════════════════════════╗${reset}`);
  console.log(`${cyan}${bold}  ║        Claude Context Watcher        ║${reset}`);
  console.log(`${cyan}${bold}  ║        by RIAWORKS                   ║${reset}`);
  console.log(`${cyan}${bold}  ╚══════════════════════════════════════╝${reset}`);
  console.log('');
  console.log(`  ${dim}Use arrows ↑↓ to navigate, Enter to select, q to quit${reset}`);

  // ── Menu 1: Log source ──
  const logItems = [
    { label: 'All logs', value: null, desc: '(unified + aiox)' },
  ];
  for (const [key, def] of Object.entries(available)) {
    const size = (fs.statSync(def.filePath).size / 1024).toFixed(1);
    logItems.push({
      label: `${def.color()}[${def.label}]${reset} ${def.filename}`,
      value: key,
      desc: `${size} KB — ${def.description}`,
    });
  }

  const logIdx = await showMenu('Which log to monitor?', logItems);
  const logFilter = logItems[logIdx].value;

  // ── Menu 2: Time filter ──
  const sinceItems = [
    { label: 'New events only', value: null, desc: '(live mode — from now)' },
    { label: 'Last 5 minutes',     value: '5m' },
    { label: 'Last 15 minutes',    value: '15m' },
    { label: 'Last 30 minutes',    value: '30m' },
    { label: 'Last hour',          value: '1h' },
  ];

  const sinceIdx = await showMenu('Time period?', sinceItems);
  const sinceStr = sinceItems[sinceIdx].value;

  return { logFilter, sinceStr };
}

// ── Start watcher (shared between CLI args and menu) ─────────────────────────

function startWatcher(cwd, logsDir, available, logFilter, sinceStr) {
  const bold = C.bold();
  const cyan = C.cyan();
  const dim = C.dim();
  const reset = C.reset();

  // Filter selection
  let targets = available;
  if (logFilter) {
    if (!available[logFilter]) {
      console.error(`Log "${logFilter}" not found. Available: ${Object.keys(available).join(', ')}`);
      process.exit(1);
    }
    targets = { [logFilter]: available[logFilter] };
  }

  const sinceMs = sinceStr ? parseDuration(sinceStr) : 0;

  // Print header
  console.log('');
  console.log(`${cyan}${bold}  ╔══════════════════════════════════════╗${reset}`);
  console.log(`${cyan}${bold}  ║        Claude Context Watcher        ║${reset}`);
  console.log(`${cyan}${bold}  ║        by RIAWORKS                   ║${reset}`);
  console.log(`${cyan}${bold}  ╚══════════════════════════════════════╝${reset}`);
  console.log('');
  console.log(`  ${dim}Project:${reset}   ${cwd}`);
  console.log(`  ${dim}Timezone:${reset}  ${getGMTLabel()}`);
  console.log(`  ${dim}Logs dir:${reset}  ${logsDir}`);
  console.log('');

  console.log(`  ${dim}Monitoring:${reset}`);
  for (const [, def] of Object.entries(targets)) {
    const size = (fs.statSync(def.filePath).size / 1024).toFixed(1);
    console.log(`    ${def.color()}[${def.label}]${reset} ${def.filename} (${size} KB) — ${def.description}`);
  }
  console.log('');

  if (sinceMs > 0) {
    console.log(`  ${dim}Filter:${reset}    last ${sinceStr}`);
  } else {
    console.log(`  ${dim}Mode:${reset}      showing only new events from now`);
  }

  console.log('');
  console.log(`  ${dim}Waiting for next prompt... (Ctrl+C to stop)${reset}`);
  console.log('');
  console.log(`${dim}${'─'.repeat(70)}${reset}`);

  // Start tailing all selected logs
  const watchers = [];
  for (const [, def] of Object.entries(targets)) {
    watchers.push(tailFile(def.filePath, def.label, def.color, sinceMs));
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    for (const w of watchers) w.stop();
    console.log('');
    console.log(`${dim}  Watcher stopped.${reset}`);
    process.exit(0);
  });

  process.stdin.resume();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let logFilter = null; // null = all logs
  let sinceStr = null;
  let hasArgs = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
      hasArgs = true;
    } else if (args[i] === '--log' && args[i + 1]) {
      logFilter = args[i + 1];
      i++;
      hasArgs = true;
    } else if (args[i] === '--since' && args[i + 1]) {
      sinceStr = args[i + 1];
      i++;
      hasArgs = true;
    } else if (args[i] === '--no-color') {
      useColor = false;
      hasArgs = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  const logsDir = path.join(cwd, '.logs');

  if (!fs.existsSync(logsDir)) {
    console.error(`.logs/ directory not found in: ${cwd}`);
    console.error('');
    console.error('This project needs RIAWORKS wrapper hooks with logging enabled.');
    console.error('Use prompt-apply-logging.md to install the logging plugin.');
    process.exit(1);
  }

  // Check which log files exist
  const available = {};
  for (const [key, def] of Object.entries(LOG_FILES)) {
    const filePath = path.join(logsDir, def.filename);
    if (fs.existsSync(filePath)) {
      available[key] = { ...def, filePath };
    }
  }

  if (Object.keys(available).length === 0) {
    console.error('No hook log files found in .logs/');
    console.error('Expected: rw-hooks.log or rw-aiox-log.log');
    process.exit(1);
  }

  // If no CLI args and terminal is interactive — show menu
  if (!hasArgs && process.stdin.isTTY) {
    const choices = await interactiveMenu(available);
    logFilter = choices.logFilter;
    sinceStr = choices.sinceStr;
  }

  startWatcher(cwd, logsDir, available, logFilter, sinceStr);
}

function printHelp() {
  const bold = C.bold();
  const reset = C.reset();
  const dim = C.dim();

  console.log('');
  console.log(`${bold}  Claude Context Watcher${reset} — by RIAWORKS`);
  console.log('');
  console.log('  Real-time monitor for RIAWORKS hook log files. Shows what is being');
  console.log('  injected into the Claude Code session context via hooks.');
  console.log('');
  console.log(`  ${bold}IMPORTANT:${reset} Claude's JSONL does NOT store context injections.`);
  console.log('  They are ephemeral (exist only in the API request). The only way to');
  console.log('  capture them is via hook logs.');
  console.log('');
  console.log(`  ${bold}Usage:${reset}`);
  console.log('    node rw-watch-context.js                  # Interactive menu');
  console.log('    node rw-watch-context.js --log unified    # Unified log only (rw-hooks.log)');
  console.log('    node rw-watch-context.js --log aiox       # AIOX core operational log');
  console.log('    node rw-watch-context.js --since 5m       # Last 5 minutes');
  console.log('    node rw-watch-context.js --since 1h       # Last hour');
  console.log('    node rw-watch-context.js --cwd /path      # Different project');
  console.log('    node rw-watch-context.js --no-color       # No ANSI colors');
  console.log('');
  console.log(`  ${bold}Interactive menu:${reset}`);
  console.log('    Without arguments, opens an arrow-key menu to choose:');
  console.log('      1. Which log to monitor (all, unified, context, synapse, hooks)');
  console.log('      2. Time period (live, 5m, 15m, 30m, 1h)');
  console.log('');
  console.log(`  ${bold}Monitored logs:${reset}`);
  console.log(`    ${C.green()}[UNIFIED]${reset}  rw-hooks.log             — Unified RIAWORKS log (synapse + code-intel + skills)`);
  console.log(`    ${C.yellow()}[AIOX]${reset}     rw-aiox-log.log          — AIOX core operational log (env: RW_AIOX_LOG=1)`);
  console.log('');
  console.log(`  ${bold}Tip:${reset} Open in a separate terminal while using Claude Code.`);
  console.log(`  ${dim}Each prompt you send triggers hooks and generates new log entries.${reset}`);
  console.log('');
}

main();
