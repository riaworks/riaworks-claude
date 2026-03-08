'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ===========================================================================
// read-transcript.js — Leitor de transcripts do Claude Code
//
// Cross-platform: Windows, macOS, Linux.
// Detecta automaticamente onde o Claude Code armazena sessoes.
//
// Uso:
//   node read-transcript.js                    # Menu interativo
//   node read-transcript.js <session-id>       # Le sessao do projeto atual
//   node read-transcript.js last               # Le a sessao mais recente
//   node read-transcript.js --cwd /path/to/dir # Usa outro diretorio como projeto
//   node read-transcript.js --full <id>        # Mostra conteudo completo
//
// By RIAWORKS
// ===========================================================================

// ── Cross-platform Claude projects path resolution ──────────────────────────

/**
 * Resolve o diretorio base onde o Claude Code armazena projetos.
 * Testa caminhos conhecidos em ordem de prioridade:
 *   1. $CLAUDE_PROJECTS_DIR (env override)
 *   2. ~/.claude/projects/         (macOS, Linux, Windows Git Bash / MSYS)
 *   3. %APPDATA%\.claude\projects\ (Windows nativo)
 *   4. %USERPROFILE%\.claude\projects\ (Windows fallback)
 *
 * @returns {{ dir: string, source: string } | null}
 */
function resolveClaudeProjectsDir() {
  const candidates = [];

  // 1. Env override
  if (process.env.CLAUDE_PROJECTS_DIR) {
    candidates.push({
      dir: process.env.CLAUDE_PROJECTS_DIR,
      source: 'env:CLAUDE_PROJECTS_DIR',
    });
  }

  // 2. ~/.claude/projects (universal — works on all platforms via os.homedir)
  candidates.push({
    dir: path.join(os.homedir(), '.claude', 'projects'),
    source: 'homedir',
  });

  // 3. %APPDATA% (Windows nativo — C:\Users\X\AppData\Roaming)
  if (process.env.APPDATA) {
    candidates.push({
      dir: path.join(process.env.APPDATA, '.claude', 'projects'),
      source: 'APPDATA',
    });
  }

  // 4. %LOCALAPPDATA% (Windows — C:\Users\X\AppData\Local)
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
    } catch {
      // permission denied or similar — skip
    }
  }

  return null;
}

/**
 * Converte um cwd em project hash do Claude Code.
 * O Claude Code substitui todos os caracteres nao-alfanumericos por "-".
 *
 * @param {string} dir
 * @returns {string}
 */
function cwdToProjectHash(dir) {
  return path.resolve(dir).replace(/[^a-zA-Z0-9]/g, '-');
}

// ── Data helpers ────────────────────────────────────────────────────────────

/**
 * Lista todos os projetos disponiveis no diretorio do Claude.
 *
 * @param {string} claudeProjectsDir
 * @returns {Array<{ hash: string, sessionCount: number, lastModified: Date }>}
 */
function listAllProjects(claudeProjectsDir) {
  const entries = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectPath = path.join(claudeProjectsDir, entry.name);
    try {
      const files = fs.readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'));
      if (files.length === 0) continue;

      let lastModified = new Date(0);
      for (const f of files) {
        const stat = fs.statSync(path.join(projectPath, f));
        if (stat.mtime > lastModified) lastModified = stat.mtime;
      }

      projects.push({
        hash: entry.name,
        sessionCount: files.length,
        lastModified,
      });
    } catch {
      // skip unreadable dirs
    }
  }

  return projects.sort((a, b) => b.lastModified - a.lastModified);
}

/**
 * Lista sessoes de um projeto.
 *
 * @param {string} projectDir
 * @returns {Array<{ id: string, modified: Date, size: number, firstPrompt: string }>}
 */
