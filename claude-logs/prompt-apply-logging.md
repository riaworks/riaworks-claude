# Prompt: Install RIAWORKS Logging Plugin

Copy the prompt below and paste it into Claude Code at the project root.

> **Prerequisite:** The structural fixes from the **aiox-fixes** package should already be applied. If not, apply them first using `aiox-fixes/prompt-apply-fixes.md`.

---

## Self-Service Install Prompt

````
I need you to install the RIAWORKS logging plugin for this AIOX project. This plugin replaces the default AIOX hooks with RIAWORKS wrapper hooks that add unified logging.

IMPORTANT: This prompt ONLY changes `.claude/settings.local.json` to point to wrapper hooks. It does NOT modify any AIOX source files.

## STEP 0 — VERIFY PLUGIN FILES EXIST

Check if the wrapper hooks exist at `.riaworks-claude/claude-logs/hooks/`:

1. `.riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs` — UserPromptSubmit wrapper
2. `.riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs` — PreToolUse wrapper
3. `.riaworks-claude/claude-logs/hooks/lib/rw-hook-logger.js` — Unified logger
4. `.riaworks-claude/claude-logs/hooks/lib/rw-read-stdin.js` — Windows-safe stdin reader

If any file is missing, stop and tell me:
"The riaworks-claude submodule is not present or incomplete. Can I clone it from
https://github.com/riaworks/riaworks-claude.git into .riaworks-claude/ ?"

Wait for my confirmation before cloning. If all files exist, continue.

## STEP 1 — READ PLUGIN DOCUMENTATION

Read these reference files to understand what the plugin does:

1. `.riaworks-claude/claude-logs/ref/rw-hooks-log.md` — Operational log spec
2. `.riaworks-claude/claude-logs/ref/rw-synapse-trace.md` — SYNAPSE trace spec
3. `.riaworks-claude/claude-logs/ref/rw-intel-context-log.md` — Code-intel log spec
4. `.riaworks-claude/claude-logs/ref/rw-context-log-full.md` — Unified log spec
5. `.riaworks-claude/claude-logs/ref/rw-skill-log.md` — Skill activation log spec

After reading, report a summary of what the plugin provides.

## STEP 2 — CHECK CURRENT CONFIGURATION

Read `.claude/settings.local.json` and report:

1. Current UserPromptSubmit hook command (which script is configured?)
2. Current PreToolUse hook command (which script is configured?)
3. Current PreCompact hook command (if any)
4. Whether RIAWORKS wrappers are already installed

If RIAWORKS wrappers are already installed, report "already installed" and stop.

## STEP 3 — INSTALL PLUGIN

Update `.claude/settings.local.json` to replace AIOX hooks with RIAWORKS wrappers.

**Before (AIOX original):**
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/synapse-engine.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/code-intel-pretool.cjs"
      }],
      "matcher": "Write|Edit"
    }]
  }
}
```

**After (RIAWORKS wrapper with logging disabled by default):**
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
      }]
    }],
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
      }],
      "matcher": "Write|Edit|Skill"
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/precompact-session-digest.cjs"
      }]
    }]
  }
}
```

Key changes:
- UserPromptSubmit: `.claude/hooks/synapse-engine.cjs` → `.riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs`
- PreToolUse: `.claude/hooks/code-intel-pretool.cjs` → `.riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs`
- PreToolUse matcher: `Write|Edit` → `Write|Edit|Skill` (adds Skill logging)
- PreCompact: kept as-is (not wrapped)
- No timeout set (Claude Code default is sufficient)

Show me the final configuration before applying. I will confirm.

## STEP 4 — ENABLE LOGGING (optional)

Ask me which logging level I want:

| Level | Command prefix | Log weight |
|-------|---------------|------------|
| Off (default) | (none) | None |
| Summary | `RW_HOOK_LOG=1` | ~200B/prompt |
| Verbose (with XML) | `RW_HOOK_LOG=2` | ~4KB/prompt |

If I choose a level, add the env var prefix to BOTH hook commands:
```json
"command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs"
"command": "RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-pretool-log.cjs"
```

## STEP 5 — VALIDATION

Run the verification command and report the result:

```bash
echo '{"prompt":"test","session_id":"verify-log","cwd":"'$(pwd)'"}' \
  | RW_HOOK_LOG=1 node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs 2>/dev/null \
  && echo "Hook executed successfully"
```

If `.logs/rw-hooks.log` was created, report its contents.

## RULES
- Do NOT modify any AIOX source files — this is an install, not a patch
- ONLY change `.claude/settings.local.json`
- Preserve any other existing settings (env, permissions, etc.)
- The original AIOX hooks remain untouched at `.claude/hooks/`
- To uninstall, revert settings.local.json to point back to `.claude/hooks/`
````

---

## Uninstall

To revert to the original AIOX hooks, change `.claude/settings.local.json` back to:

```json
"command": "node .claude/hooks/synapse-engine.cjs"
"command": "node .claude/hooks/code-intel-pretool.cjs"
```

And remove the `Skill` from the PreToolUse matcher if not needed.

---

*By RIAWORKS — 2026-03-08*
