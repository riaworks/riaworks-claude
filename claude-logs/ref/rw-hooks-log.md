# rw-hooks-log — Hook Operational Log

**Logger function:** `logSynapse()`, `logEngineMetrics()`, `logOp()`
**Env var:** `RW_HOOK_LOG=1` (summary) or `RW_HOOK_LOG=2` (verbose)
**Log file:** `.logs/rw-hooks.log`
**Defined in:** `.riaworks-claude/claude-logs/hooks/lib/rw-hook-logger.js`

---

## What It Is

Lightweight operational log that records the **execution status** of Claude Code hooks. Answers the question: "is the hook working or failing?"

At level 1 (summary): logs prompt truncated, session ID, bracket, rule count, XML size, static context summary, and engine metrics.
At level 2 (verbose): also logs the full injected XML.

## Why It Exists

The original AIOX repository has no logging system for hooks. When a hook fails, Claude Code only shows "hook error" with no details. Without logs, it is impossible to diagnose:

- Whether the hook is executing
- Whether the session was created
- Whether the runtime resolved correctly
- Which error caused the failure
- How many rules were injected

## What Causes Missing SYNAPSE

Any hook failure prevents rule injection. The log records exactly where the flow broke:

| Log Entry | Meaning | SYNAPSE injected? |
|-----------|---------|-------------------|
| `--- SYNAPSE ---` with rules > 0 | Pipeline executed, rules injected | Yes |
| `--- SYNAPSE ---` with rules = 0 | Pipeline ran but no rules found | No |
| `[ERROR] rw-synapse-log crashed` | Fatal hook error | No |
| No entry at all | Hook did not execute | No |

## How to Activate

Add `RW_HOOK_LOG=1` before the hook command in `.claude/settings.local.json`:

```json
"UserPromptSubmit": [{
  "hooks": [{
    "type": "command",
    "command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
  }]
}]
```

For verbose (includes full XML):
```json
"command": "RW_HOOK_LOG=2 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
```

## How to Deactivate

Remove `RW_HOOK_LOG=1` from the command:

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-hooks.log

# Real time
tail -f .logs/rw-hooks.log

# Errors only
grep ERROR .logs/rw-hooks.log

# Last 20 lines
tail -20 .logs/rw-hooks.log
```

## Log Format

```
--- SYNAPSE ---------------------------------------- 16:03:28 ---
  prompt:  teste de nomenclatura rw
  session: e38b56d8 | bracket: FRESH | rules: 59 | xml: 3.8K
  static:  CLAUDE.md(14.2K), rules/5(11.3K), MEMORY.md(1.2K)
  --- engine metrics ---
  pipeline: 45.2ms | loaded: 3 | skipped: 2 | errors: 0 | rules: 59
  layers:   [l0-constitution:12r/5.1ms, l1-global:35r/20.3ms, l2-agent:12r/15.8ms]
  --- end metrics ---
```

Each prompt generates one entry. Lightweight, minimal performance impact.

## Behavior

- **Opt-in:** only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Unified:** all events (synapse, code-intel, skill) write to the same `.logs/rw-hooks.log`

---

*RIAWORKS — 2026-03-08*