function getProjectSessions(projectDir) {
  const files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));

  return files.map((f) => {
    const fullPath = path.join(projectDir, f);
    const stat = fs.statSync(fullPath);
    const id = f.replace('.jsonl', '');

    let firstPrompt = '';
    try {
      const handle = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(8192);
      fs.readSync(handle, buf, 0, 8192, 0);
      fs.closeSync(handle);
      const chunk = buf.toString('utf8');
      const jsonLines = chunk.split('\n').filter(Boolean);
      for (let j = 0; j < jsonLines.length && j < 10; j++) {
        try {
          const d = JSON.parse(jsonLines[j]);
          if (d.type === 'user' && d.message) {
            const content = d.message.content;
            if (typeof content === 'string') {
              firstPrompt = content.slice(0, 80).replace(/\n/g, ' ').trim();
              break;
            }
            if (Array.isArray(content)) {
              const textItem = content.find((c) => c.type === 'text' && c.text);
              if (textItem) {
                firstPrompt = textItem.text.slice(0, 80).replace(/\n/g, ' ').trim();
                break;
              }
            }
          }
        } catch { /* skip malformed line */ }
      }
    } catch { /* skip unreadable file */ }

    return { id, modified: stat.mtime, size: stat.size, firstPrompt };
  }).sort((a, b) => b.modified - a.modified);
}

/**
 * Formata tamanho em bytes para legivel.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formata Date para string local HH:MM.
 *
 * @param {Date} date
 * @returns {string}
 */
function toLocalTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formata Date para string local YYYY-MM-DD HH:MM:SS.
 *
 * @param {Date} date
 * @returns {string}
 */
function toLocalDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Retorna o offset GMT local formatado (ex: "GMT-3", "GMT+5:30").
 *
 * @returns {string}
 */
function getGMTLabel() {
  const offsetMin = new Date().getTimezoneOffset();
  const sign = offsetMin <= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return m > 0 ? `GMT${sign}${h}:${String(m).padStart(2, '0')}` : `GMT${sign}${h}`;
}

/**
 * Formata timestamp ISO para display compacto com hora local.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  const time = toLocalTime(date);
  const dateStr = toLocalDateTime(date).slice(0, 10);

  if (days === 0) return `hoje ${time}`;
  if (days === 1) return `ontem ${time}`;
  if (days < 7) return `${days}d atras ${time}`;
  return `${dateStr} ${time}`;
}

// ── Interactive menu ────────────────────────────────────────────────────────

/**
 * Cria interface readline para input interativo.
 *
 * @returns {readline.Interface}
 */
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt interativo com validacao.
 *
 * @param {readline.Interface} rl
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Exibe header do menu.
 */
