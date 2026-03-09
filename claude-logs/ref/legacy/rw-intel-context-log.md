# rw-intel-context-log — Code-Intel Injection Log

**Logger function:** `logCodeIntel()`
**Env var:** `RW_HOOK_LOG=1` (summary) or `RW_HOOK_LOG=2` (verbose with XML)
**Log file:** `.logs/rw-hooks.log`
**Defined in:** `.riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs` (calls `lib/rw-hook-logger.js`)

---

## What It Is

Log that records the **`<code-intel-context>` XML injected** by the code-intel hook on each Write or Edit operation. Answers the question: "what code context was injected when the agent edited this file?"

Does not record Synapse rules (for that see `rw-synapse-trace.md`).

## Why It Exists

The `rw-pretool-log.cjs` hook injects invisible context about entities, references, and dependencies of the file being edited. Without a log, it is impossible to know:

- Whether code-intel found data for the file
- Which entities, references, and dependencies were injected
- Whether the entity-registry has coverage for that file
- Which tool (Write/Edit) triggered the injection

## When It Fires

On **Write**, **Edit**, and **Skill** operations in Claude Code. Does not fire on Read, Bash, Grep, etc.

- **Write/Edit:** Logs the `<code-intel-context>` XML injected via `logCodeIntel()`
- **Skill:** Logs the agent activation via `logSkill()` (see `rw-skill-log.md`)

## How to Activate

Set `RW_HOOK_LOG=1` on the PreToolUse hook command in `.claude/settings.local.json`:

```json
"PreToolUse": [{
  "hooks": [{
    "type": "command",
    "command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
  }],
  "matcher": "Write|Edit|Skill"
}]
```

For verbose (includes full code-intel XML):
```json
"command": "RW_HOOK_LOG=2 node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

## How to Deactivate

Remove `RW_HOOK_LOG=1` from the command:

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

## How to View

```bash
# Full log (all events)
cat .logs/rw-hooks.log

# Code-intel entries only
grep -A 5 "CODE-INTEL" .logs/rw-hooks.log

# Edited files only
grep "tool:" .logs/rw-hooks.log
```

## Log Format

**Level 1 (summary):**
```
--- CODE-INTEL ------------------------------------- 17:10:45 ---
  tool:   Edit -> .claude/hooks/synapse-engine.cjs
  entity: .claude/hooks/synapse-engine.cjs
  refs: 2 | deps: 1 (hook-runtime@core)
```

**Level 2 (verbose — adds XML):**
```
--- CODE-INTEL ------------------------------------- 17:10:45 ---
  tool:   Edit -> .claude/hooks/synapse-engine.cjs
  entity: .claude/hooks/synapse-engine.cjs
  refs: 2 | deps: 1 (hook-runtime@core)
  --- injected xml ---
  <code-intel-context>
    <target-file>.claude/hooks/synapse-engine.cjs</target-file>
    <existing-entity>
      <path>.claude/hooks/synapse-engine.cjs</path>
      <purpose>SYNAPSE Hook Entry Point</purpose>
    </existing-entity>
    <referenced-by count="2">
      <ref file=".claude/settings.local.json" context="Registered as UserPromptSubmit hook" />
    </referenced-by>
  </code-intel-context>
  --- end xml ---
```

## Behavior

- **Opt-in:** only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Fire-and-forget:** never blocks hook execution
- **Auto-create:** creates `.logs/` with `.gitignore` if it does not exist
- **Append-only:** never overwrites, always appends
- **Conditional:** only generates an entry when there is XML (entity found)

## Relationship with Other Logs

| Log | What it captures | Hook |
|-----|------------------|------|
| `rw-hooks-log` | Synapse operational status + engine metrics | UserPromptSubmit |
| `rw-synapse-trace` | Full injected Synapse XML (level 2) | UserPromptSubmit |
| **`rw-intel-context-log`** | **Code-intel XML + skill activations** | **PreToolUse** |

All events write to the same unified `.logs/rw-hooks.log` file.

---

*RIAWORKS — 2026-03-08*
