# rwSynapseTrace — Detailed SYNAPSE Trace

**Function:** `rwSynapseTrace(cwd, { prompt, sessionId, bracket, xml })`
**Env var:** `RW_SYNAPSE_TRACE=1`
**Log file:** `.logs/rw-synapse-trace.log`
**Defined in:** `.claude/hooks/synapse-engine.cjs`

---

## What It Is

Detailed trace that records **everything the SYNAPSE injects** into Claude Code on each prompt. Answers the question: "what rules exactly were injected?"

For operational status (hook succeeded/failed), use `rwHooksLog` (see `rw-hooks-log.md`).

## Why It Exists

Claude Code receives multiple context layers, but only SYNAPSE is invisible — rules are injected via `additionalContext` and do not appear in any visible file. Without a trace, it is impossible to know:

- What prompt the user typed
- What bracket the SYNAPSE detected (FRESH, AGENT, MID, etc.)
- Which rules were injected (Constitution, coding standards, domain)
- Whether any rule is missing or duplicated

## Claude Code Context Layers

| Layer | Source | Visible in file? |
|-------|--------|-------------------|
| User message | Typed | No |
| **SYNAPSE rules** | `.synapse/` domains + engine | **No — needs trace** |
| CLAUDE.md | `.claude/CLAUDE.md` | Yes |
| Contextual rules | `.claude/rules/*.md` | Yes |
| MEMORY.md | Auto-memory | Yes |
| Skill prompt | Active skill | No |

The trace captures **only the SYNAPSE layer** — the only one that is completely invisible.

## What Causes Missing SYNAPSE

When the trace shows `(empty)` in the XML output, the possible causes are:

| Cause | Diagnosis in trace |
|-------|--------------------|
| Hook did not execute | No entry in the log |
| JSON parse failed (Windows backslash) | Entry with `(empty)` in all fields |
| `.synapse/` does not exist | No entry (hook exits before trace) |
| Engine did not find rules | BRACKET shows, XML empty |
| Domain not configured | XML present but missing rules from the expected domain |

## How to Activate

Add `RW_SYNAPSE_TRACE=1` before the hook command in `.claude/settings.local.json`:

```json
"UserPromptSubmit": [{
  "hooks": [{
    "type": "command",
    "command": "RW_SYNAPSE_TRACE=1 node .claude/hooks/synapse-engine.cjs"
  }]
}]
```

**Activate both logs:**
```json
"command": "RW_HOOKS_LOG=1 RW_SYNAPSE_TRACE=1 node .claude/hooks/synapse-engine.cjs"
```

## How to Deactivate

Remove `RW_SYNAPSE_TRACE=1` from the command:

```json
"command": "node .claude/hooks/synapse-engine.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-synapse-trace.log

# Real time
tail -f .logs/rw-synapse-trace.log

# User prompts only
grep -A 5 "USER PROMPT" .logs/rw-synapse-trace.log

# Injected XML only
grep -A 50 "SYNAPSE OUTPUT" .logs/rw-synapse-trace.log

# Brackets only
grep "BRACKET:" .logs/rw-synapse-trace.log
```

## Log Format

4 blocks per prompt:

```
================================================================================
[2026-03-06T16:20:07.433Z] USER PROMPT
================================================================================
teste de nomenclatura rw

[2026-03-06T16:20:07.433Z] SESSION ID: rw-naming-test
[2026-03-06T16:20:07.433Z] BRACKET: FRESH

================================================================================
[2026-03-06T16:20:07.433Z] SYNAPSE OUTPUT (injected as additionalContext)
================================================================================
<synapse-rules>
  [CONTEXT BRACKET]
  CONTEXT BRACKET: [FRESH] (99.1% remaining)
  [FRESH] CONTEXT RULES:
    1. Use ES2022 syntax with CommonJS modules...
  ...
  [CONSTITUTION] (NON-NEGOTIABLE)
    CLI First (NON-NEGOTIABLE)
    ...
</synapse-rules>
```

## Behavior

- **Opt-in:** only writes when `RW_SYNAPSE_TRACE=1`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Heavy:** generates ~4KB per prompt (full XML) — use only for debugging

---

*RIAWORKS — 2026-03-06*
