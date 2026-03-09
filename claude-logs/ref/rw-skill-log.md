# Fix: Skill/Agent Activation Logging

**Date:** 2026-03-08
**Component:** `.claude/hooks/code-intel-pretool.cjs`, `.claude/settings.local.json`
**Severity:** Enhancement (logging extension)

---

## Problem

When an AIOX agent is activated via `/AIOX:agents:pm` (or any `/AIOX:agents:{name}`), the agent prompt (full YAML with persona, commands, dependencies) is loaded by the Claude Code Skill tool. This content:

- Does NOT pass through any existing hook
- Is NOT stored in Claude's JSONL
- Is completely invisible in the logs

The watcher (`watch-context.js`) shows synapse-rules, code-intel, metrics — but does NOT show the loaded agent prompt.

## Solution

### 1. Add `Skill` to the PreToolUse matcher

**File:** `.claude/settings.local.json`

The `code-intel-pretool.cjs` hook only fires on `Write|Edit`. By adding `Skill` to the matcher, the hook also fires when a Skill/agent is activated.

```json
"PreToolUse": [{
  "hooks": [{
    "type": "command",
    "command": "RW_INTEL_CONTEXT_LOG=1 RW_CONTEXT_LOG_FULL=1 node .claude/hooks/code-intel-pretool.cjs"
  }],
  "matcher": "Write|Edit|Skill"
}]
```

**Before:** `"matcher": "Write|Edit"`
**After:** `"matcher": "Write|Edit|Skill"`

### 2. Add `rwSkillLog()` to code-intel-pretool.cjs

**File:** `.claude/hooks/code-intel-pretool.cjs`

New function that detects the Skill tool, resolves the agent file, reads its content, and logs it.

```javascript
/**
 * Log Skill/agent activation to .logs/ (fire-and-forget).
 * Reads the agent prompt file and logs its full content.
 *
 * @param {string} cwd - Project root
 * @param {string} skillName - Skill identifier (e.g., "AIOX:agents:pm")
 * @param {string} [skillArgs] - Optional skill arguments
 */
function rwSkillLog(cwd, skillName, skillArgs) {
  const intelLog = process.env.RW_INTEL_CONTEXT_LOG === '1';
  const fullLog = process.env.RW_CONTEXT_LOG_FULL === '1';
  if (!intelLog && !fullLog) return;
  try {
    const logsDir = path.join(cwd, '.logs');
    ensureLogsDir(logsDir);

    // Resolve skill file path
    let content = '(skill content not available — built-in or file not found)';
    let resolvedPath = skillName;

    // AIOX agents: AIOX:agents:name -> .aiox-core/development/agents/name.md
    const agentMatch = skillName.match(/^AIOX:agents:(.+)$/);
    if (agentMatch) {
      const agentFile = path.join(cwd, '.aiox-core', 'development', 'agents', `${agentMatch[1]}.md`);
      if (fs.existsSync(agentFile)) {
        content = fs.readFileSync(agentFile, 'utf8');
        resolvedPath = `.aiox-core/development/agents/${agentMatch[1]}.md`;
      }
    }

    const ts = new Date().toISOString();
    const sep = '='.repeat(80);
    const argsLine = skillArgs ? `\nARGS: ${skillArgs}` : '';

    if (intelLog) {
      const entry = [
        sep,
        `[${ts}] SKILL ACTIVATION -- PreToolUse`,
        sep,
        `SKILL: ${skillName} -> ${resolvedPath}${argsLine}`,
        '',
        content,
        '',
        '',
      ].join('\n');
      fs.appendFileSync(path.join(logsDir, 'rw-intel-context-log.log'), entry);
    }

    if (fullLog) {
      const entry = [
        '-'.repeat(80),
        `[${ts}] PreToolUse -- Skill`,
        '-'.repeat(80),
        `[SKILL] ${skillName} -> ${resolvedPath}${argsLine}`,
        '',
        '[AGENT PROMPT] (loaded by Skill tool)',
        content,
        '',
        '',
      ].join('\n');
      fs.appendFileSync(path.join(logsDir, 'rw-context-log-full.log'), entry);
    }
  } catch (_) {
    // Fire-and-forget
  }
}
```

