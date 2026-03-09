# rw-synapse-trace — SYNAPSE XML Trace

**Logger function:** `logSynapse()` at level 2
**Env var:** `RW_HOOK_LOG=2`
**Log file:** `.logs/rw-hooks.log`
**Defined in:** `.riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs` (calls `lib/rw-hook-logger.js`)

---

## What It Is

Detailed trace that records **the full SYNAPSE XML injected** into Claude Code on each prompt. Answers the question: "what rules exactly were injected?"

This is the verbose mode (level 2) of the unified logger. Level 1 shows a summary without the XML. Level 2 adds the complete `<synapse-rules>` XML block.

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

## How to Activate

Set `RW_HOOK_LOG=2` (verbose) on the hook command in `.claude/settings.local.json`:

```json
"UserPromptSubmit": [{
  "hooks": [{
    "type": "command",
    "command": "RW_HOOK_LOG=2 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
  }]
}]
```

## How to Deactivate

Remove `RW_HOOK_LOG=2` or set to `1` (summary only) or `0` (off):

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-hooks.log

# Real time
tail -f .logs/rw-hooks.log

# Injected XML blocks only
grep -A 50 "injected xml" .logs/rw-hooks.log

# Brackets only
grep "bracket:" .logs/rw-hooks.log
```

## Log Format (level 2)

```
--- SYNAPSE ---------------------------------------- 16:20:07 ---
  prompt:  teste de nomenclatura rw
  session: e38b56d8 | bracket: FRESH | rules: 59 | xml: 3.8K
  static:  CLAUDE.md(14.2K), rules/5(11.3K)
  --- injected xml ---
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
  --- end xml ---
  --- engine metrics ---
  pipeline: 45.2ms | loaded: 3 | skipped: 2 | errors: 0 | rules: 59
  layers:   [l0-constitution:12r/5.1ms, l1-global:35r/20.3ms, l2-agent:12r/15.8ms]
  --- end metrics ---
```

## Behavior

- **Opt-in:** only writes full XML when `RW_HOOK_LOG=2`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Heavy:** generates ~4KB per prompt (full XML) — use only for debugging

---

*RIAWORKS — 2026-03-08*
