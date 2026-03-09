# RIAWORKS Claude Logs — Manual

Logging system for [Synkra AIOX](https://github.com/SynkraAI/aiox-core) Claude Code hooks. Provides 4 log levels to diagnose and trace context injection.

**[Leia em Portugues](manual-pt-BR.md)**

## Overview

Claude Code injects invisible context into every prompt via hooks. Without logging, it's impossible to know what rules were injected, if the hook failed, or what code-intel data the agent received.

This package provides:
- **4 logging functions** (`rw-*`) with independent env var control
- **RIAWORKS hook wrappers** (optional, for projects using the riaworks-claude hooks)
- **Real-time log monitor** (`watch-context.js`)

> **Prerequisites:** The structural fixes from **aiox-fixes** should be applied first.

## Pack Contents

```
claude-logs/
├── prompt-apply-logging.md           # Self-service prompt (English)
├── watch-context.js                  # Real-time log monitor
├── hooks/                            # RIAWORKS hook wrappers (optional)
│   ├── synapse-logged.cjs            # UserPromptSubmit with logging
│   ├── code-intel-pretool.cjs        # PreToolUse with logging
│   ├── lib/
│   │   ├── hook-logger.js            # Unified logger library
│   │   └── read-stdin.js             # Windows-safe stdin reader
│   └── README.md                     # Hooks documentation
└── docs/
    ├── manual.md                     # This file
    ├── manual-pt-BR.md               # Portuguese version
    ├── rw-hooks-log.md               # rwHooksLog() documentation
    ├── rw-synapse-trace.md           # rwSynapseTrace() documentation
    ├── rw-intel-context-log.md       # rwIntelContextLog() documentation
    ├── rw-context-log-full.md        # rwContextLogFull() documentation
    └── 04-fix-skill-logging.md       # Skill activation logging
```

## Logging Reference

All RIAWORKS logging extensions use the `rw-` prefix. There are **4 logs**: 3 individual + 1 unified.

### Quick Reference

| # | Log | Env Var | Log File | Hook | Weight |
|---|-----|---------|----------|------|--------|
| 1 | **rw-hooks-log** | `RW_HOOKS_LOG=1` | `.logs/rw-hooks-log.log` | UserPromptSubmit | Light (~100B/prompt) |
| 2 | **rw-synapse-trace** | `RW_SYNAPSE_TRACE=1` | `.logs/rw-synapse-trace.log` | UserPromptSubmit | Heavy (~4KB/prompt) |
| 3 | **rw-intel-context-log** | `RW_INTEL_CONTEXT_LOG=1` | `.logs/rw-intel-context-log.log` | PreToolUse (Write/Edit/Skill) | Conditional |
| 4 | **rw-context-log-full** | `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-context-log-full.log` | Both | Heavy (~5-10KB/prompt) |

### 1. rw-hooks-log — Operational Status

Answers: "is the hook working or failing?"

Records hook lifecycle events: session created, runtime resolved, errors. Does **not** record content (prompts, XML). First line of diagnosis.

Full documentation: [`rw-hooks-log.md`](rw-hooks-log.md)

### 2. rw-synapse-trace — SYNAPSE XML Trace

Answers: "what rules exactly were injected?"

Records the full SYNAPSE XML injected as `additionalContext` on every prompt. Use when you need to see the exact rules Claude received.

Full documentation: [`rw-synapse-trace.md`](rw-synapse-trace.md)

### 3. rw-intel-context-log — Code-Intel Injection

Answers: "what code context was injected when the agent edited this file?"

Records `<code-intel-context>` XML on Write/Edit operations and agent prompts loaded via Skill activation.

Full documentation: [`rw-intel-context-log.md`](rw-intel-context-log.md)

### 4. rw-context-log-full — Unified Full Log

Answers: "what is the complete context Claude is receiving?"

Captures everything in a single chronological log: user prompt, session, SYNAPSE XML, static context listing, code-intel XML, and agent prompts.

Full documentation: [`rw-context-log-full.md`](rw-context-log-full.md)

### Individual vs Full

| Individual Log | Included in Full? | Can be used alone? |
|----------------|--------------------|--------------------|
| `RW_HOOKS_LOG` | Yes | Yes |
| `RW_SYNAPSE_TRACE` | Yes | Yes |
| `RW_INTEL_CONTEXT_LOG` | Yes | Yes |
| `RW_CONTEXT_LOG_FULL` | N/A — is the unified master | Yes |

**Full replaces all 3 individuals.** When `RW_CONTEXT_LOG_FULL=1` is active, you do not need the individual env vars.

### Recommended Combinations

| Scenario | Configuration |
|----------|---------------|
| Quick health check | `RW_HOOKS_LOG=1` only |
| Debug missing rules | `RW_HOOKS_LOG=1 RW_SYNAPSE_TRACE=1` |
| Debug code-intel only | `RW_INTEL_CONTEXT_LOG=1` on PreToolUse |
| Full diagnostic session | `RW_CONTEXT_LOG_FULL=1` on both hooks |

## Activation

Logging variables are set as **inline env vars** in the hook command inside `.claude/settings.local.json`. They are NOT activated via `export`.

### Where to Configure

| Hook Event | Script | Accepts |
|------------|--------|---------|
| `UserPromptSubmit` | `synapse-engine.cjs` | `RW_HOOKS_LOG`, `RW_SYNAPSE_TRACE`, `RW_CONTEXT_LOG_FULL` |
| `PreToolUse` (Write\|Edit\|Skill) | `code-intel-pretool.cjs` | `RW_INTEL_CONTEXT_LOG`, `RW_CONTEXT_LOG_FULL` |

### Examples

**Default (all logging disabled):**
```json
"command": "node .claude/hooks/synapse-engine.cjs"
```

**Hook log only (lightweight, recommended):**
```json
"command": "RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs"
```

**Full unified (both hooks):**
```json
"command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/synapse-engine.cjs"
"command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/code-intel-pretool.cjs"
```

### Behavior (all logs)

- **Opt-in:** Only writes when the env var is set to `1`
- **Fire-and-forget:** Never blocks hook execution
- **Auto-create:** Creates `.logs/` with `.gitignore` if it doesn't exist
- **Append-only:** Never overwrites, always appends

## How to Apply

1. Apply structural fixes first (see **aiox-fixes** package)
2. Copy the content of `prompt-apply-logging.md` and paste into Claude Code
3. Claude will read all log docs, verify prerequisites, apply logging, and validate

## Real-Time Monitor

```bash
node .riaworks-claude/claude-logs/watch-context.js
```

Watches `.logs/rw-hooks.log` in real-time (similar to `tail -f`).

## Naming Convention

| Function | Env Var | Log File |
|----------|---------|----------|
| `rwHooksLog()` | `RW_HOOKS_LOG=1` | `.logs/rw-hooks-log.log` |
| `rwSynapseTrace()` | `RW_SYNAPSE_TRACE=1` | `.logs/rw-synapse-trace.log` |
| `rwIntelContextLog()` | `RW_INTEL_CONTEXT_LOG=1` | `.logs/rw-intel-context-log.log` |
| `rwSkillLog()` | `RW_INTEL_CONTEXT_LOG=1` or `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-intel-context-log.log` + `.logs/rw-context-log-full.log` |
| `rwContextLogFull()` | `RW_CONTEXT_LOG_FULL=1` | `.logs/rw-context-log-full.log` |

## Related Packages

- **[aiox-fixes](../../aiox-fixes/)** — 9 structural bug fixes for AIOX hooks (prerequisite)
- **[read-transcript](../../read-transcript/)** — Interactive Claude Code transcript reader

---

*By RIAWORKS — 2026-03-08*
