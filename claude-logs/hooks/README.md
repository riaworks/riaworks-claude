# RIAWORKS Claude Logs — Hooks

Hooks customizados do projeto RIAWORKS que estendem os hooks AIOX com logging e code intelligence.

## Ownership

| Diretório | Dono | Modificável |
|-----------|------|-------------|
| `.claude/hooks/` | **AIOX** (original do framework) | NUNCA modificar |
| `.riaworks-claude/claude-logs/hooks/` | **RIAWORKS** (projeto) | Livre |

## Estrutura

```
.riaworks-claude/claude-logs/
├── hooks/
│   ├── lib/
│   │   ├── hook-logger.js          ← Logger unificado (zero deps AIOX)
│   │   └── read-stdin.js           ← Leitor stdin (Windows-safe)
│   ├── synapse-logged.cjs          ← Wrapper RIAWORKS do synapse-engine (adiciona logging)
│   ├── code-intel-pretool.cjs      ← Hook code-intel (PreToolUse: Write|Edit|Skill)
│   └── README.md                   ← Este arquivo
├── watch-context.js                ← Monitor de logs em tempo real
└── docs/
    ├── hooks-guide.md              ← Guia completo do sistema de hooks
    ├── ativar-log-aios.md          ← Prompt: ativar hookLog() no AIOX core
    └── prompt-aplicar-log-system.md ← Prompt: aplicar no aiox-core-fork
```

## Como Funciona

### synapse-logged.cjs (UserPromptSubmit)

Wrapper que:
1. Lê stdin via `lib/read-stdin.js` (sanitização Windows)
2. Delega ao AIOX `resolveHookRuntime()` + `SynapseEngine.process()`
3. Loga via `lib/hook-logger.js` → `.logs/rw-hooks.log`
4. Escreve output JSON no stdout para Claude Code

**Original AIOX:** `.claude/hooks/synapse-engine.cjs` (não usado diretamente, mas preservado)

### code-intel-pretool.cjs (PreToolUse)

Hook RIAWORKS (não existe no repo AIOX original) que:
- **Write/Edit:** Consulta entity registry AIOX (`resolveCodeIntel`) e injeta `<code-intel-context>`
- **Skill:** Apenas loga a ativação do agente (sem injection)

### lib/hook-logger.js

Logger unificado, zero dependências AIOX.
- Env var: `RW_HOOK_LOG` = `0` (off) | `1` (summary) | `2` (verbose + XML)
- Output: `.logs/rw-hooks.log`

### lib/read-stdin.js

Leitor stdin compartilhado com sanitização de backslashes para Windows.

## Configuração

Registrado em `.claude/settings.local.json` (no projeto principal):

```json
{
  "env": { "RW_HOOK_LOG": "2" },
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node .riaworks-claude/claude-logs/hooks/synapse-logged.cjs" }] }],
    "PreToolUse": [{ "hooks": [{ "type": "command", "command": "node .riaworks-claude/claude-logs/hooks/code-intel-pretool.cjs" }], "matcher": "Write|Edit|Skill" }],
    "PreCompact": [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/precompact-wrapper.cjs" }] }]
  }
}
```

## Watch Logs

```bash
# Via watch-context.js (recomendado)
node .riaworks-claude/claude-logs/watch-context.js

# Ou diretamente
tail -f .logs/rw-hooks.log
```

## Documentação Completa

Ver `claude-logs/docs/hooks-guide.md`.
