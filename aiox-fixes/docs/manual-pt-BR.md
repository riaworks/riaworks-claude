# AIOX Hook Fix Pack — Manual (PT-BR)

Pack de correcoes para o sistema de hooks do Synkra AIOX. Contem 4 arquivos corrigidos prontos para aplicar em qualquer projeto AIOX.

## Conteudo do Pack

```
aiox-fixes/
├── hook-fix-pack/
│   ├── hook-runtime.js                  # Runtime principal dos hooks (patcheado)
│   ├── synapse-engine.cjs               # Hook de UserPromptSubmit (patcheado)
│   ├── precompact-session-digest.cjs    # Hook de PreCompact (patcheado)
│   └── settings.json                    # Configuracao de hooks do Claude (corrigido)
└── docs/
    ├── manual.md                        # Versao em ingles
    └── manual-pt-BR.md                  # Este arquivo
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

### Metodo 2: Copia manual do hook-fix-pack

Copie cada arquivo de `hook-fix-pack/` para o destino correto (ver tabela acima).

## Logging

O `hook-runtime.js` patcheado inclui a funcao `hookLog()` para logging diagnostico em `.logs/hooks.log`.

Para um sistema completo de logging RIAWORKS (logger unificado, controle por env var, monitoramento em tempo real), veja o package separado **claude-logs**.

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

## Packages Relacionados

- **claude-logs** — Sistema de logging unificado RIAWORKS (hooks, watch-context, controle por env var)
- **read-transcript** — Leitor interativo de transcripts do Claude Code

---

*By RIAWORKS — 2026-03-08*
