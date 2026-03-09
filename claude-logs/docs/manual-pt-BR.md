# RIAWORKS Claude Logs — Manual (PT-BR)

Plugin de logging para hooks do [Synkra AIOX](https://github.com/SynkraAI/aiox-core) no Claude Code. Fornece logging unificado via hooks wrapper que substituem os originais do AIOX.

**[Read in English](manual.md)**

## Visao Geral

O Claude Code injeta contexto invisivel a cada prompt via hooks. Sem logging, e impossivel saber quais regras foram injetadas, se o hook falhou, ou quais dados de code-intel o agente recebeu.

Este plugin fornece:
- **Hooks wrapper** que substituem os originais do AIOX e adicionam logging
- **Log unificado** (`.logs/rw-hooks.log`) com 2 niveis de verbosidade
- **Monitor de log em tempo real** (`rw-watch-context.js`)

> **Pre-requisito:** Os fixes estruturais do **aiox-fixes** devem ser aplicados primeiro.

## Conteudo do Pack

```
claude-logs/
├── prompt-apply-logging.md           # Prompt de instalacao (Ingles)
├── rw-watch-context.js               # Monitor de log em tempo real
├── hooks/                            # Hooks wrapper RIAWORKS (plugin)
│   ├── rw-synapse-log.cjs           # Wrapper UserPromptSubmit
│   ├── rw-pretool-log.cjs           # Wrapper PreToolUse
│   ├── lib/
│   │   ├── rw-hook-logger.js        # Biblioteca de logger unificado
│   │   └── rw-read-stdin.js         # Leitor stdin seguro para Windows
│   └── README.md                    # Documentacao dos hooks
├── ref/                              # Arquivos de referencia
│   └── legacy/                      # Specs de formato legado (arquivado)
└── docs/                             # Documentacao
    ├── manual.md                     # Versao em ingles
    └── manual-pt-BR.md             # Este arquivo
```

## Arquitetura

O plugin usa **hooks wrapper** que delegam para funcoes core do AIOX e adicionam logging. Os hooks originais do AIOX sao preservados intactos.

**Importante:** Os hooks wrapper e os hooks originais do AIOX sao mutuamente exclusivos. Apenas UM deve ser configurado em `settings.local.json` por vez. Executar ambos causaria injecao duplicada de contexto.

## Referencia de Logging

### Variavel de Ambiente Unica

| Valor | Nivel | O que e logado | Peso |
|-------|-------|---------------|------|
| (nao definido) | Off | Nada | 0 |
| `RW_HOOK_LOG=1` | Resumo | Prompt, session, bracket, regras, metricas, resumo code-intel, skills | ~200B/prompt |
| `RW_HOOK_LOG=2` | Verboso | Tudo acima + blocos XML completos | ~4-5KB/prompt |

### Eventos de Log

| Evento | Hook | O que captura |
|--------|------|---------------|
| **SYNAPSE** | UserPromptSubmit | Prompt, session, bracket, contagem de regras, contexto estatico, metricas |
| **CODE-INTEL** | PreToolUse (Write/Edit) | Nome da tool, caminho do arquivo, entidade, refs, deps |
| **SKILL** | PreToolUse (Skill) | Nome da skill, caminho resolvido, tamanho do arquivo |

Todos os eventos escrevem no mesmo arquivo `.logs/rw-hooks.log`.

O AIOX core tambem escreve diagnosticos operacionais em `.logs/rw-aiox-log.log` (env: `RW_AIOX_LOG=1`).

## Ativar / Desativar

### Ativar (instalar plugin)

Atualize `.claude/settings.local.json` para apontar para os hooks wrapper:

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
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-session-digest.cjs"
      }]
    }]
  }
}
```

Ou use o prompt de instalacao: copie `prompt-apply-logging.md` e cole no Claude Code.

### Desativar (reverter para originais do AIOX)

Altere `.claude/settings.local.json` de volta para os hooks originais do AIOX:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/synapse-engine.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit"
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-session-digest.cjs"
      }]
    }]
  }
}
```

### Desativar apenas logging (manter wrappers)

Remova `RW_HOOK_LOG` da secao `env` (ou defina como `"0"`):

```json
"env": {
  "RW_AIOX_LOG": "1"
}
```

### Comportamento (todos os logs)

- **Opt-in:** So grava quando `RW_HOOK_LOG` esta definido como `1` ou `2`
- **Fire-and-forget:** Nunca bloqueia a execucao do hook
- **Auto-create:** Cria `.logs/` com `.gitignore` se nao existir
- **Append-only:** Nunca sobrescreve, sempre adiciona

## Monitor em Tempo Real

```bash
node .riaworks-claude/claude-logs/rw-watch-context.js
```

Acompanha `.logs/rw-hooks.log` em tempo real (similar a `tail -f`).

## Convencao de Nomes

| Arquivo | Proposito |
|---------|-----------|
| `rw-synapse-log.cjs` | Hook wrapper UserPromptSubmit |
| `rw-pretool-log.cjs` | Hook wrapper PreToolUse |
| `lib/rw-hook-logger.js` | Biblioteca de logger unificado |
| `lib/rw-read-stdin.js` | Leitor stdin seguro para Windows |
| `rw-watch-context.js` | Monitor de log em tempo real |

## Pacotes Relacionados

- **[aiox-fixes](../../aiox-fixes/)** — 9 fixes estruturais para hooks do AIOX (pre-requisito)
- **[read-transcript](../../read-transcript/)** — Leitor interativo de transcripts do Claude Code

---

*By RIAWORKS — 2026-03-08*
