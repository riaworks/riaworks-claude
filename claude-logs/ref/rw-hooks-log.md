# rwHooksLog — Hook Operational Log

**Function:** `rwHooksLog(cwd, level, message)`
**Env var:** `RW_HOOKS_LOG=1`
**Log file:** `.logs/rw-hooks-log.log`
**Defined in:** `.aiox-core/core/synapse/runtime/hook-runtime.js`

---

## What It Is

Lightweight operational log that records the **execution status** of Claude Code hooks. Answers the question: "is the hook working or failing?"

Does not record content (prompts, XML). For that use `rwSynapseTrace` (see `rw-synapse-trace.md`).

## Why It Exists

The original AIOS repository has no logging system for hooks. When a hook fails, Claude Code only shows "hook error" with no details. Without logs, it is impossible to diagnose:

- Whether the hook is executing
- Whether the session was created
- Whether the runtime resolved correctly
- Which error caused the failure
- How many rules were injected

## What Causes Missing SYNAPSE

Any hook failure prevents rule injection. `rwHooksLog` records exactly where the flow broke:

| Log | Meaning | SYNAPSE injected? |
|-----|---------|-------------------|
| `No .synapse/ directory` | .synapse/ directory does not exist | No |
| `Session created: {id}` | First execution of the session | Yes (next log confirms) |
| `Runtime resolved` | Hook executed successfully | Yes |
| `Hook output: N rules` | Rules generated and written to stdout | Yes |
| `Failed to resolve runtime` | Error loading engine/session | No |
| `Hook crashed` | Fatal hook error | No |

## How to Activate

Add `RW_HOOKS_LOG=1` before the hook command in `.claude/settings.local.json`:

```json
"UserPromptSubmit": [{
  "hooks": [{
    "type": "command",
    "command": "RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs"
  }]
}]
```

## How to Deactivate

Remove `RW_HOOKS_LOG=1` from the command:

```json
"command": "node .claude/hooks/synapse-engine.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-hooks-log.log

# Real time
tail -f .logs/rw-hooks-log.log

# Errors only
grep ERROR .logs/rw-hooks-log.log

# Last 20 lines
tail -20 .logs/rw-hooks-log.log
```

## Log Format

```
[2026-03-06T16:03:28.510Z] [INFO] Session created: e38b56d8-af23-47fb-954c
[2026-03-06T16:03:28.587Z] [INFO] Runtime resolved — session=e38b56d8, prompt_count=0, bracket=FRESH
[2026-03-06T16:03:28.592Z] [INFO] Hook output: 59 rules, bracket=FRESH, xml=3881 bytes
```

Each prompt generates 2-3 lines. Lightweight, no performance impact.

## Behavior

- **Opt-in:** only writes when `RW_HOOKS_LOG=1`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends

---

*RIAWORKS — 2026-03-06*
