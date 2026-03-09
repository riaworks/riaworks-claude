# AIOX Hook Fix Pack — Manual

Fix pack for the Synkra AIOX hook system. Fixes 8 structural bugs via on-demand prompt.

## Pack Contents

```
aiox-fixes/
├── prompt-aplicar-fixes.md              # Prompt to apply all 8 fixes via Claude Code
└── docs/
    ├── manual.md                        # This file
    └── manual-pt-BR.md                  # Portuguese version
```

## Bugs Fixed (8 structural fixes)

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | "UserPromptSubmit hook error" on every prompt | `precompact-session-digest.cjs` registered as UserPromptSubmit | Removed from UserPromptSubmit in settings.json |
| 2 | Hook output rejected by Claude Code | Missing `hookEventName` in JSON output | Added `hookEventName: 'UserPromptSubmit'` in `buildHookOutput()` |
| 3 | stdout cutoff on Windows | `process.exit(0)` kills pipe before flush | Removed `process.exit()` from all hooks |
| 4 | Session never persisted | `createSession()` never called in flow | Called `createSession()` when `loadSession()` returns null |
| 5 | precompact runner not found | Fixed path doesn't find the runner | Tries 2 paths: `node_modules/aiox-core/` and `.aiox-core/` at root |
| 6 | `$CLAUDE_PROJECT_DIR` on Windows | Bash variable doesn't expand in cmd.exe | Relative path `node .claude/hooks/synapse-engine.cjs` |
| 7 | `timeout: 10` kills hook | 10ms too low | Timeout removed from settings.json |
| 8 | .tmp files deleted while in use | cleanOrphanTmpFiles without age check | 60s age threshold before deleting |

> **Logging:** For diagnostic logging (`hookLog()`), see the separate **claude-logs** package.

## How to Apply

Copy the full content of `prompt-aplicar-fixes.md` and paste it into Claude Code in the target AIOX project. Claude will apply all 8 fixes automatically, adapting to the current version of the AIOX code.

## settings.json Configuration

The corrected `settings.json` registers only `synapse-engine.cjs` on UserPromptSubmit:

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

Key points:
- **Only** `synapse-engine.cjs` on UserPromptSubmit (not precompact)
- **No timeout** (Claude Code default is sufficient)
- **Relative path** (works on Windows, macOS, and Linux)

## Origin

Based on PR #551 (riaworks/aiox-core) + CodeRabbit review + aiox-bug/ documentation.

## Related Packages

- **claude-logs** — RIAWORKS unified logging system (hooks, watch-context, env var control)
- **read-transcript** — Interactive Claude Code transcript reader

---

*By RIAWORKS — 2026-03-08*
