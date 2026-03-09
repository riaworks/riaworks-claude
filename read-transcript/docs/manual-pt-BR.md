# read-transcript.js — Manual de Uso

Leitor interativo de transcripts (sessoes) do Claude Code. Faz parse dos arquivos `.jsonl` que o Claude Code grava em `~/.claude/projects/`.

**Cross-platform:** Windows, macOS, Linux. Detecta automaticamente o diretorio de projetos do Claude.

## Localizacao

```
read-transcript/read-transcript.js
```

## Requisitos

- Node.js 18+
- Claude Code instalado (cria `~/.claude/projects/` automaticamente)

## Modo Interativo (Menu)

```bash
node read-transcript/read-transcript.js
```

Abre o menu principal com as opcoes:

```
  ╔══════════════════════════════════════════════════════════╗
  ║        Claude Code Transcript Reader                    ║
  ║        by RIAWORKS                                      ║
  ╚══════════════════════════════════════════════════════════╝

  1. Listar projetos           → Todos os projetos com sessoes
  2. Sessoes do projeto atual  → Sessoes baseadas no cwd
  3. Ler ultima sessao         → Abre a mais recente do cwd
  4. Buscar por texto          → Busca em todos os projetos
  0. Sair
```

### 1. Listar projetos

Mostra todos os projetos encontrados no Claude, com contagem de sessoes e data da ultima atividade. Permite selecionar um projeto para navegar suas sessoes.

### 2. Sessoes do projeto atual

Lista sessoes do projeto baseado no diretorio atual (cwd). Cada sessao mostra:
- Data relativa (hoje, ontem, 3d atras...)
- Tamanho do arquivo
- Primeiro prompt da sessao

### 3. Ler ultima sessao

Atalho direto para abrir a sessao mais recente do projeto atual.

### 4. Buscar por texto

Busca um texto nos primeiros prompts de todas as sessoes de todos os projetos. Util para encontrar uma sessao especifica.

## Ao selecionar uma sessao

O menu oferece 5 modos de visualizacao:

```
  1. Visualizar (truncado)         → Mensagens resumidas
  2. Visualizar (completo)         → Sem truncamento
  3. Apenas mensagens do usuario   → Filtra so USER
  4. Apenas tool calls             → Filtra so tool_use
  5. Estatisticas da sessao        → Resumo numerico
```

### Estatisticas

Mostra um resumo da sessao:
- Duracao total
- Contagem de mensagens (user/assistant)
- Total de thinking blocks
- Tool calls com ranking das mais usadas

## Modo Direto (CLI)

Para uso em scripts ou acesso rapido:

```bash
# Sessao especifica do projeto atual
node read-transcript/read-transcript.js <session-id>

# Sessao mais recente
node read-transcript/read-transcript.js last

# Modo completo (sem truncar)
node read-transcript/read-transcript.js --full last

# Outro projeto
node read-transcript/read-transcript.js --cwd /c/_sistemas/outro-projeto

# Ajuda
node read-transcript/read-transcript.js --help
```

## Deteccao de diretorio (Cross-Platform)

O script tenta encontrar o diretorio de projetos do Claude nesta ordem:

| Prioridade | Caminho | Quando |
|------------|---------|--------|
| 1 | `$CLAUDE_PROJECTS_DIR` | Env override manual |
| 2 | `~/.claude/projects/` | macOS, Linux, Windows (Git Bash) |
| 3 | `%APPDATA%\.claude\projects\` | Windows nativo |
| 4 | `%LOCALAPPDATA%\.claude\projects\` | Windows fallback |

Se nenhum for encontrado, exibe mensagem com os caminhos testados e sugere definir `CLAUDE_PROJECTS_DIR`.

## Formato de saida

```
════════════════════════════════════════════════════════════════════════════════
  TRANSCRIPT: abc123-def456
  Projeto:    C---sistemas-AIOS-AIOX-RIAWORKS
  Linhas:     342
════════════════════════════════════════════════════════════════════════════════

L   1 │ 2026-03-08T14:30:00 │ USER [str]
       eu quero implementar a feature X...

L   2 │ 2026-03-08T14:30:05 │ ASSISTANT [thinking]
       Vou analisar o codigo existente...

L   2 │ 2026-03-08T14:30:05 │ ASSISTANT [tool_use] Read
       input: {"file_path":"/c/_sistemas/..."}

L   3 │ 2026-03-08T14:30:06 │ USER [tool_result]
       1→const fs = require('fs');...
```

## Dicas

- Entradas `file-history-snapshot` sao filtradas automaticamente
- Sem argumentos = menu interativo; com argumentos = modo direto
- Use `--full` quando precisar do conteudo completo de mensagens longas
- Os JSONL podem ter dezenas de MB — o modo truncado (padrao) e mais rapido

---

*By RIAWORKS — 2026-03-08*
