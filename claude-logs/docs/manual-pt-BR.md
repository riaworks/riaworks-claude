# RIAWORKS Claude Logs v2 — Manual (PT-BR)

Plugin de logging para hooks do [Synkra AIOX](https://github.com/SynkraAI/aiox-core) no Claude Code. Fornece logging unificado via hooks **subprocess wrapper** que executam os originais do AIOX como processos filhos.

**[Read in English](manual.md)**

## Visao Geral

O Claude Code injeta contexto invisivel a cada prompt via hooks. Sem logging, e impossivel saber quais regras foram injetadas, se o hook falhou, ou quais dados de code-intel o agente recebeu.

Este plugin fornece:
- **Hooks subprocess wrapper** que executam os originais do AIOX como processos filhos e capturam o output
- **Log unificado** (`.logs/rw-hooks.log`) com 2 niveis de verbosidade
- **6 tipos de evento**: SYNAPSE, CODE-INTEL, SKILL, AIOX-RUNTIME, POSTTOOL, operacional
- **Monitor de log em tempo real** (`rw-watch-context.js`)

> **Pre-requisito:** Os fixes estruturais do **aiox-fixes** devem ser aplicados primeiro (S1).

## Conteudo do Pack

```
claude-logs/
├── prompt-apply-logging.md           # Prompt de instalacao (Ingles)
├── rw-watch-context.js               # Monitor de log em tempo real
├── hooks/                            # Hooks wrapper RIAWORKS (plugin)
│   ├── rw-synapse-log.cjs           # Subprocess wrapper UserPromptSubmit
│   ├── rw-pretool-log.cjs           # Subprocess wrapper PreToolUse
│   ├── rw-posttool-log.cjs          # Logger de resultado PostToolUse (NOVO no v2)
│   ├── lib/
│   │   ├── rw-hook-logger.js        # Biblioteca de logger unificado (6 eventos)
│   │   └── rw-read-stdin.js         # Leitor stdin seguro para Windows
│   └── README.md                    # Documentacao dos hooks
├── ref/                              # Arquivos de referencia
│   └── legacy/                      # Specs de formato legado (arquivado)
└── docs/                             # Documentacao
    ├── manual.md                     # Versao em ingles
    └── manual-pt-BR.md             # Este arquivo
```

## Arquitetura (v2 — Subprocess Wrapper)

A arquitetura v2 usa **execucao via subprocess** ao inves de importar modulos AIOX diretamente. Isso torna os hooks RIAWORKS um observador externo puro com zero dependencia dos internals do AIOX.

```
Claude Code Hook System
│
├── UserPromptSubmit
│   └── rw-synapse-log.cjs (wrapper RIAWORKS)
│       ├── LE: stdin do Claude Code
│       ├── EXECUTA: synapse-engine.cjs como subprocess (execFileSync)
│       ├── CAPTURA: stdout (JSON com regras synapse)
│       ├── LE: .synapse/metrics/hook-metrics.json (metricas do engine)
│       ├── LOGA: eventos SYNAPSE + AIOX-RUNTIME → .logs/rw-hooks.log
│       └── REPASSA: stdout do AIOX para o Claude Code
│
├── PreToolUse (Write|Edit|Skill)
│   └── rw-pretool-log.cjs (wrapper RIAWORKS)
│       ├── se Skill: loga ativacao (sem subprocess)
│       ├── se Write/Edit:
│       │   ├── EXECUTA: code-intel-pretool.cjs como subprocess
│       │   ├── CAPTURA: stdout (XML de code-intel)
│       │   ├── LOGA: evento CODE-INTEL → .logs/rw-hooks.log
│       │   └── REPASSA: stdout do AIOX para o Claude Code
│
├── PostToolUse (Write|Edit) — NOVO no v2
│   └── rw-posttool-log.cjs (RIAWORKS)
│       ├── LE: stdin (tool_name, tool_input, tool_result)
│       ├── LOGA: evento POSTTOOL → .logs/rw-hooks.log
│       └── Sem injecao (tool ja executou)
│
└── PreCompact
    └── precompact-wrapper.cjs (AIOX original — sem wrapper RIAWORKS)
```

**Principio chave:** Hooks RIAWORKS sao observadores puros. Eles executam hooks AIOX como subprocessos, capturam o output, logam, e repassam para o Claude Code. Zero chamadas `require()` para modulos internos do AIOX.

## Referencia de Logging

### Variavel de Ambiente Unica

| Valor | Nivel | O que e logado | Peso |
|-------|-------|---------------|------|
| (nao definido) | Off | Nada | 0 |
| `RW_HOOK_LOG=1` | Resumo | Prompt, session, bracket, regras, metricas, resumo code-intel, skills | ~200B/prompt |
| `RW_HOOK_LOG=2` | Verboso | Tudo acima + blocos XML completos + detalhes de erro | ~4-5KB/prompt |

### Eventos de Log

| Evento | Hook | O que captura |
|--------|------|---------------|
| **SYNAPSE** | UserPromptSubmit | Prompt, session, bracket, contagem de regras, contexto estatico |
| **AIOX-RUNTIME** | UserPromptSubmit | Duracao do pipeline, layers loaded/skipped/errored, breakdown por layer |
| **CODE-INTEL** | PreToolUse (Write/Edit) | Nome da tool, caminho do arquivo, entidade, refs, deps |
| **SKILL** | PreToolUse (Skill) | Nome da skill, caminho resolvido, tamanho do arquivo |
| **POSTTOOL** | PostToolUse (Write/Edit) | Nome da tool, caminho do arquivo, sucesso/falha, tamanho do resultado |

Todos os eventos escrevem no mesmo arquivo `.logs/rw-hooks.log`.

O AIOX core tambem escreve diagnosticos operacionais em `.logs/rw-aiox-log.log` (env: `RW_AIOX_LOG=1`).

## Ativar / Desativar

### Ativar (instalar plugin)

Atualize `.claude/settings.local.json`:

```json
{
  "env": {
    "RW_HOOK_LOG": "1",
    "RW_AIOX_LOG": "1"
  },
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "PostToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-posttool-log.cjs"
      }],
      "matcher": "Write|Edit"
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-wrapper.cjs"
      }]
    }]
  }
}
```

### Desativar (reverter para originais do AIOX)

Altere `.claude/settings.local.json` de volta para os hooks originais.

### Comportamento

- **Opt-in:** So grava quando `RW_HOOK_LOG` esta definido como `1` ou `2`
- **Fire-and-forget:** Nunca bloqueia a execucao do hook
- **Auto-create:** Cria `.logs/` com `.gitignore` se nao existir
- **Append-only:** Nunca sobrescreve, sempre adiciona
- **Isolacao subprocess:** Hooks AIOX rodam em processo filho — crashes nao afetam o wrapper

## Monitor em Tempo Real

```bash
node .riaworks-claude/claude-logs/rw-watch-context.js
```

Acompanha `.logs/rw-hooks.log` em tempo real. Colorido por tipo de evento:
- **SYNAPSE** (ciano), **CODE-INTEL** (azul), **SKILL** (magenta)
- **AIOX-RUNTIME** (amarelo), **POSTTOOL** (verde), **ERROR** (vermelho)

## Convencao de Nomes

| Arquivo | Proposito |
|---------|-----------|
| `rw-synapse-log.cjs` | Subprocess wrapper UserPromptSubmit |
| `rw-pretool-log.cjs` | Subprocess wrapper PreToolUse |
| `rw-posttool-log.cjs` | Logger de resultado PostToolUse (NOVO) |
| `lib/rw-hook-logger.js` | Biblioteca de logger unificado (6 eventos) |
| `lib/rw-read-stdin.js` | Leitor stdin seguro para Windows |
| `rw-watch-context.js` | Monitor de log em tempo real |

## Pacotes Relacionados

- **[aiox-fixes](../../aiox-fixes/)** — 9 fixes estruturais para hooks do AIOX (pre-requisito)
- **[read-transcript](../../read-transcript/)** — Leitor interativo de transcripts do Claude Code

---

*By RIAWORKS — 2026-03-09 — v2.0*
