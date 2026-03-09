# AIOX Hook Fix Pack — Manual (PT-BR)

Pack de correcoes para o sistema de hooks do [Synkra AIOX](https://github.com/SynkraAI/aiox-core). Corrige 9 bugs estruturais + 1 fix de JSON escape no Windows via prompt sob demanda.

**[Read in English](manual.md)**

## Visao Geral

O AIOX usa hooks do Claude Code para injetar regras SYNAPSE (coding standards, constitution, dominio) a cada prompt. No repositorio original, esses hooks tem bugs que causam **perda silenciosa de contexto** — o Claude opera sem regras de projeto sem nenhum aviso.

Este pack corrige todos os bugs estruturais conhecidos sem adicionar logging.

> **Logging:** Para logging diagnostico (rwHooksLog, rwSynapseTrace, etc.), veja o pacote separado **claude-logs**.

## Conteudo do Pack

```
aiox-fixes/
├── prompt-apply-fixes.md              # Prompt self-service (Ingles)
└── docs/
    ├── manual.md                      # Versao em ingles
    ├── manual-pt-BR.md                # Este arquivo
    ├── 01-fix-hook-synapse.md         # Setup e instalacao do SYNAPSE
    ├── 02-fix-hooks-bugs.md           # 9 bug fixes com codigo
    └── 03-fix-windows-json-escape.md  # Fix de JSON escape no Windows
```

## Pre-requisitos

- Projeto AIOX com `.aiox-core/` na raiz
- Submodulo `.riaworks-claude/` instalado (ou clonado manualmente)
- Claude Code v2.1.63+ com Node 18+

## Bugs Corrigidos

### Setup e Configuracao (01)

| Topico | Descricao |
|--------|-----------|
| Setup do SYNAPSE | Como obter `.synapse/` do repositorio oficial do AIOX |
| Configuracao de hooks | Estrutura correta do `settings.local.json` |
| Verificacao | Comandos para testar funcionalidade dos hooks |

### Bugs Estruturais (02) — 9 fixes

| # | Bug | Causa Raiz | Correcao |
|---|-----|-----------|----------|
| 1 | "UserPromptSubmit hook error" em todo prompt | `precompact-session-digest.cjs` registrado como UserPromptSubmit | Movido para evento PreCompact |
| 2 | Hook output rejeitado pelo Claude Code | `hookEventName` ausente no JSON output | Adicionado `hookEventName: 'UserPromptSubmit'` em `buildHookOutput()` |
| 3 | stdout cortado no Windows | `process.exit(0)` mata pipe antes do flush | Removido `process.exit()` de todos os hooks |
| 4 | Sessions nunca persistidas | `createSession()` nunca chamada no fluxo | Chamada `createSession()` quando `loadSession()` retorna null |
| 5 | precompact runner not found | Path fixo nao encontra o runner | Tenta 2 paths: `node_modules/` e `.aiox-core/` |
| 6 | `$CLAUDE_PROJECT_DIR` no Windows | Variavel bash nao expande em cmd.exe | Path relativo `node .claude/hooks/synapse-engine.cjs` |
| 7 | `timeout: 10` mata hooks | 10ms muito baixo | Timeout removido do settings.json |
| 8 | process.exit() no code-intel-pretool mata pipe | Mesmo que Bug 3, no hook de code-intel | Removido `safeExit()` e `process.exit()` |
| 9 | console.log/error no PreCompact runner | stderr dispara "hook error" | Removido todo console.log/error do runner |

### Windows JSON Escape (03)

| Bug | Causa Raiz | Correcao |
|-----|-----------|----------|
| Falha intermitente de JSON parse | Claude Code envia backslashes sem escape no Windows | `sanitizeJsonString()` como fallback em `readStdin()` |

## Como Aplicar

1. Certifique-se de que `.riaworks-claude/aiox-fixes/` existe na raiz do projeto
2. Copie o conteudo de `prompt-apply-fixes.md` e cole no Claude Code
3. O Claude vai ler os docs de fix, verificar integridade, aplicar fixes e validar

O prompt segue um processo de 5 passos:
- **PASSO 0:** Verificar se documentacao existe
- **PASSO 1:** Ler toda documentacao de fixes (obrigatorio)
- **PASSO 2:** Verificacao de integridade dos arquivos alvo (obrigatorio, somente leitura)
- **PASSO 3:** Aplicar fixes (usa codigo exato dos docs, nunca inventa)
- **PASSO 4:** Validacao

## Configuracao do settings.local.json

O `settings.local.json` corrigido registra hooks nos eventos corretos:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/synapse-engine.cjs"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/precompact-session-digest.cjs"
          }
        ]
      }
    ]
  }
}
```

Pontos importantes:
- **Apenas** `synapse-engine.cjs` no UserPromptSubmit (nao o precompact)
- **Sem timeout** (o default do Claude Code e suficiente)
- **Paths relativos** (funciona em Windows, macOS e Linux)

## Arquivos Modificados

| Arquivo | Mudancas |
|---------|---------|
| `.claude/settings.local.json` | Paths relativos, sem timeout, hooks nos eventos corretos |
| `.aiox-core/core/synapse/runtime/hook-runtime.js` | `hookEventName`, `createSession()`, `cleanOrphanTmpFiles()` |
| `.claude/hooks/synapse-engine.cjs` | Remover `process.exit()`, adicionar `sanitizeJsonString()` |
| `.claude/hooks/precompact-session-digest.cjs` | Path do runner corrigido |
| `.claude/hooks/code-intel-pretool.cjs` | Path `.aios-core` -> `.aiox-core`, remover `process.exit()` |
| `.aiox-core/hooks/unified/runners/precompact-runner.js` | Remover `console.log/console.error` |

## Pacotes Relacionados

- **[claude-logs](../../claude-logs/)** — Sistema de logging RIAWORKS (4 niveis de log, controle por env var, watch-context)
- **[read-transcript](../../read-transcript/)** — Leitor interativo de transcripts do Claude Code

## Origem

Baseado no PR #551 (riaworks/aiox-core) + review CodeRabbit + debugging extensivo em Windows 11.

---

*By RIAWORKS — 2026-03-08*
