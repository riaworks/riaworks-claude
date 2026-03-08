'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ===========================================================================
// watch-context.js — Monitor de contexto injetado pelo Claude Code
//
// Faz tail-follow no JSONL da sessao ativa e filtra apenas o conteudo
// injetado no contexto: system-reminders, synapse-rules, hook outputs,
// CLAUDE.md, rules, etc.
//
// Uso:
//   node watch-context.js                # Monitora sessao ativa do projeto (cwd)
//   node watch-context.js --cwd /path    # Monitora outro projeto
//   node watch-context.js --all          # Mostra TUDO (nao filtra)
//   node watch-context.js --raw          # Mostra JSON cru dos blocos injetados
//   node watch-context.js --no-color     # Sem cores ANSI
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
  bgBlue: () => useColor ? '\x1b[44m' : '',
  bgMagenta: () => useColor ? '\x1b[45m' : '',
};

// ── Cross-platform path resolution (shared with read-transcript) ────────────

function resolveClaudeProjectsDir() {
  const candidates = [];

  if (process.env.CLAUDE_PROJECTS_DIR) {
    candidates.push({ dir: process.env.CLAUDE_PROJECTS_DIR, source: 'env' });
  }

  candidates.push({
    dir: path.join(os.homedir(), '.claude', 'projects'),
    source: 'homedir',
  });

  if (process.env.APPDATA) {
    candidates.push({
      dir: path.join(process.env.APPDATA, '.claude', 'projects'),
      source: 'APPDATA',
    });
  }

  if (process.env.LOCALAPPDATA) {
    candidates.push({
      dir: path.join(process.env.LOCALAPPDATA, '.claude', 'projects'),
      source: 'LOCALAPPDATA',
    });
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate.dir) && fs.statSync(candidate.dir).isDirectory()) {
        return candidate;
      }
    } catch { /* skip */ }
  }

  return null;
}

function cwdToProjectHash(dir) {
  return path.resolve(dir).replace(/[^a-zA-Z0-9]/g, '-');
}

function resolveProjectDir(claudeProjectsDir, projectHash) {
  const exact = path.join(claudeProjectsDir, projectHash);
  if (fs.existsSync(exact)) return exact;

  try {
    const dirs = fs.readdirSync(claudeProjectsDir);
    const match = dirs.find((d) => d === projectHash)
      || dirs.find((d) => d.startsWith(projectHash));
    if (match) return path.join(claudeProjectsDir, match);
  } catch { /* skip */ }

  return null;
}

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

// ── Context extraction ──────────────────────────────────────────────────────

/**
 * Extrai blocos de contexto injetado de uma linha JSONL.
 * Retorna array de objetos { type, source, content }.
 */
