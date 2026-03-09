# Prompt: Apply RIAWORKS Logging System

Copy the prompt below and paste it into Claude Code at the project root.

> **Prerequisite:** The structural fixes from the **aiox-fixes** package should already be applied. If not, apply them first using `aiox-fixes/prompt-apply-fixes.md`.

---

## Self-Service Apply Prompt

````
I need you to apply the RIAWORKS logging extensions to this AIOX project. Apply ONLY the logging system — the structural fixes should already be in place.

## STEP 0 — VERIFY DOCUMENTATION

Check if the folder `.riaworks-claude/claude-logs/ref/` exists at the project root (same level as `.aiox-core/`).

If it does NOT exist, ask me:
"The riaworks-claude submodule is not present. Can I clone it from
https://github.com/riaworks/riaworks-claude.git into .riaworks-claude/ ?"

Wait for my confirmation before cloning. If it already exists, continue.

## STEP 1 — READ ALL LOG DOCUMENTATION

Read these files from `.riaworks-claude/claude-logs/ref/`. They contain all logging function
definitions, code snippets, and behavior. Do NOT guess — use the exact code from these files:

1. `.riaworks-claude/claude-logs/ref/rw-hooks-log.md` — rwHooksLog() function and usage
2. `.riaworks-claude/claude-logs/ref/rw-synapse-trace.md` — rwSynapseTrace() function and usage
3. `.riaworks-claude/claude-logs/ref/rw-intel-context-log.md` — rwIntelContextLog() function and usage
4. `.riaworks-claude/claude-logs/ref/rw-context-log-full.md` — rwContextLogFull() unified log
5. `.riaworks-claude/claude-logs/ref/rw-skill-log.md` — Skill/agent activation logging

After reading, report a summary of what you found.

## STEP 2 — INTEGRITY CHECK (read-only, do NOT edit yet)

Verify these prerequisite conditions (fixes must already be applied):

1. `.claude/hooks/synapse-engine.cjs` — must exist, must NOT have process.exit() (Fix #3)
2. `.aiox-core/core/synapse/runtime/hook-runtime.js` — must exist, must have hookEventName in buildHookOutput() (Fix #2)
3. `.claude/hooks/code-intel-pretool.cjs` — must exist, must NOT have process.exit() (Fix #8)
4. `.claude/settings.local.json` — must have UserPromptSubmit and PreToolUse hooks registered

For each file, report:
- EXISTS: yes/no
- FIXES APPLIED: yes/no (verify Fix #2, #3, #8 are in place)
- LOGGING ALREADY PRESENT: yes/no (check for rwHooksLog, rwSynapseTrace, etc.)

If fixes are NOT applied, stop and tell me to run the aiox-fixes prompt first.
Do NOT proceed to Step 3 until you report findings and I confirm.

## STEP 3 — APPLY LOGGING FUNCTIONS

Apply each logging function as described in the documentation files from Step 1.
Use the exact code from the documentation — do NOT invent or modify.

Order of application:

1. **rwHooksLog()** — Add to `.aiox-core/core/synapse/runtime/hook-runtime.js`
   - Add function definition (from rw-hooks-log.md)
   - Add log calls inside resolveHookRuntime()
   - Add to module.exports

2. **rwSynapseTrace()** — Add to `.claude/hooks/synapse-engine.cjs`
   - Add function definition (from rw-synapse-trace.md)
   - Add trace call before stdout.write

3. **rwContextLogFull()** — Add to BOTH hooks
   - Add to `synapse-engine.cjs` (from rw-context-log-full.md)
   - Add to `code-intel-pretool.cjs` (from rw-context-log-full.md)

4. **rwIntelContextLog()** — Add to `.claude/hooks/code-intel-pretool.cjs`
   - Add function definition (from rw-intel-context-log.md)
   - Add log call for Write/Edit operations

5. **rwSkillLog()** — Add to `.claude/hooks/code-intel-pretool.cjs`
   - Add function definition (from 04-fix-skill-logging.md)
   - Add Skill handling in main()
   - Add to module.exports

6. **Skill matcher** — Update `.claude/settings.local.json`
   - Change PreToolUse matcher from `Write|Edit` to `Write|Edit|Skill`

For each function:
- If ALREADY PRESENT, skip and report "already applied"
- If target file MISSING, report and ask before proceeding

## STEP 4 — CONFIGURE ACTIVATION

Create `.logs/` directory with `.gitignore` containing:
```
*
!.gitignore
```

Update `.claude/settings.local.json` hook commands to enable logging.
Default recommended configuration (lightweight):

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }]
  }
}
```

Show me the configured commands before applying. I will choose the logging level.

## STEP 5 — VALIDATION

Run the verification command and report the result:

```bash
echo '{"prompt":"test","session_id":"verify-log","cwd":"'$(pwd)'"}' \
  | RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs 2>/dev/null \
  && cat .logs/rw-hooks-log.log
```

Expected: lines with timestamps showing session created, runtime resolved.

## RULES
- Do NOT skip Step 1. Reading the documentation is mandatory.
- Do NOT skip Step 2. Integrity check is mandatory.
- ALL code comes from the documentation files — never invent code.
- Do NOT modify any existing fix code — this prompt applies ONLY logging extensions.
- All logging is fire-and-forget — NEVER blocks hook execution.
- All logging is opt-in via inline env vars — disabled by default.
- If a target file does not exist or structure changed, ask before proceeding.
````

---

## Quick Reference: Logging Levels

After installation, control logging via inline env vars in `.claude/settings.local.json`:

| Level | Configuration | Weight |
|-------|---------------|--------|
| Off (default) | `node .claude/hooks/synapse-engine.cjs` | None |
| Operational only | `RW_HOOKS_LOG=1 node .claude/hooks/synapse-engine.cjs` | ~100B/prompt |
| + SYNAPSE trace | `RW_HOOKS_LOG=1 RW_SYNAPSE_TRACE=1 node .claude/hooks/synapse-engine.cjs` | ~4KB/prompt |
| Full unified | `RW_CONTEXT_LOG_FULL=1 node .claude/hooks/synapse-engine.cjs` | ~5-10KB/prompt |

> `RW_CONTEXT_LOG_FULL=1` must be set on **both** hooks (UserPromptSubmit and PreToolUse).

---

*By RIAWORKS — 2026-03-08*
