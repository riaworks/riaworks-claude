# RIAWORKS Claude Logs — Manual

Logging plugin for [Synkra AIOX](https://github.com/SynkraAI/aiox-core) Claude Code hooks. Provides unified logging via wrapper hooks that replace the AIOX originals.

**[Leia em Portugues](manual-pt-BR.md)**

## Overview

Claude Code injects invisible context into every prompt via hooks. Without logging, it's impossible to know what rules were injected, if the hook failed, or what code-intel data the agent received.

This plugin provides:
- **Wrapper hooks** that replace AIOX originals and add logging
- **Unified log file** (`.logs/rw-hooks.log`) with 2 verbosity levels
- **Real-time log monitor** (`rw-watch-context.js`)

> **Prerequisites:** The structural fixes from **aiox-fixes** should be applied first.

## Pack Contents

```
claude-logs/
├── prompt-apply-logging.md           # Self-service installer prompt (English)
├── rw-watch-context.js               # Real-time log monitor
├── hooks/                            # RIAWORKS wrapper hooks (plugin)
│   ├── rw-synapse-log.cjs           # UserPromptSubmit wrapper
│   ├── rw-pretool-log.cjs           # PreToolUse wrapper
│   ├── lib/
│   │   ├── rw-hook-logger.js        # Unified logger library
│   │   └── rw-read-stdin.js         # Windows-safe stdin reader
│   └── README.md                    # Hooks documentation
├── ref/                              # Reference files (read by prompt)
│   ├── rw-hooks-log.md              # Operational log specification
│   ├── rw-synapse-trace.md          # SYNAPSE XML trace specification
│   ├── rw-intel-context-log.md      # Code-intel injection specification
│   ├── rw-context-log-full.md       # Unified full log specification
│   └── rw-skill-log.md             # Skill/agent activation specification
└── docs/                             # Documentation
    ├── manual.md                     # This file
    └── manual-pt-BR.md             # Portuguese version
```

## Architecture

The plugin uses **wrapper hooks** that delegate to AIOX core functions and add logging. The original AIOX hooks are preserved untouched.

```
settings.local.json
  └── UserPromptSubmit → rw-synapse-log.cjs (wrapper)
        ├── reads stdin via lib/rw-read-stdin.js
        ├── delegates to AIOX resolveHookRuntime + SynapseEngine
        ├── logs via lib/rw-hook-logger.js → .logs/rw-hooks.log
        └── writes JSON output to stdout
  └── PreToolUse → rw-pretool-log.cjs (wrapper)
        ├── Write/Edit: delegates to AIOX resolveCodeIntel + logs
        └── Skill: logs agent activation (no injection)
```

**Important:** The wrapper hooks and the AIOX original hooks are mutually exclusive. Only ONE should be configured in `settings.local.json` at a time. Running both would cause duplicate context injection.

## Logging Reference

### Single Env Var

| Value | Level | What gets logged | Weight |
|-------|-------|-----------------|--------|
| (unset) | Off | Nothing | 0 |
| `RW_HOOK_LOG=1` | Summary | Prompt, session, bracket, rules, metrics, code-intel summary, skills | ~200B/prompt |
| `RW_HOOK_LOG=2` | Verbose | Everything above + full XML blocks | ~4-5KB/prompt |

### Log Events

| Event | Hook | What it captures |
|-------|------|------------------|
| **SYNAPSE** | UserPromptSubmit | Prompt, session, bracket, rule count, static context, engine metrics |
| **CODE-INTEL** | PreToolUse (Write/Edit) | Tool name, file path, entity, refs, deps |
| **SKILL** | PreToolUse (Skill) | Skill name, resolved file path, file size |

All events write to the same unified `.logs/rw-hooks.log` file.

Full specifications: [`ref/rw-hooks-log.md`](../ref/rw-hooks-log.md), [`ref/rw-synapse-trace.md`](../ref/rw-synapse-trace.md), [`ref/rw-intel-context-log.md`](../ref/rw-intel-context-log.md), [`ref/rw-context-log-full.md`](../ref/rw-context-log-full.md), [`ref/rw-skill-log.md`](../ref/rw-skill-log.md)

## Activate / Deactivate

### Activate (install plugin)

Update `.claude/settings.local.json` to point to wrapper hooks:

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

Or use the installer prompt: copy `prompt-apply-logging.md` and paste into Claude Code.

### Deactivate (revert to AIOX originals)

Change `.claude/settings.local.json` back to the AIOX original hooks:

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

### Disable logging only (keep wrappers)

Remove `RW_HOOK_LOG=1` from the commands:

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
"command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

### Behavior (all logs)

- **Opt-in:** Only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Fire-and-forget:** Never blocks hook execution
- **Auto-create:** Creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** Never overwrites, always appends

## Real-Time Monitor

```bash
node .riaworks-claude/claude-logs/rw-watch-context.js
```

Watches `.logs/rw-hooks.log` in real-time (similar to `tail -f`).

## Naming Convention

| File | Purpose |
|------|---------|
| `rw-synapse-log.cjs` | UserPromptSubmit wrapper hook |
| `rw-pretool-log.cjs` | PreToolUse wrapper hook |
| `lib/rw-hook-logger.js` | Unified logger library |
| `lib/rw-read-stdin.js` | Windows-safe stdin reader |
| `rw-watch-context.js` | Real-time log monitor |

## Related Packages

- **[aiox-fixes](../../aiox-fixes/)** — 9 structural bug fixes for AIOX hooks (prerequisite)
- **[read-transcript](../../read-transcript/)** — Interactive Claude Code transcript reader

---

*By RIAWORKS — 2026-03-08*
