# RIAWORKS Claude Logs — Hook Wrappers

RIAWORKS wrapper hooks that replace the default AIOX hooks with unified logging.

## Ownership

| Directory | Owner | Modifiable |
|-----------|-------|------------|
| `.claude/hooks/` | **AIOX** (framework original) | NEVER modify |
| `.riaworks-claude/claude-logs/hooks/` | **RIAWORKS** (plugin) | Free |

## Structure

```
.riaworks-claude/claude-logs/hooks/
├── rw-synapse-log.cjs         ← UserPromptSubmit wrapper (replaces synapse-engine.cjs)
├── rw-pretool-log.cjs         ← PreToolUse wrapper (replaces code-intel-pretool.cjs)
├── lib/
│   ├── rw-hook-logger.js      ← Unified logger (zero AIOX dependencies)
│   └── rw-read-stdin.js       ← Windows-safe stdin reader
└── README.md                  ← This file
```

## How It Works

### rw-synapse-log.cjs (UserPromptSubmit)

Wrapper that:
1. Reads stdin via `lib/rw-read-stdin.js` (Windows backslash sanitization)
2. Delegates to AIOX `resolveHookRuntime()` + `SynapseEngine.process()`
3. Logs via `lib/rw-hook-logger.js` → `.logs/rw-hooks.log`
4. Writes JSON output to stdout for Claude Code

**AIOX original:** `.claude/hooks/synapse-engine.cjs` (preserved, not used when plugin is active)

### rw-pretool-log.cjs (PreToolUse)

Wrapper that:
- **Write/Edit:** Queries AIOX entity registry (`resolveCodeIntel`) and injects `<code-intel-context>`
- **Skill:** Logs agent activation only (no injection)

**AIOX original:** `.claude/hooks/code-intel-pretool.cjs` (preserved, not used when plugin is active)

### lib/rw-hook-logger.js

Unified logger, zero AIOX dependencies.
- Env var: `RW_HOOK_LOG` = `0` (off) | `1` (summary) | `2` (verbose + XML)
- Output: `.logs/rw-hooks.log`
- Functions: `logSynapse()`, `logEngineMetrics()`, `logCodeIntel()`, `logSkill()`, `logOp()`

### lib/rw-read-stdin.js

Shared stdin reader with Windows backslash sanitization (`sanitizeJsonString()` fallback).

## Configuration

Registered in `.claude/settings.local.json` (in the main project):

### Activated (with logging):

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-session-digest.cjs"
      }]
    }]
  }
}
```

### Deactivated (revert to AIOX originals):

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/synapse-engine.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit"
    }]
  }
}
```

## Watch Logs

```bash
# Via rw-watch-context.js
node .riaworks-claude/claude-logs/rw-watch-context.js

# Or directly
tail -f .logs/rw-hooks.log
```

## Full Documentation

See `claude-logs/docs/manual.md`.
