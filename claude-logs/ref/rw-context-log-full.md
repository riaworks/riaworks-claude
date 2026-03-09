# rwContextLogFull — Unified Log of All Injected Context

**Functions:** `rwContextLogFull()` (synapse-engine.cjs) + `rwIntelContextLog()` (code-intel-pretool.cjs)
**Env var:** `RW_CONTEXT_LOG_FULL=1`
**Log file:** `.logs/rw-context-log-full.log`
**Defined in:** Both hooks

---

## What It Is

Unified log that records **everything that is injected** into Claude Code on each interaction. Answers the question: "what is the complete context that Claude is receiving?"

Replaces the need to activate `RW_HOOKS_LOG`, `RW_SYNAPSE_TRACE`, and `RW_INTEL_CONTEXT_LOG` individually.

## What It Captures

| Section | Source | When |
|---------|--------|------|
| `[USER PROMPT]` | User text | Each prompt |
| `[SESSION]` | Session ID + bracket | Each prompt |
| `[SYNAPSE INJECTION]` | Full `<synapse-rules>` XML | Each prompt |
| `[STATIC CONTEXT]` | Listing of CLAUDE.md, rules/*.md, MEMORY.md | Each prompt |
| `[CODE-INTEL INJECTION]` | `<code-intel-context>` XML | Each Write/Edit |
| `[AGENT PROMPT]` | Full agent .md content | Each Skill activation |

## How to Activate

Add `RW_CONTEXT_LOG_FULL=1` to **both** hooks in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/synapse-engine.cjs"
      }]
    }]
  }
}
```

**Replacing the individual ones:** if you activate full, you can remove the others:

```json
"command": "RW_CONTEXT_LOG_FULL=1 node .claude/hooks/synapse-engine.cjs"
```

Instead of:

```json
"command": "RW_HOOKS_LOG=1 RW_SYNAPSE_TRACE=1 node .claude/hooks/synapse-engine.cjs"
```

## How to Deactivate

Remove `RW_CONTEXT_LOG_FULL=1` from both hook commands.

## How to View

```bash
# Full log
cat .logs/rw-context-log-full.log

# Real time (best for interactive debugging)
tail -f .logs/rw-context-log-full.log

# User prompts only
grep -A 2 "USER PROMPT" .logs/rw-context-log-full.log

# Synapse injections only
grep -A 50 "SYNAPSE INJECTION" .logs/rw-context-log-full.log

# Code-intel injections only
grep -A 20 "CODE-INTEL INJECTION" .logs/rw-context-log-full.log

# Static context only
grep -A 10 "STATIC CONTEXT" .logs/rw-context-log-full.log

# Brackets only
grep "bracket=" .logs/rw-context-log-full.log
```

## Log Format

### UserPromptSubmit entry (each prompt):

```
================================================================================
[2026-03-06T17:10:44.500Z] FULL CONTEXT -- UserPromptSubmit
================================================================================

[USER PROMPT]
crie o componente de login

[SESSION] id=abc123 | bracket=FRESH

[SYNAPSE INJECTION] (additionalContext)
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

[STATIC CONTEXT] (loaded by Claude Code)
  .claude/CLAUDE.md                            (14.2 KB)
  .claude/rules/agent-authority.md             (3.1 KB)
  .claude/rules/agent-handoff.md               (2.9 KB)
  .claude/rules/mcp-usage.md                   (4.0 KB)
  .claude/rules/tool-examples.md               (1.5 KB)
  .claude/rules/workflow-execution.md          (5.2 KB)
```

### PreToolUse entry (each Write/Edit):

```
--------------------------------------------------------------------------------
[2026-03-06T17:10:45.123Z] PreToolUse -- Edit
--------------------------------------------------------------------------------
[TOOL] Edit -> src/components/Login.tsx

[CODE-INTEL INJECTION] (additionalContext)
<code-intel-context>
  <target-file>src/components/Login.tsx</target-file>
  <existing-entity>
    <path>src/components/Login.tsx</path>
    <purpose>Login form component</purpose>
  </existing-entity>
  <referenced-by count="1">
    <ref file="src/App.tsx" context="Imported in main app" />
  </referenced-by>
</code-intel-context>
```

## Chronological Reading

The log is chronological. A typical sequence:

```
[17:10:44] FULL CONTEXT -- UserPromptSubmit   <-- user typed
[17:10:45] PreToolUse -- Edit                  <-- agent edited file 1
[17:10:46] PreToolUse -- Write                 <-- agent created file 2
[17:10:50] FULL CONTEXT -- UserPromptSubmit   <-- user typed again
[17:10:51] PreToolUse -- Edit                  <-- agent edited file 3
```

## Behavior

- **Opt-in:** only writes when `RW_CONTEXT_LOG_FULL=1`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Heavy:** generates ~5-10KB per prompt (full XML + static listing) — use for debugging
- **Unified:** both hooks write to the same `.logs/rw-context-log-full.log` file

## Env Vars — Summary

| Env var | What it activates | Can it be replaced by full? |
|---------|-------------------|--------------------------|
| `RW_HOOKS_LOG=1` | Operational log (hook-ops) | Yes |
| `RW_SYNAPSE_TRACE=1` | Synapse trace (prompt+XML) | Yes |
| `RW_INTEL_CONTEXT_LOG=1` | Code-intel log (XML) | Yes |
| **`RW_CONTEXT_LOG_FULL=1`** | **Everything unified** | **N/A — it is the master** |

---

*RIAWORKS — 2026-03-06*
