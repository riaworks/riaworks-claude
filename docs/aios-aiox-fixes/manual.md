# AIOS/AIOX Hook Fix Pack — Manual

Fix pack for the Synkra AIOS/AIOX hook system. Contains 4 corrected files ready to apply to any AIOS project.

## Pack Contents

```
aios-aiox-fixes/
├── hook-fix-pack/
│   ├── hook-runtime.js                  # Main hook runtime
│   ├── synapse-engine.cjs               # UserPromptSubmit hook
│   ├── precompact-session-digest.cjs    # PreCompact hook
│   └── settings.json                    # Claude hook configuration
├── ativar-log-aios.md                   # Prompt to enable logging (step by step)
└── prompt-aplicar-log-system.md         # Prompt to apply on aios-core-fork
```

## File Mapping

| File in pack | Destination in AIOS project |
|---|---|
| `settings.json` | `.claude/settings.json` |
| `synapse-engine.cjs` | `.claude/hooks/synapse-engine.cjs` |
| `precompact-session-digest.cjs` | `.claude/hooks/precompact-session-digest.cjs` |
| `hook-runtime.js` | `.aios-core/core/synapse/runtime/hook-runtime.js` |

## Bugs Fixed (9 total)

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | "UserPromptSubmit hook error" on every prompt | `precompact-session-digest.cjs` registered as UserPromptSubmit | Removed from UserPromptSubmit in settings.json |
| 2 | Hook output rejected by Claude Code | Missing `hookEventName` in JSON output | Added `hookEventName: 'UserPromptSubmit'` in `buildHookOutput()` |
| 3 | stdout cutoff on Windows | `process.exit(0)` kills pipe before flush | Removed `process.exit()` from all hooks |
| 4 | Session never persisted | `createSession()` never called in flow | Called `createSession()` when `loadSession()` returns null |
| 5 | precompact runner not found | Fixed path doesn't find the runner | Tries 2 paths: `node_modules/aios-core/` and `.aios-core/` at root |
| 6 | No diagnostic logs | No logging in hooks | `hookLog()` writes to `.logs/hooks.log` |
| 7 | `$CLAUDE_PROJECT_DIR` on Windows | Bash variable doesn't expand in cmd.exe | Relative path `node .claude/hooks/synapse-engine.cjs` |
| 8 | `timeout: 10` kills hook | 10ms too low | Timeout removed from settings.json |
| 9 | .tmp files deleted while in use | cleanOrphanTmpFiles without age check | 60s age threshold before deleting |

## How to Apply

### Method 1: Manual copy

1. Create the logs directory:
```bash
mkdir -p .logs
echo -e "*\n!.gitignore" > .logs/.gitignore
```

2. Copy each file to the correct destination (see mapping table above).

3. Verify:
```bash
cat .logs/hooks.log 2>/dev/null || echo "Log will be created on next prompt"
```

4. Run any prompt in Claude Code and check:
```bash
cat .logs/hooks.log
```

### Method 2: Prompt in Claude Code

Copy the full content of `ativar-log-aios.md` and paste it into Claude Code in the target project. Claude will apply all changes automatically.

## Logging System

The fix pack adds the `hookLog()` function that writes logs to `.logs/hooks.log`:

```
[2026-03-04T00:34:19.976Z] [INFO] Session created: abc-123-def
[2026-03-04T00:34:19.980Z] [INFO] Runtime resolved — session=abc-123-def, prompt_count=0, bracket=FRESH
[2026-03-04T00:34:20.150Z] [INFO] Hook output: 25 rules, bracket=FRESH, xml=2847 bytes
```

Characteristics:
- **Fire-and-forget** — never blocks hook execution
- `.logs/` has `.gitignore` with `*` — never gets committed to git
- Directory created automatically on first prompt
- To disable: remove `hookLog()` calls or delete `.logs/`
- For rotation: manually delete `.logs/hooks.log` when it grows

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

Based on PR #551 (riaworks/aios-core) + CodeRabbit review + aios-bug/ documentation.

---

*By RIAWORKS — 2026-03-04*
