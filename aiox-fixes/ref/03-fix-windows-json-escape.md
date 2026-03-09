# Fix: Windows JSON Escape — Backslash in Paths

**Date:** 2026-03-05
**Component:** `.claude/hooks/synapse-engine.cjs`
**Severity:** Low (intermittent, auto-recovery)

---

## Problem

```
[ERROR] Hook crashed: Bad escaped character in JSON at position 53 (line 1 column 54)
```

## Why it happens

Claude Code sends input via stdin to hooks as JSON. On Windows, the `cwd` field contains paths with backslashes. Intermittently, Claude Code sends these paths **without escaping**:

```
Expected: "cwd":"C:\\diretorio\\project-dir"
Received: "cwd":"C:\diretorio\project-dir"
```

The `\_` is not a valid JSON escape → `JSON.parse()` fails → hook does not execute → **SYNAPSE rules are not injected for that prompt**.

## Impact when SYNAPSE is absent

When JSON parse fails:
- The hook catches the error and exits silently
- Claude Code does not receive the `additionalContext` with the rules
- The prompt runs without Constitution, coding standards, and domain rules
- The next prompt usually works (intermittent bug)

## Fix: sanitizeJsonString()

Added fallback with backslash sanitization in `synapse-engine.cjs`:

```javascript
function sanitizeJsonString(raw) {
  // Escapes backslashes that are not valid JSON escape sequences
  // Valid: \" \\ \/ \b \f \n \r \t \uXXXX
  return raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}
```

**Dual try-catch strategy in `readStdin()`:**
1. Tries `JSON.parse(data)` normally
2. If it fails, tries `JSON.parse(sanitizeJsonString(data))`
3. If both fail, rejects (hook exits silently)

## Validation

- SYNAPSE rules injected normally (verified via `[CONTEXT BRACKET]`)
- Error no longer appears in logs
- Zero performance impact (regex only executes on the fallback path)

## Modified file

- `.claude/hooks/synapse-engine.cjs` — functions `readStdin()` and `sanitizeJsonString()`

---

*Documented on 2026-03-05 — RIAWORKS*