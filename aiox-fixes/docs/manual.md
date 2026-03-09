# AIOX Hook Fix Pack — Manual

Fix pack for the [Synkra AIOX](https://github.com/SynkraAI/aiox-core) hook system. Fixes 9 structural bugs + 1 Windows JSON escape via on-demand prompt.

**[Leia em Portugues](manual-pt-BR.md)**

## Overview

AIOX uses Claude Code hooks to inject SYNAPSE rules (coding standards, constitution, domain context) on every prompt. The original hook system has bugs that cause **silent context loss** — Claude operates without project rules with no warning.

This pack fixes all known structural bugs without adding any logging.

> **Logging:** For diagnostic logging (rwHooksLog, rwSynapseTrace, etc.), see the separate **claude-logs** package.

## Pack Contents

```
aiox-fixes/
├── prompt-apply-fixes.md              # Self-service prompt (English)
├── ref/                               # Reference files (read by prompt)
│   ├── 01-fix-hook-synapse.md         # SYNAPSE setup and installation
│   ├── 02-fix-hooks-bugs.md           # 9 bug fixes with code
│   └── 03-fix-windows-json-escape.md  # Windows JSON escape fix
└── docs/                              # Documentation
    ├── manual.md                      # This file
    └── manual-pt-BR.md               # Portuguese version
```

## Prerequisites

- AIOX project with `.aiox-core/` at project root
- `.riaworks-claude/` submodule installed (or cloned manually)
- Claude Code v2.1.63+ with Node 18+

## Bugs Fixed

### Setup & Configuration (01)

| Topic | Description |
|-------|-------------|
| SYNAPSE setup | How to obtain `.synapse/` from the official AIOX repository |
| Hook configuration | Correct `settings.local.json` structure |
| Verification | Commands to test hook functionality |

### Structural Bugs (02) — 9 fixes

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | "UserPromptSubmit hook error" on every prompt | `precompact-session-digest.cjs` registered as UserPromptSubmit | Moved to PreCompact event |
| 2 | Hook output rejected by Claude Code | Missing `hookEventName` in JSON output | Added `hookEventName: 'UserPromptSubmit'` in `buildHookOutput()` |
| 3 | stdout cutoff on Windows | `process.exit(0)` kills pipe before flush | Removed `process.exit()` from all hooks |
| 4 | Sessions never persisted | `createSession()` never called in flow | Called `createSession()` when `loadSession()` returns null |
| 5 | precompact runner not found | Fixed path doesn't find the runner | Tries 2 paths: `node_modules/` and `.aiox-core/` |
| 6 | `$CLAUDE_PROJECT_DIR` on Windows | Bash variable doesn't expand in cmd.exe | Relative path `node .claude/hooks/synapse-engine.cjs` |
| 7 | `timeout: 10` kills hook | 10ms too low | Timeout removed from settings.json |
| 8 | code-intel-pretool process.exit() pipe kill | Same as Bug 3, in code-intel hook | Removed `safeExit()` and `process.exit()` |
| 9 | PreCompact runner console.log/error | stderr triggers "hook error" | Removed all console.log/error from runner |

### Windows JSON Escape (03)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Intermittent JSON parse failure | Claude Code sends unescaped backslashes in Windows paths | `sanitizeJsonString()` fallback in `readStdin()` |

## How to Apply

1. Make sure `.riaworks-claude/aiox-fixes/` exists at project root
2. Copy the content of `prompt-apply-fixes.md` and paste into Claude Code
3. Claude will read all fix docs, verify integrity, apply fixes, and validate

The prompt follows a 5-step process:
- **STEP 0:** Verify documentation exists
- **STEP 1:** Read all fix documentation (mandatory)
- **STEP 2:** Integrity check of target files (mandatory, read-only)
- **STEP 3:** Apply fixes (uses exact code from docs, never invents)
- **STEP 4:** Validation

## settings.local.json Configuration

The corrected `settings.local.json` registers hooks on their correct events:

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

Key points:
- **Only** `synapse-engine.cjs` on UserPromptSubmit (not precompact)
- **No timeout** (Claude Code default is sufficient)
- **Relative paths** (works on Windows, macOS, and Linux)

## Files Modified

| File | Changes |
|------|---------|
| `.claude/settings.local.json` | Relative paths, no timeout, hooks on correct events |
| `.aiox-core/core/synapse/runtime/hook-runtime.js` | `hookEventName`, `createSession()`, `cleanOrphanTmpFiles()` |
| `.claude/hooks/synapse-engine.cjs` | Remove `process.exit()`, add `sanitizeJsonString()` |
| `.claude/hooks/precompact-session-digest.cjs` | Runner path corrected |
| `.claude/hooks/code-intel-pretool.cjs` | Path `.aios-core` -> `.aiox-core`, remove `process.exit()` |
| `.aiox-core/hooks/unified/runners/precompact-runner.js` | Remove `console.log/console.error` |

## Related Packages

- **[claude-logs](../../claude-logs/)** — RIAWORKS logging system (4 log levels, env var control, watch-context)
- **[read-transcript](../../read-transcript/)** — Interactive Claude Code transcript reader

## Origin

Based on PR #551 (riaworks/aiox-core) + CodeRabbit review + extensive debugging on Windows 11.

---

*By RIAWORKS — 2026-03-08*
