# RIAWORKS Claude Logs — Manual (PT-BR)

Sistema de logging para hooks do [Synkra AIOX](https://github.com/SynkraAI/aiox-core) no Claude Code. Fornece 4 niveis de log para diagnosticar e rastrear injecao de contexto.

**[Read in English](manual.md)**

## Visao Geral

O Claude Code injeta contexto invisivel a cada prompt via hooks. Sem logging, e impossivel saber quais regras foram injetadas, se o hook falhou, ou quais dados de code-intel o agente recebeu.

Este pacote fornece:
- **4 funcoes de logging** (`rw-*`) com controle independente por env var
- **Wrappers de hooks RIAWORKS** (opcional, para projetos usando os hooks riaworks-claude)
- **Monitor de log em tempo real** (`watch-context.js`)

> **Pre-requisito:** Os fixes estruturais do **aiox-fixes** devem ser aplicados primeiro.

## Conteudo do Pack

```
claude-logs/
├── prompt-apply-logging.md           # Prompt self-service (Ingles)
├── watch-context.js                  # Monitor de log em tempo real
├── hooks/                            # Wrappers de hooks RIAWORKS (opcional)
│   ├── synapse-logged.cjs            # UserPromptSubmit com logging
│   ├── code-intel-pretool.cjs        # PreToolUse com logging
│   ├── lib/
│   │   ├── hook-logger.js            # Biblioteca de logger unificado
│   │   └── read-stdin.js             # Leitor stdin seguro para Windows
│   └── README.md                     # Documentacao dos hooks
└── docs/
    ├── manual.md                     # Versao em ingles
    ├── manual-pt-BR.md               # Este arquivo
    ├── rw-hooks-log.md               # Documentacao rwHooksLog()
    ├── rw-synapse-trace.md           # Documentacao rwSynapseTrace()
    ├── rw-intel-context-log.md       # Documentacao rwIntelContextLog()
    ├── rw-context-log-full.md        # Documentacao rwContextLogFull()
    └── 04-fix-skill-logging.md       # Logging de ativacao Skill
```

## Referencia de Logs

Todas as extensoes de logging RIAWORKS usam o prefixo `rw-`. Sao **4 logs**: 3 individuais + 1 unificado.

### Referencia Rapida

| # | Log | Env Var | Arquivo de Log | Hook | Peso |
|---|-----|---------|----------------|------|------|
| 1 | **rw-hooks-log** | `RW_HOOKS_LOG=1` | `.logs/rw-hooks-log.log` | UserPromptSubmit | Leve (~100B/prompt) |
| 2 | **rw-synapse-trace** | `RW_SYNAPSE_TRACE=1` | `.logs/rw-synapse-trace.log` | UserPromptSubmit | Pesado (~4KB/prompt) |
| 3 | **rw-intel-context-log** | `RW_INTEL_CONTEXT_LOG=1` | `.logs/rw-intel-context-log.log` | PreToolUse (Write/Edit/Skill) | Condicional |
| 4 | **rw-context-log-full** | `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-context-log-full.log` | Ambos | Pesado (~5-10KB/prompt) |

### 1. rw-hooks-log — Status Operacional

Responde: "o hook esta funcionando ou falhando?"

Registra eventos do ciclo de vida: session criada, runtime resolvido, erros. Nao registra conteudo (prompts, XML). Primeira linha de diagnostico.

Documentacao completa: [`rw-hooks-log.md`](rw-hooks-log.md)

### 2. rw-synapse-trace — Trace XML do SYNAPSE

Responde: "que regras exatamente foram injetadas?"

Registra o XML SYNAPSE completo injetado como `additionalContext` a cada prompt. Use quando precisa ver as regras exatas que o Claude recebeu.

Documentacao completa: [`rw-synapse-trace.md`](rw-synapse-trace.md)

### 3. rw-intel-context-log — Injecao Code-Intel

Responde: "que contexto de codigo foi injetado quando o agente editou este arquivo?"

Registra XML `<code-intel-context>` em operacoes Write/Edit e prompts de agentes carregados via Skill.

Documentacao completa: [`rw-intel-context-log.md`](rw-intel-context-log.md)

### 4. rw-context-log-full — Log Unificado Completo

Responde: "qual o contexto completo que o Claude esta recebendo?"

Captura tudo em um unico log cronologico: prompt do usuario, session, XML SYNAPSE, listing de contexto estatico, XML code-intel e prompts de agentes.

Documentacao completa: [`rw-context-log-full.md`](rw-context-log-full.md)

### Individual vs Full

| Log Individual | Incluido no Full? | Pode ser usado sozinho? |
|----------------|--------------------|-----------------------|
| `RW_HOOKS_LOG` | Sim | Sim |
| `RW_SYNAPSE_TRACE` | Sim | Sim |
| `RW_INTEL_CONTEXT_LOG` | Sim | Sim |
| `RW_CONTEXT_LOG_FULL` | N/A — e o unificado master | Sim |

**Full substitui os 3 individuais.** Quando `RW_CONTEXT_LOG_FULL=1` esta ativo, voce nao precisa das env vars individuais.

### Combinacoes Recomendadas

| Cenario | Configuracao |
|---------|-------------|
| Verificacao rapida de saude | `RW_HOOKS_LOG=1` apenas |
| Debug de regras faltando | `RW_HOOKS_LOG=1 RW_SYNAPSE_TRACE=1` |
| Debug de code-intel apenas | `RW_INTEL_CONTEXT_LOG=1` no PreToolUse |
| Sessao de diagnostico completa | `RW_CONTEXT_LOG_FULL=1` em ambos os hooks |

## Ativacao

As variaveis de logging sao definidas como **env vars inline** no comando do hook em `.claude/settings.local.json`. NAO sao ativadas via `export`.

### Onde Configurar

| Evento do Hook | Script | Aceita |
|----------------|--------|--------|
| `UserPromptSubmit` | `synapse-engine.cjs` | `RW_HOOKS_LOG`, `RW_SYNAPSE_TRACE`, `RW_CONTEXT_LOG_FULL` |
| `PreToolUse` (Write\|Edit\|Skill) | `code-intel-pretool.cjs` | `RW_INTEL_CONTEXT_LOG`, `RW_CONTEXT_LOG_FULL` |

### Exemplos

**Padrao (todo logging desativado):**
```json
"command": "node .claude/hooks/synapse-engine.cjs"
```

**Apenas log de hooks (leve, recomendado):**
```json
"command": "RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs"
```

**Full unificado (ambos os hooks):**
```json
"command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/synapse-engine.cjs"
"command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/code-intel-pretool.cjs"
```

### Comportamento (todos os logs)

- **Opt-in:** So grava quando a env var esta definida como `1`
- **Fire-and-forget:** Nunca bloqueia a execucao do hook
- **Auto-create:** Cria `.logs/` com `.gitignore` se nao existir
- **Append-only:** Nunca sobrescreve, sempre adiciona

## Como Aplicar

1. Aplique os fixes estruturais primeiro (veja pacote **aiox-fixes**)
2. Copie o conteudo de `prompt-apply-logging.md` e cole no Claude Code
3. O Claude vai ler os docs de log, verificar pre-requisitos, aplicar logging e validar

## Monitor em Tempo Real

```bash
node .riaworks-claude/claude-logs/watch-context.js
```

Acompanha `.logs/rw-hooks.log` em tempo real (similar a `tail -f`).

## Nomenclatura

| Funcao | Env Var | Arquivo de Log |
|--------|---------|---------------|
| `rwHooksLog()` | `RW_HOOKS_LOG=1` | `.logs/rw-hooks-log.log` |
| `rwSynapseTrace()` | `RW_SYNAPSE_TRACE=1` | `.logs/rw-synapse-trace.log` |
| `rwIntelContextLog()` | `RW_INTEL_CONTEXT_LOG=1` | `.logs/rw-intel-context-log.log` |
| `rwSkillLog()` | `RW_INTEL_CONTEXT_LOG=1` ou `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-intel-context-log.log` + `.logs/rw-context-log-full.log` |
| `rwContextLogFull()` | `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-context-log-full.log` |

## Pacotes Relacionados

- **[aiox-fixes](../../aiox-fixes/)** — 9 fixes estruturais para hooks do AIOX (pre-requisito)
- **[read-transcript](../../read-transcript/)** — Leitor interativo de transcripts do Claude Code

---

*By RIAWORKS — 2026-03-08*
