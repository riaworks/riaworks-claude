# rwIntelContextLog — Code-Intel Injection Log

**Function:** `rwIntelContextLog(cwd, { toolName, filePath, xml })`
**Env var:** `RW_INTEL_CONTEXT_LOG=1`
**Log file:** `.logs/rw-intel-context-log.log`
**Defined in:** `.claude/hooks/code-intel-pretool.cjs`

---

## What It Is

Log that records the **`<code-intel-context>` XML injected** by the code-intel hook on each Write or Edit operation, and also **agent prompts** loaded via Skill activation. Answers the question: "what code context was injected when the agent edited this file?" and "what agent prompt was loaded?"

Does not record Synapse rules (for that use `rwSynapseTrace`). Does not record the operational log (for that use `rwHooksLog`).

## Why It Exists

The `code-intel-pretool.cjs` hook injects invisible context about entities, references, and dependencies of the file being edited. Without a log, it is impossible to know:

- Whether code-intel found data for the file
- Which entities, references, and dependencies were injected
- Whether the entity-registry has coverage for that file
- Which tool (Write/Edit) triggered the injection

## When It Fires

On **Write**, **Edit**, and **Skill** operations in Claude Code. Does not fire on Read, Bash, Grep, etc.

- **Write/Edit:** Logs the `<code-intel-context>` XML injected via `rwIntelContextLog()`
- **Skill:** Logs the full agent prompt loaded via `rwSkillLog()` (e.g., `/AIOX:agents:pm` logs the content of `.aiox-core/development/agents/pm.md`)

## How to Activate

Add `RW_INTEL_CONTEXT_LOG=1` to the hook command in `.claude/settings.local.json`:

```json
"PreToolUse": [{
  "hooks": [{
    "type": "command",
    "command": "RW_INTEL_CONTEXT_LOG=1 node .claude/hooks/code-intel-pretool.cjs"
  }],
  "matcher": "Write|Edit|Skill"
}]
```

## How to Deactivate

Remove `RW_INTEL_CONTEXT_LOG=1` from the command:

```json
"command": "node .claude/hooks/code-intel-pretool.cjs"
```

## How to View

```bash
# Full log
cat .logs/rw-intel-context-log.log

# Real time
tail -f .logs/rw-intel-context-log.log

# Edited files only
grep "TOOL:" .logs/rw-intel-context-log.log

# Found entities only
grep -A 3 "existing-entity" .logs/rw-intel-context-log.log
```

## Log Format

```
================================================================================
[2026-03-06T17:10:45.123Z] CODE-INTEL INJECTION -- PreToolUse
================================================================================
TOOL: Edit -> .claude/hooks/synapse-engine.cjs

<code-intel-context>
  <target-file>.claude/hooks/synapse-engine.cjs</target-file>
  <existing-entity>
    <path>.claude/hooks/synapse-engine.cjs</path>
    <purpose>SYNAPSE Hook Entry Point</purpose>
  </existing-entity>
  <referenced-by count="2">
    <ref file=".claude/settings.local.json" context="Registered as UserPromptSubmit hook" />
    <ref file="aios-aiox-riaworks/rw-synapse-trace.md" context="Documentation" />
  </referenced-by>
</code-intel-context>
```

## Behavior

- **Opt-in:** only writes when `RW_INTEL_CONTEXT_LOG=1`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Conditional:** only generates an entry when there is XML (entity found)

## Relationship with Other Logs

| Log | What it captures | Event |
|-----|------------------|-------|
| `rw-hooks-log` | Operational status of hooks | UserPromptSubmit |
| `rw-synapse-trace` | Injected Synapse XML | UserPromptSubmit |
| **`rw-intel-context-log`** | **Code-intel XML + agent prompts** | **PreToolUse (Write/Edit/Skill)** |
| `rw-context-log-full` | Everything unified | Both |

---

*RIAWORKS — 2026-03-06*
