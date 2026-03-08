# Prompt: Aplicar Sistema de Log Persistente nos AIOS Hooks

**Uso:** Cole o conteúdo da seção PROMPT abaixo no Claude Code, aberto no diretório `aios-core-fork`.
**Pré-requisito:** Estar no branch `fix/hook-by-riaworks` (que já tem os 8 bug fixes aplicados).
**Resultado:** Sistema de log persistente em `.logs/hooks.log` com fire-and-forget.

---

## PROMPT (copie tudo abaixo da linha)

---

```
Preciso que você adicione o sistema de log persistente (`hookLog`) aos hooks do AIOS. O branch `fix/hook-by-riaworks` já tem os 8 bug fixes aplicados, mas FALTA o sistema de logs em arquivo. Execute tudo sem perguntar.

O diretório de trabalho é o aios-core-fork.

## CONTEXTO

Atualmente o `hook-runtime.js` usa `console.error()` com `process.env.DEBUG === '1'` para debug. Preciso substituir isso por um sistema de log persistente que grava em `.logs/hooks.log` com o padrão fire-and-forget (nunca bloqueia execução do hook).

## PASSO 1: Criar pasta .logs com .gitignore

```bash
mkdir -p .logs
```

Crie o arquivo `.logs/.gitignore` com conteúdo:
```
*
!.gitignore
```

## PASSO 2: Adicionar função hookLog() no hook-runtime.js

No arquivo `.aios-core/core/synapse/runtime/hook-runtime.js`, adicione esta função LOGO APÓS a linha `const DEFAULT_STALE_TTL_HOURS = 168;` e ANTES da função `cleanOrphanTmpFiles`:

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

## PASSO 3: Adicionar chamadas de hookLog no hook-runtime.js

Dentro da função `resolveHookRuntime()`, substitua TODOS os `console.error` com `process.env.DEBUG` por chamadas de `hookLog`. Os pontos específicos são:

1. **Quando `.synapse/` não existe** — a linha `if (!fs.existsSync(synapsePath)) return null;` deve ser substituída por:
```javascript
  if (!fs.existsSync(synapsePath)) {
    hookLog(cwd, 'INFO', 'No .synapse/ directory — skipping hook');
    return null;
  }
```

2. **Quando session é criada** — após `session = createSession(sessionId, cwd, sessionsDir);` adicione:
```javascript
      hookLog(cwd, 'INFO', `Session created: ${sessionId}`);
```

3. **Quando stale sessions são limpas** — substitua o bloco que usa `process.env.DEBUG` por:
```javascript
        const removed = cleanStaleSessions(sessionsDir, ttlHours);
        if (removed > 0) {
          hookLog(cwd, 'INFO', `Cleaned ${removed} stale session(s) (TTL: ${ttlHours}h)`);
        }
```

4. **Quando .tmp orphans são limpos** — substitua o bloco que usa `process.env.DEBUG` por:
```javascript
        const tmpRemoved = cleanOrphanTmpFiles(sessionsDir);
        if (tmpRemoved > 0) {
          hookLog(cwd, 'INFO', `Cleaned ${tmpRemoved} orphaned .tmp file(s)`);
        }
```

5. **Antes do return final com sucesso** — antes de `return { engine, session, sessionId, sessionsDir, cwd };` adicione:
```javascript
    hookLog(cwd, 'INFO', `Runtime resolved — session=${sessionId}, prompt_count=${session.prompt_count}, bracket=${session.context?.last_bracket || 'FRESH'}`);
```

6. **No catch de erro** — substitua o bloco que usa `process.env.DEBUG` por:
```javascript
  } catch (error) {
    hookLog(cwd, 'ERROR', `Failed to resolve runtime: ${error.message}`);
    return null;
  }
```

## PASSO 4: Exportar hookLog no module.exports

No final do `hook-runtime.js`, o `module.exports` deve incluir `hookLog`:

```javascript
module.exports = {
  resolveHookRuntime,
  buildHookOutput,
  hookLog,
};
```

## PASSO 5: Adicionar logs no synapse-engine.cjs

No arquivo `.claude/hooks/synapse-engine.cjs`:

1. **Atualizar o require** para importar `hookLog`:
```javascript
const { resolveHookRuntime, buildHookOutput, hookLog } = require(
  path.join(__dirname, '..', '..', '.aios-core', 'core', 'synapse', 'runtime', 'hook-runtime.js'),
);
```

2. **Adicionar log após gerar output** — antes de `process.stdout.write(output)` adicione:
```javascript
  hookLog(runtime.cwd, 'INFO', `Hook output: ${result.metrics?.total_rules || 0} rules, bracket=${result.bracket}, xml=${output.length} bytes`);
```

3. **Adicionar log no catch de erro** — substitua o `.catch(() => {})` vazio por:
```javascript
    .catch((err) => {
      try {
        const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        hookLog(cwd, 'ERROR', `Hook crashed: ${err.message}`);
      } catch (_) {}
    });
```

## VERIFICAÇÃO

Depois de aplicar tudo, execute:

```bash
echo '{"prompt":"test","session_id":"verify-log","cwd":"'$(pwd)'"}' | node .claude/hooks/synapse-engine.cjs 2>/dev/null && cat .logs/hooks.log
```

Esperado: linhas com timestamps mostrando session created, runtime resolved, hook output:
```
[2026-03-04T...] [INFO] Session created: verify-log
[2026-03-04T...] [INFO] Runtime resolved — session=verify-log, prompt_count=0, bracket=FRESH
[2026-03-04T...] [INFO] Hook output: 25 rules, bracket=FRESH, xml=2847 bytes
```

## RESUMO DAS ALTERAÇÕES

| Arquivo | Alteração |
|---------|-----------|
| `.logs/.gitignore` | Criar com `*` e `!.gitignore` |
| `.aios-core/core/synapse/runtime/hook-runtime.js` | Adicionar `hookLog()`, substituir `console.error`/`DEBUG` por `hookLog`, exportar no `module.exports` |
| `.claude/hooks/synapse-engine.cjs` | Importar `hookLog`, adicionar log de output e log de crash |

## NOTAS

- Logs são fire-and-forget — NUNCA bloqueiam a execução do hook
- `.logs/` tem `.gitignore` com `*` — nunca sobe pro git
- O diretório é criado automaticamente no primeiro prompt
- Para desativar, remova as chamadas de `hookLog()` ou delete `.logs/`
- Para rotação de log, delete `.logs/hooks.log` manualmente quando crescer
```

---

*Gerado em 2026-03-04 — baseado nos documentos de aios-bug/ e aios-utils/*
