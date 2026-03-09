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

Read `.riaworks-claude/claude-logs/hooks/README.md` to understand the plugin architecture.

Key points:
- Unified log: `.logs/rw-hooks.log` (env: `RW_HOOK_LOG=1|2`)
- AIOX operational log: `.logs/rw-aiox-log.log` (env: `RW_AIOX_LOG=1`)
- 3 event types: SYNAPSE, CODE-INTEL, SKILL

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

| Level | Env value | Log weight |
|-------|-----------|------------|
| Off (default) | (unset) | None |
| Summary | `"1"` | ~200B/prompt |
| Verbose (with XML) | `"2"` | ~4KB/prompt |

If I choose a level, add `RW_HOOK_LOG` to the `env` section of settings.local.json:
```json
"env": {
  "RW_HOOK_LOG": "1",
  "RW_AIOX_LOG": "1"
}
```

The `env` section applies to ALL hooks — no need to prefix each command individually.

## STEP 5 — VALIDATION

Run the verification command and report the result:

```bash
echo '{"prompt":"test","session_id":"verify-log","cwd":"'$(pwd)'"}' \
  | node .riaworks-claude/claude-logs/hooks/rw-synapse-log.cjs 2>/dev/null \
  && echo "Hook executed successfully"
```

Note: The `env` section in settings.local.json sets `RW_HOOK_LOG` automatically. For manual testing, set it inline: `RW_HOOK_LOG=1 node ...`

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
