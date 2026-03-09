'use strict';

const fs = require('fs');
const path = require('path');

// ===========================================================================
// watch-context.js — Monitor de contexto injetado pelo Claude Code
//
// Faz tail-follow nos logs de hook do AIOS/AIOX para mostrar em tempo real
// o que esta sendo injetado no contexto da sessao Claude.
//
// O JSONL do Claude NAO armazena as injecoes (sao efemeras na API).
// A unica forma de capturar e via logs de hook:
//   .logs/rw-context-log-full.log  — output completo do hook
//   .logs/rw-synapse-trace.log     — synapse-rules XML
//   .logs/rw-hooks-log.log         — metricas resumidas
//
// Uso:
//   node watch-context.js                 # Monitora todos os logs
//   node watch-context.js --log full      # Apenas context-log-full
//   node watch-context.js --log synapse   # Apenas synapse-trace
//   node watch-context.js --log hooks     # Apenas hooks-log (metricas)
//   node watch-context.js --cwd /path     # Outro projeto
//   node watch-context.js --no-color      # Sem cores ANSI
//   node watch-context.js --since 5m      # Apenas ultimos 5 minutos
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
  full: {
    filename: 'rw-context-log-full.log',
    label: 'CONTEXT',
    color: C.cyan,
    description: 'Output completo do hook (synapse-rules + static context + skills)',
  },
  synapse: {
    filename: 'rw-synapse-trace.log',
    label: 'SYNAPSE',
    color: C.magenta,
    description: 'Synapse-rules XML (constitution, bracket, rules)',
  },
  intel: {
    filename: 'rw-intel-context-log.log',
    label: 'INTEL',
    color: C.blue,
    description: 'Code-intel + Skill activations (agent prompts, entity refs)',
  },
  hooks: {
    filename: 'rw-hooks-log.log',
    label: 'HOOKS',
    color: C.yellow,
    description: 'Metricas resumidas (session, rules count, bytes)',
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

      // Format the line
      const isSection = line.startsWith('[') && line.includes(']');
      const isXmlTag = line.trim().startsWith('<') || line.trim().startsWith('</');
      const isRule = line.trim().match(/^\d+\.\s/) || line.includes('MUST:') || line.includes('SHOULD:');
      const isBracket = line.includes('CONTEXT BRACKET') || line.includes('[FRESH]') || line.includes('[WARM]') || line.includes('[HOT]');
      const isConstitution = line.includes('[CONSTITUTION]') || line.includes('NON-NEGOTIABLE');
      const isStatic = line.includes('[STATIC CONTEXT]');
      const isMetric = line.includes('Hook output:') || line.includes('Runtime resolved');
      const isSkill = line.includes('SKILL ACTIVATION') || line.includes('[SKILL]') || line.includes('[AGENT PROMPT]');
      const isYaml = line.trim().match(/^[a-zA-Z_-]+:/) || line.trim().startsWith('- ');

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
        // Extract and colorize metrics
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
  console.log(`  ${dim}Use setas ↑↓ para navegar, Enter para selecionar, q para sair${reset}`);

  // ── Menu 1: Log source ──
  const logItems = [
    { label: 'Todos os logs', value: null, desc: '(full + synapse + hooks)' },
  ];
  for (const [key, def] of Object.entries(available)) {
    const size = (fs.statSync(def.filePath).size / 1024).toFixed(1);
    logItems.push({
      label: `${def.color()}[${def.label}]${reset} ${def.filename}`,
      value: key,
      desc: `${size} KB — ${def.description}`,
    });
  }

  const logIdx = await showMenu('Qual log monitorar?', logItems);
  const logFilter = logItems[logIdx].value;

  // ── Menu 2: Time filter ──
  const sinceItems = [
    { label: 'Apenas novas injecoes', value: null, desc: '(live mode — a partir de agora)' },
    { label: 'Ultimos 5 minutos',     value: '5m' },
    { label: 'Ultimos 15 minutos',    value: '15m' },
    { label: 'Ultimos 30 minutos',    value: '30m' },
    { label: 'Ultima hora',           value: '1h' },
  ];

  const sinceIdx = await showMenu('Periodo de tempo?', sinceItems);
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
      console.error(`Log "${logFilter}" nao encontrado. Disponiveis: ${Object.keys(available).join(', ')}`);
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
  console.log(`  ${dim}Projeto:${reset}   ${cwd}`);
  console.log(`  ${dim}Timezone:${reset}  ${getGMTLabel()}`);
  console.log(`  ${dim}Logs dir:${reset}  ${logsDir}`);
  console.log('');

  console.log(`  ${dim}Monitorando:${reset}`);
  for (const [, def] of Object.entries(targets)) {
    const size = (fs.statSync(def.filePath).size / 1024).toFixed(1);
    console.log(`    ${def.color()}[${def.label}]${reset} ${def.filename} (${size} KB) — ${def.description}`);
  }
  console.log('');

  if (sinceMs > 0) {
    console.log(`  ${dim}Filtro:${reset}    ultimos ${sinceStr}`);
  } else {
    console.log(`  ${dim}Modo:${reset}      mostrando apenas novas injecoes a partir de agora`);
  }

  console.log('');
  console.log(`  ${dim}Aguardando proximo prompt... (Ctrl+C para parar)${reset}`);
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
    console.log(`${dim}  Watcher encerrado.${reset}`);
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
    console.error(`Diretorio .logs/ nao encontrado em: ${cwd}`);
    console.error('');
    console.error('Este projeto precisa ter os hooks AIOS/AIOX com logging ativo.');
    console.error('Use o hook-fix-pack para instalar os hooks com hookLog().');
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
    console.error('Nenhum log de hook encontrado em .logs/');
    console.error('Esperados: rw-context-log-full.log, rw-synapse-trace.log, rw-hooks-log.log');
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
  console.log('  Monitora em tempo real o que os hooks AIOS/AIOX injetam no contexto');
  console.log('  da sessao Claude Code. Le os logs de hook em .logs/');
  console.log('');
  console.log(`  ${bold}IMPORTANTE:${reset} O JSONL do Claude NAO armazena as injecoes de contexto.`);
  console.log('  Elas sao efemeras (existem apenas no request da API). A unica forma');
  console.log('  de captura-las e via os logs de hook.');
  console.log('');
  console.log(`  ${bold}Uso:${reset}`);
  console.log('    node watch-context.js                 # Menu interativo (setas + Enter)');
  console.log('    node watch-context.js --log full      # Apenas context completo');
  console.log('    node watch-context.js --log synapse   # Apenas synapse-rules');
  console.log('    node watch-context.js --log hooks     # Apenas metricas resumidas');
  console.log('    node watch-context.js --since 5m      # Ultimos 5 minutos');
  console.log('    node watch-context.js --since 1h      # Ultima hora');
  console.log('    node watch-context.js --cwd /path     # Outro projeto');
  console.log('    node watch-context.js --no-color      # Sem cores ANSI');
  console.log('');
  console.log(`  ${bold}Menu interativo:${reset}`);
  console.log('    Sem argumentos, abre um menu com setas para escolher:');
  console.log('      1. Qual log monitorar (todos, context, synapse, hooks)');
  console.log('      2. Periodo de tempo (live, 5m, 15m, 30m, 1h)');
  console.log('');
  console.log(`  ${bold}Logs monitorados:${reset}`);
  console.log(`    ${C.cyan()}[CONTEXT]${reset}  rw-context-log-full.log  — Output completo do hook`);
  console.log(`    ${C.magenta()}[SYNAPSE]${reset}  rw-synapse-trace.log    — Synapse-rules XML`);
  console.log(`    ${C.yellow()}[HOOKS]${reset}    rw-hooks-log.log        — Metricas resumidas`);
  console.log('');
  console.log(`  ${bold}Dica:${reset} Abra num terminal separado enquanto usa o Claude Code.`);
  console.log(`  ${dim}Cada prompt que voce envia dispara os hooks e gera novas entradas.${reset}`);
  console.log('');
}

main();
