# rw-skill-log — Skill/Agent Activation Log

**Logger function:** `logSkill()`
**Env var:** `RW_HOOK_LOG=1` (summary) or `RW_HOOK_LOG=2` (verbose)
**Log file:** `.logs/rw-hooks.log`
**Defined in:** `.riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs` (calls `lib/rw-hook-logger.js`)

---

## What It Is

Log that records **Skill/agent activations** triggered via `/AIOX:agents:{name}` or any Skill tool call. Answers the question: "which agent was activated and what file was loaded?"

The hook only **logs** the activation — it does NOT inject any `additionalContext`. The agent prompt is loaded by the Claude Code Skill tool directly.

## Why It Exists

When an AIOX agent is activated via `/AIOX:agents:pm` (or any `/AIOX:agents:{name}`), the agent prompt (full YAML with persona, commands, dependencies) is loaded by the Claude Code Skill tool. This content:

- Does NOT pass through any existing AIOX hook
- Is NOT stored in Claude's JSONL
- Is completely invisible in the logs without this feature

## When It Fires

On **Skill** tool calls in Claude Code (via `PreToolUse` matcher `Write|Edit|Skill`).

- Detects `AIOX:agents:{name}` pattern
- Resolves to `.aiox-core/development/agents/{name}.md`
- Logs skill name, resolved file path, and file size
- For built-in skills (commit, simplify, etc.), logs only the skill name

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

**Important:** The matcher must include `Skill` for this to work.

## How to Deactivate

Remove `RW_HOOK_LOG=1` from the command:

```json
"command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

## How to View

```bash
# Skill entries only
grep -A 5 "SKILL" .logs/rw-hooks.log

# Agent activations only
grep "skill:" .logs/rw-hooks.log
```

## Log Format

```
--- SKILL ------------------------------------------ 21:33:53 ---
  skill: AIOX:agents:pm
  file:  .aiox-core/development/agents/pm.md
  size:  4.2K (loaded by Skill tool, NOT by this hook)
```

## Skill to File Mapping

| Skill Name | File |
|------------|------|
| `AIOX:agents:pm` | `.aiox-core/development/agents/pm.md` |
| `AIOX:agents:dev` | `.aiox-core/development/agents/dev.md` |
| `AIOX:agents:qa` | `.aiox-core/development/agents/qa.md` |
| `AIOX:agents:{name}` | `.aiox-core/development/agents/{name}.md` |
| Built-in skills (commit, simplify) | Does not resolve a file — logs only the name |

## Behavior

- **Opt-in:** only writes when `RW_HOOK_LOG` is set to `1` or `2`
- **Log only:** does NOT inject `additionalContext` for Skill calls
- **Fire-and-forget:** never blocks hook execution
- **Append-only:** writes to the unified `.logs/rw-hooks.log`

---

*RIAWORKS — 2026-03-08*