### 3. Add Skill handling in `main()`

**File:** `.claude/hooks/code-intel-pretool.cjs`

At the beginning of `main()`, before the `TARGET_TOOLS` check, detect Skill and log:

```javascript
async function main() {
  const input = await readStdin();
  const toolName = input && input.tool_name;
  if (!toolName) return;

  const cwd = input.cwd || process.cwd();

  // ── Skill activation — log agent prompt (no injection) ──
  if (toolName === 'Skill') {
    const skillName = input.tool_input && input.tool_input.skill;
    const skillArgs = input.tool_input && input.tool_input.args;
    if (skillName) {
      rwSkillLog(cwd, skillName, skillArgs);
    }
    return; // No additionalContext for Skill — just log
  }

  // ── Write/Edit — inject code-intel context ──
  if (!TARGET_TOOLS.has(toolName)) return;

  // ... rest of existing code unchanged ...
}
```

**Important:** For Skill, the hook only logs — it does NOT inject `additionalContext`.

### 4. Add `rwSkillLog` to module.exports

```javascript
module.exports = { readStdin, main, run, rwIntelContextLog, rwSkillLog, HOOK_TIMEOUT_MS, TARGET_TOOLS };
```

---

## Skill to File Mapping

| Skill Name | File |
|------------|------|
| `AIOX:agents:pm` | `.aiox-core/development/agents/pm.md` |
| `AIOX:agents:dev` | `.aiox-core/development/agents/dev.md` |
| `AIOX:agents:qa` | `.aiox-core/development/agents/qa.md` |
| `AIOX:agents:{name}` | `.aiox-core/development/agents/{name}.md` |
| Built-in skills (commit, simplify) | Does not resolve a file — logs only the name |

## Log Format

### In rw-intel-context-log.log:

```
================================================================================
[2026-03-08T21:33:53.654Z] SKILL ACTIVATION -- PreToolUse
================================================================================
SKILL: AIOX:agents:pm -> .aiox-core/development/agents/pm.md

# pm

ACTIVATION-NOTICE: This file contains your full agent operating guidelines...
(full agent content)
```

### In rw-context-log-full.log:

```
--------------------------------------------------------------------------------
[2026-03-08T21:33:53.654Z] PreToolUse -- Skill
--------------------------------------------------------------------------------
[SKILL] AIOX:agents:pm -> .aiox-core/development/agents/pm.md

[AGENT PROMPT] (loaded by Skill tool)
# pm

ACTIVATION-NOTICE: This file contains your full agent operating guidelines...
(full agent content)
```

## Verification

```bash
# Simulate Skill activation
echo '{"tool_name":"Skill","tool_input":{"skill":"AIOX:agents:pm"},"cwd":"DIR-MEU-PROJETO"}' \
  | RW_INTEL_CONTEXT_LOG=1 RW_CONTEXT_LOG_FULL=1 node .claude/hooks/code-intel-pretool.cjs 2>/dev/null

# Verify it was logged
grep "SKILL ACTIVATION" .logs/rw-intel-context-log.log && echo "OK" || echo "FAIL"
grep "PreToolUse -- Skill" .logs/rw-context-log-full.log && echo "OK" || echo "FAIL"
```

## Modified Files

| File | Change |
|------|--------|
| `.claude/settings.local.json` | matcher `Write\|Edit` → `Write\|Edit\|Skill` |
| `.claude/hooks/code-intel-pretool.cjs` | `rwSkillLog()`, Skill handling in `main()`, `module.exports` |

---

*Documented on 2026-03-08 — RIAWORKS*
