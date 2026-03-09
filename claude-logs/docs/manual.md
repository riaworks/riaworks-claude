# RIAWORKS Claude Logs v2 — Manual

Logging plugin for [Synkra AIOX](https://github.com/SynkraAI/aiox-core) Claude Code hooks. Provides unified logging via **subprocess wrapper** hooks that execute AIOX originals as child processes.

**[Leia em Portugues](manual-pt-BR.md)**

## Overview

Claude Code injects invisible context into every prompt via hooks. Without logging, it's impossible to know what rules were injected, if the hook failed, or what code-intel data the agent received.

This plugin provides:
- **Subprocess wrapper hooks** that execute AIOX originals as child processes and capture output
- **Unified log file** (`.logs/rw-hooks.log`) with 2 verbosity levels
- **6 event types**: SYNAPSE, CODE-INTEL, SKILL, AIOX-RUNTIME, POSTTOOL, operational
- **Real-time log monitor** (`rw-watch-context.js`)

> **Prerequisites:** The structural fixes from **aiox-fixes** should be applied first (S1).

## Pack Contents

```
claude-logs/
├── prompt-apply-logging.md           # Self-service installer prompt (English)
├── rw-watch-context.js               # Real-time log monitor
├── hooks/                            # RIAWORKS wrapper hooks (plugin)
│   ├── rw-synapse-log.cjs           # UserPromptSubmit subprocess wrapper
│   ├── rw-pretool-log.cjs           # PreToolUse subprocess wrapper
│   ├── rw-posttool-log.cjs          # PostToolUse result logger (NEW in v2)
│   ├── lib/
│   │   ├── rw-hook-logger.js        # Unified logger library (6 event types)
│   │   └── rw-read-stdin.js         # Windows-safe stdin reader
│   └── README.md                    # Hooks documentation
├── ref/                              # Reference files
│   └── legacy/                      # Legacy log format specs (archived)
└── docs/                             # Documentation
    ├── manual.md                     # This file
    └── manual-pt-BR.md             # Portuguese version
```

## Architecture (v2 — Subprocess Wrapper)

The v2 architecture uses **subprocess execution** instead of importing AIOX modules directly. This makes RIAWORKS hooks a pure external observer with zero hard-dependency on AIOX internals.

```
Claude Code Hook System
│
├── UserPromptSubmit
│   └── rw-synapse-log.cjs (RIAWORKS wrapper)
│       ├── READS: stdin from Claude Code
│       ├── EXECUTES: synapse-engine.cjs as subprocess (execFileSync)
│       ├── CAPTURES: stdout (JSON with synapse rules)
│       ├── READS: .synapse/metrics/hook-metrics.json (engine metrics)
│       ├── LOGS: SYNAPSE + AIOX-RUNTIME events → .logs/rw-hooks.log
│       └── FORWARDS: AIOX stdout to Claude Code
│
├── PreToolUse (Write|Edit|Skill)
│   └── rw-pretool-log.cjs (RIAWORKS wrapper)
│       ├── if Skill: logs agent activation (no subprocess)
│       ├── if Write/Edit:
│       │   ├── EXECUTES: code-intel-pretool.cjs as subprocess
│       │   ├── CAPTURES: stdout (code-intel XML)
│       │   ├── LOGS: CODE-INTEL event → .logs/rw-hooks.log
│       │   └── FORWARDS: AIOX stdout to Claude Code
│
├── PostToolUse (Write|Edit) — NEW in v2
│   └── rw-posttool-log.cjs (RIAWORKS)
│       ├── READS: stdin (tool_name, tool_input, tool_result)
│       ├── LOGS: POSTTOOL event → .logs/rw-hooks.log
│       └── No injection (tool already executed)
│
└── PreCompact
    └── precompact-wrapper.cjs (AIOX original — no RIAWORKS wrapper)
```

**Key principle:** RIAWORKS hooks are pure observers. They execute AIOX hooks as subprocesses, capture their output, log it, and forward it to Claude Code. Zero `require()` calls to AIOX internal modules.

## Logging Reference

### Single Env Var

| Value | Level | What gets logged | Weight |
|-------|-------|-----------------|--------|
| (unset) | Off | Nothing | 0 |
| `RW_HOOK_LOG=1` | Summary | Prompt, session, bracket, rules, metrics, code-intel summary, skills | ~200B/prompt |
| `RW_HOOK_LOG=2` | Verbose | Everything above + full XML blocks + error details | ~4-5KB/prompt |

### Log Events

| Event | Hook | What it captures |
|-------|------|------------------|
| **SYNAPSE** | UserPromptSubmit | Prompt, session, bracket, rule count, static context |
| **AIOX-RUNTIME** | UserPromptSubmit | Pipeline duration, layers loaded/skipped/errored, per-layer breakdown |
| **CODE-INTEL** | PreToolUse (Write/Edit) | Tool name, file path, entity, refs, deps |
| **SKILL** | PreToolUse (Skill) | Skill name, resolved file path, file size |
| **POSTTOOL** | PostToolUse (Write/Edit) | Tool name, file path, success/fail, result size |

All events write to the same unified `.logs/rw-hooks.log` file.

AIOX core also writes operational diagnostics to `.logs/rw-aiox-log.log` (env: `RW_AIOX_LOG=1`).

## Activate / Deactivate

### Activate (install plugin)

Update `.claude/settings.local.json` to point to wrapper hooks:

```json
{
  "env": {
    "RW_HOOK_LOG": "1",
    "RW_AIOX_LOG": "1"
  },
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "PostToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-posttool-log.cjs"
      }],
      "matcher": "Write|Edit"
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

### Deactivate (revert to AIOX originals)

Change `.claude/settings.local.json` back to the AIOX original hooks:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/synapse-wrapper.cjs"
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
        "command": "node .claude/hooks/precompact-wrapper.cjs"
      }]
    }]
  }
}
```

### Disable logging only (keep wrappers)

Remove `RW_HOOK_LOG` from the `env` section (or set to `"0"`).

### Behavior (all logs)

- **Opt-in:** Only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Fire-and-forget:** Never blocks hook execution
- **Auto-create:** Creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** Never overwrites, always appends
- **Subprocess isolation:** AIOX hooks run in child process — crashes don't affect wrapper

## Real-Time Monitor

```bash
node .riaworks-claude/claude-logs/rw-watch-context.js
```

Watches `.logs/rw-hooks.log` in real-time. Color-coded by event type:
- **SYNAPSE** (cyan), **CODE-INTEL** (blue), **SKILL** (magenta)
- **AIOX-RUNTIME** (yellow), **POSTTOOL** (green), **ERROR** (red)

## Naming Convention

| File | Purpose |
|------|---------|
| `rw-synapse-log.cjs` | UserPromptSubmit subprocess wrapper |
| `rw-pretool-log.cjs` | PreToolUse subprocess wrapper |
| `rw-posttool-log.cjs` | PostToolUse result logger (NEW) |
| `lib/rw-hook-logger.js` | Unified logger library (6 events) |
| `lib/rw-read-stdin.js` | Windows-safe stdin reader |
| `rw-watch-context.js` | Real-time log monitor |

## Related Packages

- **[aiox-fixes](../../aiox-fixes/)** — 9 structural bug fixes for AIOX hooks (prerequisite)
- **[read-transcript](../../read-transcript/)** — Interactive Claude Code transcript reader

---

*By RIAWORKS — 2026-03-09 — v2.0*
