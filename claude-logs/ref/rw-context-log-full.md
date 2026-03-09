# rw-context-log-full — Unified Full Log

**Logger functions:** `logSynapse()` + `logEngineMetrics()` + `logCodeIntel()` + `logSkill()`
**Env var:** `RW_HOOK_LOG=2`
**Log file:** `.logs/rw-hooks.log`
**Defined in:** Both wrapper hooks (`rw-synapse-log.cjs` + `rw-pretool-log.cjs`)

---

## What It Is

Unified log that records **everything injected** into Claude Code on each interaction. Answers the question: "what is the complete context that Claude is receiving?"

Using `RW_HOOK_LOG=2` on both hooks captures all events in a single chronological `.logs/rw-hooks.log` file.

## What It Captures

| Section | Source | When |
|---------|--------|------|
| `--- SYNAPSE ---` | Prompt, session, bracket, rule count, static context | Each prompt |
| `--- injected xml ---` | Full `<synapse-rules>` XML (level 2 only) | Each prompt |
| `--- engine metrics ---` | Pipeline timing, per-layer breakdown | Each prompt |
| `--- CODE-INTEL ---` | Tool, file, entity, refs, deps | Each Write/Edit |
| `--- SKILL ---` | Skill name, resolved file, size | Each Skill activation |

## How to Activate

Set `RW_HOOK_LOG=2` on **both** hooks in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "RW_HOOK_LOG=2 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "RW_HOOK_LOG=2 node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }]
  }
}
```

## How to Deactivate

Remove `RW_HOOK_LOG=2` from both hook commands, or set to `0`:

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
"command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-hooks.log

# Real time (best for interactive debugging)
tail -f .logs/rw-hooks.log

# Synapse entries only
grep -A 10 "SYNAPSE" .logs/rw-hooks.log

# Code-intel entries only
grep -A 5 "CODE-INTEL" .logs/rw-hooks.log

# Skill entries only
grep -A 5 "SKILL" .logs/rw-hooks.log
```

## Log Format

### Chronological sequence:

```
--- SYNAPSE ---------------------------------------- 17:10:44 ---
  prompt:  crie o componente de login
  session: abc12345 | bracket: FRESH | rules: 59 | xml: 3.8K
  static:  CLAUDE.md(14.2K), rules/5(11.3K), MEMORY.md(1.2K)
  --- injected xml ---
  <synapse-rules>
    [CONTEXT BRACKET]
    CONTEXT BRACKET: [FRESH] (99.1% remaining)
    ...
  </synapse-rules>
  --- end xml ---
  --- engine metrics ---
  pipeline: 45.2ms | loaded: 3 | skipped: 2 | errors: 0 | rules: 59
  layers:   [l0-constitution:12r/5.1ms, l1-global:35r/20.3ms, l2-agent:12r/15.8ms]
  --- end metrics ---

--- CODE-INTEL ------------------------------------- 17:10:45 ---
  tool:   Edit -> src/components/Login.tsx
  entity: src/components/Login.tsx
  refs: 1 | deps: 0
  --- injected xml ---
  <code-intel-context>
    <target-file>src/components/Login.tsx</target-file>
    ...
  </code-intel-context>
  --- end xml ---

--- SKILL ------------------------------------------ 17:11:02 ---
  skill: AIOX:agents:pm
  file:  .aiox-core/development/agents/pm.md
  size:  4.2K (loaded by Skill tool, NOT by this hook)
```

## Logging Levels

| Level | Env var | What gets logged | Weight |
|-------|---------|-----------------|--------|
| Off | (none) | Nothing | 0 |
| Summary | `RW_HOOK_LOG=1` | Prompt, session, bracket, rules, metrics, code-intel summary, skills | ~200B/prompt |
| Verbose | `RW_HOOK_LOG=2` | Everything above + full XML blocks | ~4-5KB/prompt |

## Behavior

- **Opt-in:** only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Unified:** all events from both hooks write to the same `.logs/rw-hooks.log` file

---

*RIAWORKS — 2026-03-08*