function extractInjectedContext(jsonLine) {
  let d;
  try {
    d = JSON.parse(jsonLine);
  } catch {
    return [];
  }

  const results = [];
  const ts = d.timestamp ? toLocalTime(new Date(d.timestamp)) : '';

  // Skip non-relevant types
  if (d.type === 'file-history-snapshot') return [];

  const contentItems = getContentItems(d);

  for (const item of contentItems) {
    const text = item.text || item.content || '';
    if (typeof text !== 'string') continue;

    // ── system-reminder blocks ──
    const sysReminderRegex = /<system-reminder>([\s\S]*?)<\/system-reminder>/g;
    let match;
    while ((match = sysReminderRegex.exec(text)) !== null) {
      const body = match[1].trim();
      const source = classifySystemReminder(body);
      results.push({ type: 'system-reminder', source, content: body, ts });
    }

    // ── synapse-rules blocks ──
    const synapseRegex = /<synapse-rules>([\s\S]*?)<\/synapse-rules>/g;
    while ((match = synapseRegex.exec(text)) !== null) {
      results.push({ type: 'synapse-rules', source: 'synapse-engine', content: match[1].trim(), ts });
    }

    // ── claudeMd / CLAUDE.md injection ──
    if (text.includes('Contents of') && text.includes('CLAUDE.md')) {
      const claudeMdMatch = text.match(/Contents of ([^\n]+CLAUDE\.md)[^\n]*:\n([\s\S]*?)(?=\nContents of |\n# |\Z)/);
      if (claudeMdMatch) {
        results.push({ type: 'claude-md', source: claudeMdMatch[1], content: claudeMdMatch[2].slice(0, 500) + '...', ts });
      }
    }

    // ── Rules files injection ──
    if (text.includes('Contents of') && text.includes('.claude/rules/')) {
      const rulesRegex = /Contents of ([^\n]+\.claude\/rules\/[^\n]+):\n([\s\S]*?)(?=\nContents of |\n#|\Z)/g;
      while ((match = rulesRegex.exec(text)) !== null) {
        results.push({ type: 'rule-file', source: match[1], content: match[2].slice(0, 300) + '...', ts });
      }
    }

    // ── Hook output (UserPromptSubmit) ──
    if (text.includes('UserPromptSubmit hook')) {
      const hookMatch = text.match(/UserPromptSubmit hook (success|error|additional context):\s*([\s\S]*?)(?=<|$)/);
      if (hookMatch) {
        results.push({ type: 'hook-output', source: `UserPromptSubmit:${hookMatch[1]}`, content: hookMatch[2].trim().slice(0, 200), ts });
      }
    }

    // ── PreCompact hook ──
    if (text.includes('PreCompact')) {
      results.push({ type: 'hook-output', source: 'PreCompact', content: text.slice(0, 200), ts });
    }
  }

  return results;
}

/**
 * Extrai items de conteudo de uma entrada JSONL.
 */
function getContentItems(d) {
  if (!d.message) return [];
  const content = d.message.content;
  if (typeof content === 'string') return [{ text: content }];
  if (Array.isArray(content)) return content;
  return [];
}

/**
 * Classifica o tipo de system-reminder pelo conteudo.
 */
function classifySystemReminder(body) {
  if (body.includes('synapse-rules')) return 'synapse-engine';
  if (body.includes('UserPromptSubmit hook')) return 'hook:UserPromptSubmit';
  if (body.includes('PreCompact')) return 'hook:PreCompact';
  if (body.includes('CLAUDE.md')) return 'claude-md';
  if (body.includes('.claude/rules/')) return 'rules-file';
  if (body.includes('task tools')) return 'task-reminder';
  if (body.includes('skill')) return 'skills-list';
  if (body.includes('Available skills')) return 'skills-list';
  if (body.includes('currentDate')) return 'system-info';
  if (body.includes('gitStatus')) return 'git-status';
  return 'unknown';
}

// ── Display ─────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  'system-reminder': C.yellow,
  'synapse-rules': C.cyan,
  'claude-md': C.green,
  'rule-file': C.blue,
  'hook-output': C.magenta,
};

const TYPE_ICONS = {
  'system-reminder': 'SYS',
  'synapse-rules': 'SYN',
  'claude-md': 'CMD',
  'rule-file': 'RUL',
  'hook-output': 'HOK',
};

function printContextBlock(block, rawMode) {
  const color = (TYPE_COLORS[block.type] || C.white)();
  const icon = TYPE_ICONS[block.type] || '???';
  const reset = C.reset();
  const dim = C.dim();
  const bold = C.bold();

  if (rawMode) {
    console.log(JSON.stringify(block, null, 2));
    return;
  }

  const header = `${dim}${block.ts}${reset} ${color}${bold}[${icon}]${reset} ${color}${block.source}${reset}`;
  console.log(header);

  // Format content with indentation
  const lines = block.content.split('\n');
  const maxLines = 30;
  const preview = lines.slice(0, maxLines);

  for (const line of preview) {
    console.log(`${dim}  │${reset} ${line}`);
  }

  if (lines.length > maxLines) {
    console.log(`${dim}  │ ... (+${lines.length - maxLines} linhas)${reset}`);
  }

  console.log('');
}

function printSeparator() {
  const dim = C.dim();
  const reset = C.reset();
  console.log(`${dim}${'─'.repeat(70)}${reset}`);
}

// ── File watcher (tail -f) ──────────────────────────────────────────────────

/**
 * Faz tail-follow num arquivo JSONL.
 * Usa fs.watchFile (polling) por compatibilidade cross-platform.
 *
 * @param {string} filePath
 * @param {object} opts
 * @param {boolean} opts.showAll
 * @param {boolean} opts.rawMode
 */
function tailFollow(filePath, opts) {
  const { showAll, rawMode } = opts;

  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch { /* file may not exist yet */ }

  let lineBuffer = '';

  function processNewData() {
    let currentSize;
    try {
      currentSize = fs.statSync(filePath).size;
    } catch {
      return;
    }

    if (currentSize <= fileSize) return;

    // Read only the new bytes
    const fd = fs.openSync(filePath, 'r');
    const bytesToRead = currentSize - fileSize;
    const buf = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buf, 0, bytesToRead, fileSize);
    fs.closeSync(fd);

    fileSize = currentSize;

    // Process line by line
    const chunk = lineBuffer + buf.toString('utf8');
    const lines = chunk.split('\n');

    // Last element might be incomplete — save for next read
    lineBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      if (showAll) {
        // Show everything parsed
        let d;
        try {
          d = JSON.parse(line);
        } catch {
          continue;
        }
        if (d.type === 'file-history-snapshot') continue;

        const ts = d.timestamp ? toLocalTime(new Date(d.timestamp)) : '';
        const role = d.type || '?';
        const dim = C.dim();
        const reset = C.reset();
        const bold = C.bold();

        if (role === 'user') {
          console.log(`${dim}${ts}${reset} ${C.green()}${bold}[USER]${reset}`);
        } else if (role === 'assistant') {
          console.log(`${dim}${ts}${reset} ${C.cyan()}${bold}[ASSISTANT]${reset}`);
        }
      }

      const blocks = extractInjectedContext(line);
      if (blocks.length > 0) {
        printSeparator();
        for (const block of blocks) {
          printContextBlock(block, rawMode);
        }
      }
    }
  }

  // Poll interval — 500ms is responsive without being wasteful
  const POLL_MS = 500;
  const watcher = setInterval(processNewData, POLL_MS);

  // Also do initial check
  processNewData();

  return { stop: () => clearInterval(watcher) };
}

