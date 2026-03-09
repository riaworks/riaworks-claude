# Prompt: Apply AIOX Hook Fixes

Copy the prompt below and paste it into Claude Code at the project root.

> **This prompt applies ONLY structural fixes.** For logging extensions (rwHooksLog, rwSynapseTrace, etc.), see the separate **claude-logs** package.

---

## Self-Service Apply Prompt

````
I need you to apply all RIAWORKS hook fixes to this AIOX project. Apply ONLY the structural bug fixes — do NOT add any logging functions.

## STEP 0 — VERIFY DOCUMENTATION

Check if the folder `.riaworks-claude/aiox-fixes/ref/` exists at the project root (same level as `.aiox-core/`).

If it does NOT exist, ask me:
"The riaworks-claude submodule is not present. Can I clone it from
https://github.com/riaworks/riaworks-claude.git into .riaworks-claude/ ?"

Wait for my confirmation before cloning. If it already exists, continue.

## STEP 1 — READ ALL FIX DOCUMENTATION

Read these files from `.riaworks-claude/aiox-fixes/ref/`. They contain all fix details,
code snippets, and expected behavior. Do NOT guess — use the exact code from these files:

1. `.riaworks-claude/aiox-fixes/ref/01-fix-hook-synapse.md` — SYNAPSE setup requirements
2. `.riaworks-claude/aiox-fixes/ref/02-fix-hooks-bugs.md` — All 9 bug fixes with code
3. `.riaworks-claude/aiox-fixes/ref/03-fix-windows-json-escape.md` — JSON escape fix

After reading, report a summary of what you found.

## STEP 2 — INTEGRITY CHECK (read-only, do NOT edit yet)

Read and verify these target files:

1. `.claude/settings.local.json` — check if hooks.UserPromptSubmit exists
2. `.claude/hooks/synapse-engine.cjs` — check if readStdin() and main() exist
3. `.aiox-core/core/synapse/runtime/hook-runtime.js` — check if buildHookOutput() exists
4. `.claude/hooks/code-intel-pretool.cjs` — check if it references .aios-core or .aiox-core
5. `.claude/hooks/precompact-session-digest.cjs` — check if it exists

For each file, report:
- EXISTS: yes/no
- KEY FUNCTIONS FOUND: list them
- ALREADY PATCHED: yes/no (compare against the fixes in the documentation)

Do NOT proceed to Step 3 until you report findings and I confirm.

## STEP 3 — APPLY FIXES

Apply each fix described in the documentation files you read in Step 1.
Use the exact code from the documentation — do NOT invent or modify.

For each fix:
- If ALREADY APPLIED, skip and report "already patched"
- If target file MISSING, report and ask before proceeding

Order of application:
1. Fix settings.local.json (Bug 1, 6, 7 from 02)
2. Fix hook-runtime.js (Bug 2, 4 from 02)
3. Fix synapse-engine.cjs (Bug 3 from 02 + sanitizeJsonString from 03)
4. Fix code-intel-pretool.cjs (Bug 8 from 02)
5. Fix precompact-runner.js (Bug 5, 9 from 02)

## STEP 4 — VALIDATION

Run the verification command from `02-fix-hooks-bugs.md` and report the result.

Expected output:
```
hookEventName: UserPromptSubmit
rules: YES
STATUS: OK
```

## RULES
- Do NOT skip Step 1. Reading the documentation is mandatory.
- Do NOT skip Step 2. Integrity check is mandatory.
- ALL code comes from the documentation files — never invent code.
- Do NOT add any logging functions (rwHooksLog, rwSynapseTrace, rwIntelContextLog, rwContextLogFull, rwSkillLog). This prompt applies ONLY structural fixes.
- Do NOT create .logs/ directory — that belongs to the logging package.
- If a target file does not exist or structure changed, ask before proceeding.
````

---

*By RIAWORKS — 2026-03-08*
