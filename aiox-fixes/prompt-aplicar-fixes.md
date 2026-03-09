# Prompt: Aplicar 8 Bug Fixes nos AIOX Hooks

**Uso:** Cole o conteudo da secao PROMPT abaixo no Claude Code de qualquer projeto com AIOX instalado.
**Pre-requisito:** AIOX (Synkra) instalado no projeto (`.aios-core/` e `.claude/hooks/` existem).
**Resultado:** 8 bugs corrigidos nos hooks — sem alteracao de funcionalidade, apenas correcoes.

> **Sistema de Logs:** Se quiser adicionar logging apos aplicar os fixes, veja o package `claude-logs`.

---

## PROMPT (copie tudo abaixo da linha)

---

```
Preciso que voce corrija 8 bugs no sistema de hooks do AIOX. Execute TUDO sem perguntar.

## BUG 1: precompact registrado como UserPromptSubmit

No arquivo `.claude/settings.json`, o hook `precompact-session-digest.cjs` esta registrado no evento errado (UserPromptSubmit). Ele deve estar APENAS no PreCompact.

**Correcao:** Edite `.claude/settings.json` e garanta que o UserPromptSubmit tenha APENAS `synapse-engine.cjs`:

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
            "command": "node .claude/hooks/precompact-wrapper.cjs"
          }
        ]
      }
    ]
  }
}
```

Remova qualquer `timeout` dos hooks (o default do Claude Code e suficiente).

## BUG 2: hookEventName ausente no output JSON

No arquivo `.aios-core/core/synapse/runtime/hook-runtime.js`, a funcao `buildHookOutput()` nao inclui `hookEventName` no JSON de saida. Claude Code rejeita o output sem esse campo.

**Correcao:** Na funcao `buildHookOutput()`, adicione `hookEventName: 'UserPromptSubmit'` no objeto retornado. O output deve ter este formato:

```javascript
function buildHookOutput(xml) {
  if (!xml) return null;
  return {
    hookEventName: 'UserPromptSubmit',
    hookSpecificOutput: {
      additionalContext: xml,
    },
  };
}
```

## BUG 3: stdout cortado no Windows (process.exit)

Em `.claude/hooks/synapse-engine.cjs` e `.claude/hooks/precompact-session-digest.cjs`, o uso de `process.exit(0)` mata o pipe do stdout antes do Claude Code conseguir ler o output.

**Correcao:** Remova TODAS as chamadas de `process.exit()` desses dois arquivos. O Node.js deve sair naturalmente apos o stdout fazer flush. Use este padrao no lugar:

```javascript
function run() {
  const timer = setTimeout(() => {}, 5000);
  timer.unref();
  main()
    .then(() => {})
    .catch(() => {});
}
```

O `timer.unref()` garante que o processo nao fica pendurado, mas tambem nao mata o pipe.

## BUG 4: Session nunca persistida

No `hook-runtime.js`, a funcao `resolveHookRuntime()` chama `loadSession()` mas NUNCA chama `createSession()` quando a session nao existe.

**Correcao:** Dentro de `resolveHookRuntime()`, apos o `loadSession()`, adicione fallback para criar a session:

```javascript
let session = loadSession(sessionId, sessionsDir);
if (!session) {
  session = createSession(sessionId, cwd, sessionsDir);
}
```

## BUG 5: precompact runner path nao encontrado

No `precompact-session-digest.cjs`, o path para o runner e fixo e nao funciona em todas as instalacoes.

**Correcao:** O hook deve tentar 2 paths para encontrar o runner:
1. `node_modules/aios-core/` (instalacao via npm)
2. `.aios-core/` (instalacao local na raiz)

Use `fs.existsSync()` para testar cada path antes de usar.

## BUG 6: $CLAUDE_PROJECT_DIR nao expande no Windows

No `settings.json`, o command usa `$CLAUDE_PROJECT_DIR` que e uma variavel bash e nao expande no cmd.exe/PowerShell do Windows.

**Correcao:** Use paths relativos ao invés de variaveis de ambiente:

```json
"command": "node .claude/hooks/synapse-engine.cjs"
```

NAO use:
```json
"command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/synapse-engine.cjs"
```

## BUG 7: timeout: 10 mata o hook

No `settings.json`, o timeout esta definido como `10` (milissegundos), que e muito baixo e mata o hook antes de terminar.

**Correcao:** Remova o campo `timeout` completamente dos hooks no settings.json. O Claude Code tem seu proprio timeout default que e suficiente.

## BUG 8: .tmp files deletados enquanto em uso

No `hook-runtime.js`, a funcao `cleanOrphanTmpFiles()` deleta arquivos `.tmp` sem verificar a idade. Isso causa problemas quando outro processo ainda esta escrevendo.

**Correcao:** Adicione verificacao de idade (60 segundos) antes de deletar:

```javascript
function cleanOrphanTmpFiles(sessionsDir) {
  let removed = 0;
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.tmp'));
    const now = Date.now();
    const AGE_THRESHOLD_MS = 60 * 1000; // 60 seconds
    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > AGE_THRESHOLD_MS) {
          fs.unlinkSync(filePath);
          removed++;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return removed;
}
```

## VERIFICACAO

Depois de aplicar todos os fixes, execute qualquer prompt no Claude Code. O hook deve:
1. Executar sem erros no UserPromptSubmit
2. NAO mostrar "hook error" no chat
3. Persistir sessions em `.synapse/sessions/`
4. Funcionar tanto no Windows quanto no macOS/Linux

```bash
# Verificar se settings.json esta correto
cat .claude/settings.json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log('UserPromptSubmit hooks:',j.hooks?.UserPromptSubmit?.length||0);console.log('PreCompact hooks:',j.hooks?.PreCompact?.length||0)"
```

## RESUMO DOS 8 FIXES

| # | Bug | Arquivo Principal |
|---|-----|-------------------|
| 1 | precompact no evento errado | `.claude/settings.json` |
| 2 | hookEventName ausente | `.aios-core/core/synapse/runtime/hook-runtime.js` |
| 3 | process.exit mata pipe | `.claude/hooks/synapse-engine.cjs`, `precompact-session-digest.cjs` |
| 4 | session nunca criada | `.aios-core/core/synapse/runtime/hook-runtime.js` |
| 5 | runner path nao encontrado | `.claude/hooks/precompact-session-digest.cjs` |
| 6 | $CLAUDE_PROJECT_DIR no Windows | `.claude/settings.json` |
| 7 | timeout 10ms mata hook | `.claude/settings.json` |
| 8 | .tmp deletado em uso | `.aios-core/core/synapse/runtime/hook-runtime.js` |

## NOTAS

- Nenhum fix altera funcionalidade — apenas correcoes de bugs
- Todos os fixes sao retrocompativeis
- Para adicionar sistema de logs apos os fixes, veja o package `claude-logs`
- Baseado no PR #551 (riaworks/aios-core) + CodeRabbit review
```

---

*By RIAWORKS — 2026-03-08*