function printHeader() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║        Claude Code Transcript Reader                    ║');
  console.log('  ║        by RIAWORKS                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Menu principal interativo.
 *
 * @param {string} claudeProjectsDir
 * @param {string} source
 */
async function interactiveMenu(claudeProjectsDir, source) {
  const rl = createRL();

  printHeader();
  console.log(`  Claude projects: ${claudeProjectsDir}`);
  console.log(`  Detectado via:   ${source}`);
  console.log(`  Plataforma:      ${os.platform()} (${os.arch()})`);
  console.log(`  Fuso horario:    ${getGMTLabel()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log('  │  1. Listar projetos                                  │');
  console.log('  │  2. Sessoes do projeto atual (cwd)                   │');
  console.log('  │  3. Ler ultima sessao do projeto atual               │');
  console.log('  │  4. Buscar sessao por texto do prompt                │');
  console.log('  │  0. Sair                                             │');
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log('');

  const choice = await ask(rl, '  Opcao: ');

  switch (choice) {
    case '1':
      await menuListProjects(rl, claudeProjectsDir);
      break;
    case '2':
      await menuProjectSessions(rl, claudeProjectsDir, process.cwd());
      break;
    case '3': {
      const projectHash = cwdToProjectHash(process.cwd());
      const projectDir = resolveProjectDir(claudeProjectsDir, projectHash);
      if (!projectDir) {
        console.log(`\n  Projeto nao encontrado para: ${process.cwd()}`);
        console.log(`  Hash: ${projectHash}\n`);
        rl.close();
        return;
      }
      const sessions = getProjectSessions(projectDir);
      if (sessions.length === 0) {
        console.log('\n  Nenhuma sessao encontrada.\n');
        rl.close();
        return;
      }
      rl.close();
      renderTranscript(path.join(projectDir, sessions[0].id + '.jsonl'), sessions[0].id, projectHash, false);
      return;
    }
    case '4':
      await menuSearchPrompt(rl, claudeProjectsDir);
      break;
    case '0':
      rl.close();
      return;
    default:
      console.log('\n  Opcao invalida.\n');
  }

  rl.close();
}

/**
 * Menu: listar todos os projetos e permitir selecionar.
 */
async function menuListProjects(rl, claudeProjectsDir) {
  const projects = listAllProjects(claudeProjectsDir);

  if (projects.length === 0) {
    console.log('\n  Nenhum projeto encontrado.\n');
    return;
  }

  console.log('');
  console.log('  ── Projetos ──────────────────────────────────────────────');
  console.log('');

  const pageSize = 15;
  const page = projects.slice(0, pageSize);

  page.forEach((p, i) => {
    const num = String(i + 1).padStart(3);
    const sessions = String(p.sessionCount).padStart(3);
    const date = formatDate(p.lastModified);
    // Decodifica o hash para algo legivel
    const readable = p.hash.replace(/^[A-Z]---/, '').replace(/-/g, '/').slice(0, 45);
    console.log(`  ${num}. ${readable}`);
    console.log(`       ${sessions} sessoes | ${date}`);
  });

  if (projects.length > pageSize) {
    console.log(`\n  ... e mais ${projects.length - pageSize} projetos`);
  }

  console.log('');
  const choice = await ask(rl, '  Numero do projeto (ou Enter para voltar): ');

  if (!choice) return;

  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= page.length) {
    console.log('  Opcao invalida.');
    return;
  }

  const selected = page[idx];
  const projectDir = path.join(claudeProjectsDir, selected.hash);
  await menuSelectSession(rl, projectDir, selected.hash);
}

/**
 * Menu: sessoes do projeto baseado no cwd.
 */
async function menuProjectSessions(rl, claudeProjectsDir, cwd) {
  const projectHash = cwdToProjectHash(cwd);
  const projectDir = resolveProjectDir(claudeProjectsDir, projectHash);

  if (!projectDir) {
    console.log(`\n  Projeto nao encontrado para: ${cwd}`);
    console.log(`  Hash calculado: ${projectHash}`);
    console.log('');
    console.log('  Projetos disponiveis (use opcao 1 do menu):');
    const projects = listAllProjects(claudeProjectsDir).slice(0, 5);
    projects.forEach((p) => {
      console.log(`    ${p.hash}`);
    });
    console.log('');
    return;
  }

  await menuSelectSession(rl, projectDir, projectHash);
}

/**
 * Menu: selecionar e ler uma sessao.
 */
async function menuSelectSession(rl, projectDir, projectHash) {
  const sessions = getProjectSessions(projectDir);

  if (sessions.length === 0) {
    console.log('\n  Nenhuma sessao encontrada.\n');
    return;
  }

  console.log('');
  console.log(`  ── Sessoes de ${projectHash.slice(0, 50)} ──`);
  console.log('');

  const pageSize = 20;
  const page = sessions.slice(0, pageSize);

  page.forEach((s, i) => {
    const num = String(i + 1).padStart(3);
    const date = formatDate(s.modified);
    const size = formatSize(s.size);
    const prompt = s.firstPrompt ? `"${s.firstPrompt}"` : '(sem prompt)';
    console.log(`  ${num}. ${date} | ${size.padStart(8)} | ${prompt}`);
  });

  if (sessions.length > pageSize) {
    console.log(`\n  ... e mais ${sessions.length - pageSize} sessoes`);
  }

  console.log('');
  const choice = await ask(rl, '  Numero da sessao (ou Enter para voltar): ');

  if (!choice) return;

  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= page.length) {
    console.log('  Opcao invalida.');
    return;
  }

  const selected = page[idx];

  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log('  │  1. Visualizar (truncado)                            │');
  console.log('  │  2. Visualizar (completo)                            │');
  console.log('  │  3. Apenas mensagens do usuario                      │');
  console.log('  │  4. Apenas tool calls                                │');
  console.log('  │  5. Estatisticas da sessao                           │');
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log('');

  const viewChoice = await ask(rl, '  Opcao: ');
  const filePath = path.join(projectDir, selected.id + '.jsonl');

  rl.close();

  switch (viewChoice) {
    case '1':
      renderTranscript(filePath, selected.id, projectHash, false);
      break;
    case '2':
      renderTranscript(filePath, selected.id, projectHash, true);
      break;
    case '3':
      renderTranscript(filePath, selected.id, projectHash, false, 'user');
      break;
    case '4':
      renderTranscript(filePath, selected.id, projectHash, false, 'tools');
      break;
    case '5':
      renderStats(filePath, selected.id, projectHash);
      break;
    default:
      renderTranscript(filePath, selected.id, projectHash, false);
  }
}

/**
 * Menu: buscar sessoes por texto do prompt.
 */
async function menuSearchPrompt(rl, claudeProjectsDir) {
  const query = await ask(rl, '\n  Texto para buscar nos prompts: ');
  if (!query) return;

  const queryLower = query.toLowerCase();
  const projects = listAllProjects(claudeProjectsDir);
  const results = [];

  console.log('\n  Buscando...');

  for (const project of projects) {
    const projectDir = path.join(claudeProjectsDir, project.hash);
    const sessions = getProjectSessions(projectDir);

    for (const session of sessions) {
      if (session.firstPrompt.toLowerCase().includes(queryLower)) {
        results.push({
          project: project.hash,
          projectDir,
          session,
        });
      }
      if (results.length >= 20) break;
    }
    if (results.length >= 20) break;
  }

  if (results.length === 0) {
    console.log('  Nenhum resultado encontrado.\n');
    return;
  }

  console.log(`\n  ── ${results.length} resultado(s) ──\n`);

  results.forEach((r, i) => {
    const num = String(i + 1).padStart(3);
    const date = formatDate(r.session.modified);
    const proj = r.project.replace(/^[A-Z]---/, '').replace(/-/g, '/').slice(0, 30);
    console.log(`  ${num}. [${proj}] ${date}`);
    console.log(`       "${r.session.firstPrompt}"`);
  });

  console.log('');
  const choice = await ask(rl, '  Numero para abrir (ou Enter para voltar): ');

  if (!choice) return;

  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= results.length) {
    console.log('  Opcao invalida.');
    return;
  }

  const selected = results[idx];
  const filePath = path.join(selected.projectDir, selected.session.id + '.jsonl');

  rl.close();
  renderTranscript(filePath, selected.session.id, selected.project, false);
}

// ── Project resolution ──────────────────────────────────────────────────────

/**
 * Resolve o diretorio de um projeto, com fallback para match parcial.
 *
 * @param {string} claudeProjectsDir
 * @param {string} projectHash
 * @returns {string | null}
 */
function resolveProjectDir(claudeProjectsDir, projectHash) {
  const exact = path.join(claudeProjectsDir, projectHash);
  if (fs.existsSync(exact)) return exact;

  try {
    const dirs = fs.readdirSync(claudeProjectsDir);
    const match = dirs.find((d) => d === projectHash)
      || dirs.find((d) => d.startsWith(projectHash));
    if (match) return path.join(claudeProjectsDir, match);
  } catch { /* dir not readable */ }

  return null;
}

// ── Transcript rendering ────────────────────────────────────────────────────

/**
 * Renderiza o transcript de uma sessao.
 *
 * @param {string} filePath
 * @param {string} sessionId
 * @param {string} projectHash
 * @param {boolean} fullMode
 * @param {string} [filter] - 'user' | 'tools' | undefined (all)
 */
function renderTranscript(filePath, sessionId, projectHash, fullMode, filter) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const previewLimit = fullMode ? 999999 : 200;

  console.log('');
  console.log('═'.repeat(80));
  console.log(`  TRANSCRIPT: ${sessionId}`);
  console.log(`  Projeto:    ${projectHash}`);
  console.log(`  Linhas:     ${lines.length}`);
  console.log(`  Timezone:   ${getGMTLabel()}`);
  if (fullMode) console.log('  Modo:       FULL (sem truncamento)');
  if (filter) console.log(`  Filtro:     ${filter}`);
  console.log('═'.repeat(80));
  console.log('');

  for (let idx = 0; idx < lines.length; idx++) {
    let d;
    try {
      d = JSON.parse(lines[idx]);
    } catch {
      continue;
    }

    const t = d.type || '';
    if (t === 'file-history-snapshot') continue;

    const ts = d.timestamp ? toLocalDateTime(new Date(d.timestamp)) : '';
    const content = d.message && d.message.content;
    const lineNum = `L${String(idx + 1).padStart(4)}`;

    // ── USER messages ──
    if (t === 'user' && filter !== 'tools') {
      if (typeof content === 'string') {
        const preview = fullMode ? content : content.slice(0, previewLimit).replace(/\n/g, ' ');
        console.log(`${lineNum} │ ${ts} │ USER [str]`);
        console.log(`       ${preview}`);
        if (!fullMode && content.length > previewLimit) {
          console.log(`       ... (${content.length} chars total)`);
        }
        console.log('');
      } else if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'text') {
            const text = item.text || '';
            const preview = fullMode ? text : text.slice(0, previewLimit).replace(/\n/g, ' ');
            console.log(`${lineNum} │ ${ts} │ USER [text]`);
            console.log(`       ${preview}`);
            if (!fullMode && text.length > previewLimit) {
              console.log(`       ... (${text.length} chars total)`);
            }
            console.log('');
          } else if (item.type === 'tool_result' && filter !== 'user') {
            const resultContent = String(item.content || '');
            const preview = fullMode ? resultContent : resultContent.slice(0, 100).replace(/\n/g, ' ');
            console.log(`${lineNum} │ ${ts} │ USER [tool_result]`);
            console.log(`       ${preview}`);
            if (!fullMode && resultContent.length > 100) {
              console.log(`       ... (${resultContent.length} chars total)`);
            }
            console.log('');
          }
        }
      }
    }

    // ── ASSISTANT messages ──
    if (t === 'assistant' && Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'text' && item.text && filter !== 'tools') {
          const preview = fullMode ? item.text : item.text.slice(0, previewLimit).replace(/\n/g, ' ');
          console.log(`${lineNum} │ ${ts} │ ASSISTANT [text]`);
          console.log(`       ${preview}`);
          if (!fullMode && item.text.length > previewLimit) {
            console.log(`       ... (${item.text.length} chars total)`);
          }
          console.log('');
        } else if (item.type === 'tool_use' && filter !== 'user') {
          const inputPreview = JSON.stringify(item.input || {}).slice(0, fullMode ? 999999 : 120);
          console.log(`${lineNum} │ ${ts} │ ASSISTANT [tool_use] ${item.name || '?'}`);
          console.log(`       input: ${inputPreview}`);
          console.log('');
        } else if (item.type === 'thinking' && filter !== 'tools') {
          const thinking = item.thinking || '';
          const preview = fullMode ? thinking : thinking.slice(0, 150).replace(/\n/g, ' ');
          console.log(`${lineNum} │ ${ts} │ ASSISTANT [thinking]`);
          console.log(`       ${preview}`);
          if (!fullMode && thinking.length > 150) {
            console.log(`       ... (${thinking.length} chars total)`);
          }
          console.log('');
        }
      }
    }
  }
}

/**
 * Renderiza estatisticas de uma sessao.
 *
 * @param {string} filePath
 * @param {string} sessionId
 * @param {string} projectHash
 */
function renderStats(filePath, sessionId, projectHash) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const stat = fs.statSync(filePath);

  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let thinkingBlocks = 0;
  let totalUserChars = 0;
  let totalAssistantChars = 0;
  let totalThinkingChars = 0;
  const toolNames = {};
  let firstTs = null;
  let lastTs = null;

  for (const line of lines) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = d.timestamp;
    if (ts && !firstTs) firstTs = ts;
    if (ts) lastTs = ts;

    if (d.type === 'user') {
      userMessages++;
      const content = d.message && d.message.content;
      if (typeof content === 'string') totalUserChars += content.length;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'text' && item.text) totalUserChars += item.text.length;
        }
      }
    }

    if (d.type === 'assistant' && Array.isArray(d.message?.content)) {
      assistantMessages++;
      for (const item of d.message.content) {
        if (item.type === 'text' && item.text) totalAssistantChars += item.text.length;
        if (item.type === 'tool_use') {
          toolCalls++;
          const name = item.name || 'unknown';
          toolNames[name] = (toolNames[name] || 0) + 1;
        }
        if (item.type === 'thinking') {
          thinkingBlocks++;
          totalThinkingChars += (item.thinking || '').length;
        }
      }
    }
  }

  // Duration
  let duration = '';
  if (firstTs && lastTs) {
    const diffMs = new Date(lastTs) - new Date(firstTs);
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      duration = `${hours}h ${mins % 60}m`;
    } else {
      duration = `${mins}m`;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`  STATS: ${sessionId}`);
  console.log(`  Projeto: ${projectHash}`);
  console.log(`  Timezone: ${getGMTLabel()}`);
  console.log('═'.repeat(60));
  console.log('');
  console.log(`  Arquivo:           ${formatSize(stat.size)}`);
  console.log(`  Linhas JSONL:      ${lines.length}`);
  console.log(`  Duracao:           ${duration || 'N/A'}`);
  console.log('');
  console.log('  ── Mensagens ──');
  console.log(`  User:              ${userMessages} (${formatSize(totalUserChars)})`);
  console.log(`  Assistant:         ${assistantMessages} (${formatSize(totalAssistantChars)})`);
  console.log(`  Thinking blocks:   ${thinkingBlocks} (${formatSize(totalThinkingChars)})`);
  console.log(`  Tool calls:        ${toolCalls}`);
  console.log('');

  const sortedTools = Object.entries(toolNames).sort((a, b) => b[1] - a[1]);
  if (sortedTools.length > 0) {
    console.log('  ── Tools usadas ──');
    for (const [name, count] of sortedTools) {
      console.log(`  ${String(count).padStart(5)}x  ${name}`);
    }
    console.log('');
  }
}

// ── CLI entry point ─────────────────────────────────────────────────────────

function main() {
  // Parse args
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let sessionId = null;
  let fullMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    } else if (args[i] === '--full') {
      fullMode = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHeader();
      console.log('  Uso:');
      console.log('    node read-transcript.js                    # Menu interativo');
      console.log('    node read-transcript.js <session-id>       # Le sessao do projeto atual');
      console.log('    node read-transcript.js last               # Sessao mais recente');
      console.log('    node read-transcript.js --cwd /path <id>   # Outro projeto');
      console.log('    node read-transcript.js --full <id>        # Sem truncamento');
      console.log('');
      process.exit(0);
    } else if (!sessionId) {
      sessionId = args[i];
    }
  }

  // Resolve Claude projects directory
  const resolved = resolveClaudeProjectsDir();
  if (!resolved) {
    console.error('Nao foi possivel encontrar o diretorio de projetos do Claude Code.');
    console.error('');
    console.error('Locais verificados:');
    console.error(`  ~/.claude/projects/ (${path.join(os.homedir(), '.claude', 'projects')})`);
    if (process.env.APPDATA) {
      console.error(`  %APPDATA%\\.claude\\projects\\ (${path.join(process.env.APPDATA, '.claude', 'projects')})`);
    }
    console.error('');
    console.error('Dica: defina CLAUDE_PROJECTS_DIR para o caminho correto.');
    process.exit(1);
  }

  const claudeProjectsDir = resolved.dir;

  // No args → interactive menu
  if (!sessionId && !args.includes('--cwd')) {
    interactiveMenu(claudeProjectsDir, resolved.source).catch((err) => {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    });
    return;
  }

  // Resolve project from cwd
  const projectHash = cwdToProjectHash(cwd);
  const projectDir = resolveProjectDir(claudeProjectsDir, projectHash);

  if (!projectDir) {
    console.error(`Projeto nao encontrado para: ${cwd}`);
    console.error(`Hash: ${projectHash}`);
    console.error('');
    console.error('Use o menu interativo (sem argumentos) para navegar pelos projetos.');
    process.exit(1);
  }

  // Handle "last" shortcut
  if (sessionId === 'last') {
    const sessions = getProjectSessions(projectDir);
    if (sessions.length === 0) {
      console.error('Nenhuma sessao encontrada.');
      process.exit(1);
    }
    sessionId = sessions[0].id;
  }

  // Read specific session
  const filePath = path.join(projectDir, sessionId + '.jsonl');
  if (!fs.existsSync(filePath)) {
    console.error(`Sessao nao encontrada: ${sessionId}`);
    console.error(`Arquivo: ${filePath}`);
    console.error('');
    const sessions = getProjectSessions(projectDir).slice(0, 5);
    if (sessions.length > 0) {
      console.error('Sessoes disponiveis:');
      sessions.forEach((s) => {
        console.error(`  ${s.id} (${formatDate(s.modified)})`);
      });
    }
    process.exit(1);
  }

  renderTranscript(filePath, sessionId, projectHash, fullMode);
}

main();
