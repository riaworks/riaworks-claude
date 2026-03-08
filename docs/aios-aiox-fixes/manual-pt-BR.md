# AIOS/AIOX Hook Fix Pack — Manual (PT-BR)

Pack de correções para o sistema de hooks do Synkra AIOS/AIOX. Contém 4 arquivos corrigidos prontos para aplicar em qualquer projeto AIOS.

## Conteudo do Pack

```
aios-aiox-fixes/
├── hook-fix-pack/
│   ├── hook-runtime.js                  # Runtime principal dos hooks
│   ├── synapse-engine.cjs               # Hook de UserPromptSubmit
│   ├── precompact-session-digest.cjs    # Hook de PreCompact
│   └── settings.json                    # Configuracao de hooks do Claude
├── ativar-log-aios.md                   # Prompt para ativar logs (passo a passo)
└── prompt-aplicar-log-system.md         # Prompt para aplicar no aios-core-fork
```

## Mapeamento de Arquivos

| Arquivo no pack | Destino no projeto AIOS |
|---|---|
| `settings.json` | `.claude/settings.json` |
| `synapse-engine.cjs` | `.claude/hooks/synapse-engine.cjs` |
| `precompact-session-digest.cjs` | `.claude/hooks/precompact-session-digest.cjs` |
| `hook-runtime.js` | `.aios-core/core/synapse/runtime/hook-runtime.js` |

## Bugs Corrigidos (9 total)

| # | Bug | Causa Raiz | Correcao |
|---|-----|-----------|----------|
| 1 | "UserPromptSubmit hook error" em todo prompt | `precompact-session-digest.cjs` registrado como UserPromptSubmit | Removido do UserPromptSubmit no settings.json |
| 2 | Hook output rejeitado pelo Claude Code | `hookEventName` ausente no JSON output | Adicionado `hookEventName: 'UserPromptSubmit'` em `buildHookOutput()` |
| 3 | stdout cortado no Windows | `process.exit(0)` mata pipe antes do flush | Removido `process.exit()` em todos os hooks |
| 4 | Session nunca persistida | `createSession()` nunca chamada no fluxo | Chamada `createSession()` quando `loadSession()` retorna null |
| 5 | precompact runner not found | Path fixo nao encontra o runner | Tenta 2 paths: `node_modules/aios-core/` e `.aios-core/` na raiz |
| 6 | Sem logs para diagnostico | Nenhum logging nos hooks | `hookLog()` grava em `.logs/hooks.log` |
| 7 | `$CLAUDE_PROJECT_DIR` no Windows | Variavel bash nao expande em cmd.exe | Path relativo `node .claude/hooks/synapse-engine.cjs` |
| 8 | `timeout: 10` mata hook | 10ms muito baixo | Timeout removido do settings.json |
| 9 | .tmp files deletados em uso | cleanOrphanTmpFiles sem age check | Age threshold de 60s antes de deletar |

## Como Aplicar

### Metodo 1: Copia manual

1. Crie a pasta de logs:
```bash
mkdir -p .logs
echo -e "*\n!.gitignore" > .logs/.gitignore
```

2. Copie cada arquivo para o destino correto (ver tabela acima).

3. Verifique:
```bash
cat .logs/hooks.log 2>/dev/null || echo "Log sera criado no proximo prompt"
```

4. Execute qualquer prompt no Claude Code e confira:
```bash
cat .logs/hooks.log
```

### Metodo 2: Prompt no Claude Code

Copie o conteudo completo de `ativar-log-aios.md` e cole no Claude Code do projeto alvo. O Claude aplicara todas as alteracoes automaticamente.

## Sistema de Log

O fix pack adiciona a funcao `hookLog()` que grava logs em `.logs/hooks.log`:

```
[2026-03-04T00:34:19.976Z] [INFO] Session created: abc-123-def
[2026-03-04T00:34:19.980Z] [INFO] Runtime resolved — session=abc-123-def, prompt_count=0, bracket=FRESH
[2026-03-04T00:34:20.150Z] [INFO] Hook output: 25 rules, bracket=FRESH, xml=2847 bytes
```

Caracteristicas:
- **Fire-and-forget** — nunca bloqueia a execucao do hook
- `.logs/` tem `.gitignore` com `*` — nunca sobe pro git
- Diretorio criado automaticamente no primeiro prompt
- Para desativar: remova as chamadas de `hookLog()` ou delete `.logs/`
- Para rotacao: delete `.logs/hooks.log` manualmente

## Configuracao do settings.json

O `settings.json` corrigido registra apenas `synapse-engine.cjs` no UserPromptSubmit:

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
    ]
  }
}
```

Pontos importantes:
- **Apenas** `synapse-engine.cjs` no UserPromptSubmit (nao o precompact)
- **Sem timeout** (o default do Claude Code e suficiente)
- **Path relativo** (funciona em Windows, macOS e Linux)

## Origem

Baseado no PR #551 (riaworks/aios-core) + review CodeRabbit + documentacao em aios-bug/.

---

*By RIAWORKS — 2026-03-04*
