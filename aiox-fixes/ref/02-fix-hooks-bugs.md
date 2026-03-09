# Fix: Claude Code Hooks — Known Bugs

**Date:** 2026-03-07 (updated)
**Platform:** Windows 11, Claude Code v2.1.63+, Node 22.x
**Context:** Claude Code executes hooks via stdin/stdout JSON protocol. Bugs in this flow cause loss of SYNAPSE rule injection.

> **What is SYNAPSE, how to install and configure:** see `01-fix-hook-synapse.md`

---

## Bugs Fixed

### Bug 1: Wrong hook registration in settings.json

**Symptom:** "UserPromptSubmit hook error" on every prompt.

**Cause:** `precompact-session-digest.cjs` registered as UserPromptSubmit (wrong type — it is PreCompact). Absolute paths with `${CLAUDE_PROJECT_DIR}` that do not expand on Windows. `timeout: 10` (10ms) kills the hook before it finishes.

**Fix:** Use relative paths, no timeout, register each hook under the correct event.

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

---

### Bug 2: hookEventName missing from output

**Symptom:** Claude Code silently rejects the hook output — rules not injected.

**Cause:** `buildHookOutput()` in `hook-runtime.js` did not include `hookEventName`. Claude Code v2.1.68+ requires this field.

**Fix:** Add `hookEventName: 'UserPromptSubmit'` to the output JSON.

```javascript
function buildHookOutput(xml) {
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',  // REQUIRED
      additionalContext: xml || '',
    },
  };
}
```

---

### Bug 3: stdout truncated on Windows (process.exit)

**Symptom:** Hook works intermittently — sometimes injects rules, sometimes does not.

**Cause:** `process.exit(0)` kills the stdout pipe before Claude Code reads the response on Windows.

**Fix:** Remove `process.exit()`. Let Node terminate naturally after stdout flush.

```javascript
// WRONG — kills pipe on Windows
main().then(() => process.exit(0));

// CORRECT — Node terminates on its own
main().then(() => {}).catch(() => {});
```

---

### Bug 4: Sessions never persisted

**Symptom:** `prompt_count` always 0, bracket transitions do not work.

**Cause:** `createSession()` never called — `loadSession()` returns null on the first prompt and the code uses fallback `{ prompt_count: 0 }` without persisting.

**Fix:** Call `createSession()` when `loadSession()` returns null.

```javascript
let session = loadSession(sessionId, sessionsDir);
if (!session && sessionId) {
  session = createSession(sessionId, cwd, sessionsDir);
}
```

---

### Bug 5: precompact runner not found

**Symptom:** PreCompact hook fails silently.

**Cause:** Runner path is wrong. The hook looks in `.aios-core/hooks/` but the runner is in `node_modules/aios-core/.aios-core/hooks/` (or needs to be copied to `.aiox-core/hooks/`).

**Fix:** Copy the runner + pro-detector to the project, or fix the path.

---

### Bug 6: Absolute paths do not work on Windows

**Symptom:** `Bad escaped character in JSON` or hook cannot find files.

**Cause:** `${CLAUDE_PROJECT_DIR}` is a bash variable and does not expand in cmd.exe. Absolute paths with backslashes cause JSON escape problems.

**Fix:** Use relative paths: `node .claude/hooks/synapse-engine.cjs`.

---

### Bug 7: 10ms timeout kills hooks

**Symptom:** Hook returns a timeout error before processing.

**Cause:** `timeout: 10` in settings.json is 10 milliseconds — insufficient. The hook needs ~50-200ms.

**Fix:** Remove `timeout` from settings.json. Claude Code manages timeouts internally.

---

### Bug 8: code-intel-pretool.cjs uses process.exit() (Windows pipe kill)

**Symptom:** `PreToolUse:Write hook error` when using the Write or Edit tool.

**Cause:** Same issue as Bug 3, but in the `code-intel-pretool.cjs` hook. The `safeExit()` function called `process.exit(0)` which on Windows kills the stdout pipe before Claude Code reads the JSON response.

**Fix:** Remove `safeExit()` and `process.exit()`. Use the same pattern as `synapse-engine.cjs` — let Node terminate naturally.

```javascript
// WRONG — kills pipe on Windows
function safeExit(code) {
  if (process.env.JEST_WORKER_ID) return;
  process.exit(code);
}
function run() {
  const timer = setTimeout(() => safeExit(0), HOOK_TIMEOUT_MS);
  timer.unref();
  main()
    .then(() => safeExit(0))
    .catch(() => { safeExit(0); });
}

// CORRECT — Node terminates on its own
function run() {
  const timer = setTimeout(() => {}, HOOK_TIMEOUT_MS);
  timer.unref();
  main()
    .then(() => {})
    .catch(() => {});
}
```

---

### Bug 9: precompact-runner.js console.log/console.error causes hook error

**Symptom:** Intermittent `PreCompact hook error`.

**Cause:** `precompact-runner.js` uses `console.log()` and `console.error()` for logging. In the Claude Code hook protocol, any output to stderr is interpreted as an error, and stdout output that is not valid JSON also causes problems.

Problematic lines:
- `console.log('[PreCompact] aiox-pro not available, skipping session digest')` → stdout
- `console.error('[PreCompact] Digest extractor not found...')` → stderr
- `console.error('[PreCompact] Digest extraction failed...')` → stderr
- `console.error('[PreCompact] Hook runner error...')` → stderr

**Fix:** Remove all `console.log()` and `console.error()` calls. Hooks must operate silently — failures are graceful degradation.

```javascript
// WRONG — stderr triggers "hook error" in Claude Code
if (!proAvailable) {
  console.log('[PreCompact] aiox-pro not available, skipping session digest');
  return;
}

// CORRECT — silent no-op
if (!proAvailable) {
  return; // Graceful degradation - no-op
}
```

---

## Verification

```bash
echo '{"prompt":"test","session_id":"verify","cwd":"DIR-MEU-PROJETO"}' \
  | node .claude/hooks/synapse-engine.cjs 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log('hookEventName:',j.hookSpecificOutput?.hookEventName);console.log('rules:',j.hookSpecificOutput?.additionalContext?.includes('CONSTITUTION')?'YES':'NO');console.log('STATUS: OK');}catch(e){console.log('STATUS: FAIL',e.message);}})"
```

Expected:
```
hookEventName: UserPromptSubmit
rules: YES
STATUS: OK
```

---

## Modified files

| File | Change |
|------|--------|
| `.claude/settings.local.json` | Relative paths, no timeout, hooks under the correct event |
| `.aiox-core/core/synapse/runtime/hook-runtime.js` | hookEventName, createSession, cleanOrphanTmpFiles |
| `.claude/hooks/synapse-engine.cjs` | Remove process.exit, sanitizeJsonString |
| `.claude/hooks/precompact-session-digest.cjs` | Runner path fixed |
| `.claude/hooks/code-intel-pretool.cjs` | Path .aios-core → .aiox-core, remove process.exit() (Bug 8) |
| `.aiox-core/hooks/unified/runners/precompact-runner.js` | Remove console.log/console.error (Bug 9) |

---

*Documented on 2026-03-07 — RIAWORKS*