// ── Find active session ─────────────────────────────────────────────────────

/**
 * Encontra o JSONL da sessao mais recente de um projeto.
 *
 * @param {string} projectDir
 * @returns {{ filePath: string, sessionId: string } | null}
 */
function findActiveSession(projectDir) {
  let files;
  try {
    files = fs.readdirSync(projectDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(projectDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return null;
  }

  if (files.length === 0) return null;

  return {
    filePath: path.join(projectDir, files[0].name),
    sessionId: files[0].name.replace('.jsonl', ''),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let showAll = false;
  let rawMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      showAll = true;
    } else if (args[i] === '--raw') {
      rawMode = true;
    } else if (args[i] === '--no-color') {
      useColor = false;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Resolve Claude projects dir
  const resolved = resolveClaudeProjectsDir();
  if (!resolved) {
    console.error('Nao foi possivel encontrar o diretorio de projetos do Claude Code.');
    console.error(`Verificado: ${path.join(os.homedir(), '.claude', 'projects')}`);
    process.exit(1);
  }

  // Resolve project
  const projectHash = cwdToProjectHash(cwd);
  const projectDir = resolveProjectDir(resolved.dir, projectHash);

  if (!projectDir) {
    console.error(`Projeto nao encontrado para: ${cwd}`);
    console.error(`Hash: ${projectHash}`);
    process.exit(1);
  }

  // Find active session
  const session = findActiveSession(projectDir);
  if (!session) {
    console.error('Nenhuma sessao encontrada.');
    process.exit(1);
  }

  // Print header
  const dim = C.dim();
  const bold = C.bold();
  const cyan = C.cyan();
  const reset = C.reset();

  console.log('');
  console.log(`${cyan}${bold}  ╔══════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}${bold}  ║        Claude Context Watcher                           ║${reset}`);
  console.log(`${cyan}${bold}  ║        by RIAWORKS                                      ║${reset}`);
  console.log(`${cyan}${bold}  ╚══════════════════════════════════════════════════════════╝${reset}`);
  console.log('');
  console.log(`  ${dim}Sessao:${reset}    ${session.sessionId}`);
  console.log(`  ${dim}Projeto:${reset}   ${projectHash.slice(0, 50)}`);
  console.log(`  ${dim}Arquivo:${reset}   ${session.filePath}`);
  console.log(`  ${dim}Timezone:${reset}  ${getGMTLabel()}`);
  console.log(`  ${dim}Modo:${reset}      ${showAll ? 'ALL (tudo)' : 'CONTEXT (apenas injecoes)'}`);
  console.log('');
  console.log(`  ${dim}Monitorando... (Ctrl+C para parar)${reset}`);
  console.log('');
  printSeparator();

  // Start tailing
  const watcher = tailFollow(session.filePath, { showAll, rawMode });

  // Graceful shutdown
  process.on('SIGINT', () => {
    watcher.stop();
    console.log('');
    console.log(`${dim}  Watcher encerrado.${reset}`);
    process.exit(0);
  });

  // Keep alive
  process.stdin.resume();
}

function printHelp() {
  const bold = C.bold();
  const reset = C.reset();
  const dim = C.dim();

  console.log('');
  console.log(`${bold}  Claude Context Watcher${reset} — by RIAWORKS`);
  console.log('');
  console.log('  Monitora em tempo real o que o Claude Code injeta no contexto');
  console.log('  da sessao (system-reminders, synapse-rules, hooks, CLAUDE.md, rules).');
  console.log('');
  console.log(`  ${bold}Uso:${reset}`);
  console.log('    node watch-context.js                # Monitora sessao ativa (cwd)');
  console.log('    node watch-context.js --cwd /path    # Monitora outro projeto');
  console.log('    node watch-context.js --all          # Mostra tudo, nao so injecoes');
  console.log('    node watch-context.js --raw          # JSON cru dos blocos');
  console.log('    node watch-context.js --no-color     # Sem cores ANSI');
  console.log('');
  console.log(`  ${bold}Legenda:${reset}`);
  console.log(`    ${C.yellow()}[SYS]${reset} system-reminder      ${C.cyan()}[SYN]${reset} synapse-rules`);
  console.log(`    ${C.green()}[CMD]${reset} CLAUDE.md             ${C.blue()}[RUL]${reset} rules file`);
  console.log(`    ${C.magenta()}[HOK]${reset} hook output`);
  console.log('');
  console.log(`  ${dim}Dica: abra num terminal separado enquanto usa o Claude Code.${reset}`);
  console.log('');
}

main();
