# Ativar Sistema de Log do AIOS Hooks

**Uso:** Cole este prompt no Claude Code de qualquer projeto com AIOS instalado.
**Pré-requisito:** Os hooks já devem estar corrigidos (ver `aiox-bug/fix-aios-hooks-complete.md`).
**Resultado:** Logs de cada execução de hook em `.logs/hooks.log`.

---

## PROMPT (copie tudo abaixo)

```
Preciso que você adicione um sistema de log persistente aos hooks do AIOS. Execute TUDO sem perguntar.

## PASSO 1: Criar pasta .logs com .gitignore

```bash
mkdir -p .logs
```

Crie o arquivo `.logs/.gitignore`:
```
*
!.gitignore
```

## PASSO 2: Adicionar hookLog() no hook-runtime.js

No arquivo `.aiox-core/core/synapse/runtime/hook-runtime.js`, adicione esta função LOGO APÓS as primeiras linhas de require (`const fs = require('fs');`), ANTES de qualquer outra função:

```javascript
/**
 * Append a log entry to .logs/hooks.log (fire-and-forget).
 * Creates .logs/ directory if it doesn't exist.
 *
 * @param {string} cwd - Project root
 * @param {string} level - LOG level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 */
function hookLog(cwd, level, message) {
  try {
    const logsDir = path.join(cwd, '.logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      const gitignorePath = path.join(logsDir, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
      }
    }
    const logFile = path.join(logsDir, 'hooks.log');
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_) {
    // Fire-and-forget — never block hook execution
  }
}
```

Depois adicione `hookLog` ao `module.exports`:

```javascript
module.exports = {
  resolveHookRuntime,
  buildHookOutput,
  hookLog,
};
```

## PASSO 3: Adicionar chamadas de log no hook-runtime.js

Dentro da função `resolveHookRuntime()`, adicione logs nos seguintes pontos:

1. Quando `.synapse/` não existe (antes do `return null`):
```javascript
hookLog(cwd, 'INFO', 'No .synapse/ directory — skipping hook');
```

2. Quando uma session é criada (depois do `createSession()`):
```javascript
hookLog(cwd, 'INFO', `Session created: ${sessionId}`);
```

3. Quando stale sessions são limpas (depois do `cleanStaleSessions()`):
```javascript
if (removed > 0) {
  hookLog(cwd, 'INFO', `Cleaned ${removed} stale session(s) (TTL: ${ttlHours}h)`);
}
```

4. Quando .tmp orphans são limpos:
```javascript
if (tmpRemoved > 0) {
  hookLog(cwd, 'INFO', `Cleaned ${tmpRemoved} orphaned .tmp file(s)`);
}
```

5. Antes do `return` final com sucesso:
```javascript
hookLog(cwd, 'INFO', `Runtime resolved — session=${sessionId}, prompt_count=${session.prompt_count}, bracket=${session.context?.last_bracket || 'FRESH'}`);
```

6. No catch de erro:
```javascript
hookLog(cwd, 'ERROR', `Failed to resolve runtime: ${error.message}`);
```

## PASSO 4: Adicionar logs no synapse-engine.cjs

No arquivo `.claude/hooks/synapse-engine.cjs`:

1. Importe `hookLog` junto com os outros imports:
```javascript
const { resolveHookRuntime, buildHookOutput, hookLog } = require(
  path.join(__dirname, '..', '..', '.aiox-core', 'core', 'synapse', 'runtime', 'hook-runtime.js'),
);
```

2. Depois de gerar o output (antes do `process.stdout.write`):
```javascript
hookLog(runtime.cwd, 'INFO', `Hook output: ${result.metrics?.total_rules || 0} rules, bracket=${result.bracket}, xml=${output.length} bytes`);
```

3. No catch de erro do `run()`:
```javascript
.catch((err) => {
  try {
    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    hookLog(cwd, 'ERROR', `Hook crashed: ${err.message}`);
  } catch (_) {}
});
```

## VERIFICAÇÃO

Depois de aplicar, execute qualquer prompt no Claude Code e verifique:

```bash
cat .logs/hooks.log
```

Esperado (exemplo):
```
[2026-03-04T00:34:19.976Z] [INFO] Session created: abc-123-def
[2026-03-04T00:34:19.980Z] [INFO] Runtime resolved — session=abc-123-def, prompt_count=0, bracket=FRESH
[2026-03-04T00:34:20.150Z] [INFO] Hook output: 25 rules, bracket=FRESH, xml=2847 bytes
```

## NOTAS

- Logs são fire-and-forget — nunca bloqueiam a execução do hook
- `.logs/` tem `.gitignore` com `*` — nunca sobe pro git
- O diretório é criado automaticamente no primeiro prompt
- Para desativar, remova as chamadas de `hookLog()` ou delete `.logs/`
- Para rotação de log, delete `.logs/hooks.log` manualmente quando crescer
```

---

*Documentado em 2026-03-04 — BY RIAWORKS*
