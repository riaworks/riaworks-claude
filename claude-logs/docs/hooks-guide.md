# Claude Logs — Hooks Guide

Guide for the RIAWORKS hook system that extends AIOX hooks with unified logging and code intelligence.

## Architecture Overview

```
Claude Code ──► .riaworks-claude/claude-logs/hooks/ (RIAWORKS wrappers)
                        │
                        ├── synapse-logged.cjs      ← UserPromptSubmit
                        │         │
                        │         └── delegates to AIOX resolveHookRuntime() + SynapseEngine
                        │
                        ├── code-intel-pretool.cjs   ← PreToolUse (Write|Edit|Skill)
                        │         │
                        │         └── delegates to AIOX resolveCodeIntel()
                        │
                        └── lib/
                              ├── hook-logger.js     ← Unified logger
                              └── read-stdin.js      ← Windows-safe stdin reader

Claude Code ──► .claude/hooks/ (AIOX originals — NEVER modify)
                        ├── synapse-engine.cjs       ← Original (not used directly)
                        ├── synapse-wrapper.cjs      ← Isolation wrapper
                        ├── precompact-wrapper.cjs   ← PreCompact isolation wrapper
                        └── precompact-session-digest.cjs
```

## How It Works

### 1. UserPromptSubmit — `synapse-logged.cjs`

Triggered on **every user prompt**. Pipeline:

1. Read stdin via `lib/read-stdin.js` (sanitizes Windows backslashes)
2. Delegate to AIOX `resolveHookRuntime()` to get session + SynapseEngine
3. Run `engine.process(prompt, session)` to generate `<synapse-rules>` XML
4. Persist session bracket transition via AIOX `updateSession()`
5. Build hook output via AIOX `buildHookOutput(xml)`
6. Log via RIAWORKS `hook-logger.js` (synapse metrics, XML if verbose)
7. Write JSON to stdout for Claude Code

**Output format:**
```json
{
  "hookSpecificOutput": {
    "additionalContext": "<synapse-rules>...</synapse-rules>"
  }
}
```

### 2. PreToolUse — `code-intel-pretool.cjs`

Triggered **before Write, Edit, or Skill** tool calls.

**Write/Edit:** Queries AIOX entity registry via `resolveCodeIntel(filePath)` and injects `<code-intel-context>` XML with file dependencies, conventions, and related entities.

**Skill:** Logs agent activation only (no injection).

### 3. PreCompact — `precompact-wrapper.cjs` (AIOX)

Uses the original AIOX wrapper (not wrapped by RIAWORKS). Runs `precompact-session-digest.cjs` in a child process for stdout/stderr isolation.

## Logging Configuration

### Environment Variable

| Value | Level | Description |
|-------|-------|-------------|
| `RW_HOOK_LOG=0` | Off | No logging |
| `RW_HOOK_LOG=1` | Summary | One-line per hook execution |
| `RW_HOOK_LOG=2` | Verbose | Full details including XML content |

Set in `.claude/settings.local.json`:
```json
{ "env": { "RW_HOOK_LOG": "2" } }
```

### Log File

Single unified file: `.logs/rw-hooks.log`

Example output (level 1):
```
[2026-03-08 14:30:19] [SYNAPSE] bracket=FRESH rules=25 xml=2847B session=abc-123
[2026-03-08 14:30:20] [CODE-INTEL] Write → src/app.js intel=1247B
[2026-03-08 14:30:21] [SKILL] AIOX:agents:dev → .aiox-core/development/agents/dev.md (3.2KB)
```

### Real-Time Monitoring

```bash
# RIAWORKS watch-context (with formatting)
node .riaworks-claude/claude-logs/watch-context.js

# Or plain tail
tail -f .logs/rw-hooks.log
```

## Hook Registration

In `.claude/settings.local.json` (project-level):

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/synapse-logged.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-wrapper.cjs"
      }]
    }]
  }
}
```

## Ownership Rules

| Path | Owner | Rule |
|------|-------|------|
| `.claude/hooks/*` | AIOX | NEVER modify — originals from SynkraAI/aiox-core |
| `.riaworks-claude/claude-logs/hooks/*` | RIAWORKS | Free to modify |
| `.aiox-core/core/*` | AIOX L1 | NEVER modify — framework core |

## Troubleshooting

### Hook not executing
1. Check `settings.local.json` paths match actual file locations
2. Verify Node.js 18+ is available
3. Check `.logs/rw-hooks.log` for error entries

### No log output
1. Verify `RW_HOOK_LOG` is set to 1 or 2 in settings.local.json env
2. Check `.logs/` directory exists and is writable

### Windows-specific issues
- Hooks use `lib/read-stdin.js` which sanitizes Windows backslashes in JSON
- No `process.exit()` — hooks exit naturally to prevent stdout pipe cutoff
- Use relative paths in settings.json (no `$CLAUDE_PROJECT_DIR`)

---

*By RIAWORKS — 2026-03-08*
