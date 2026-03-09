# SYNAPSE — Setup and Installation

**Date:** 2026-03-06
**Platform:** Windows 11, Claude Code v2.1.63+, Node 22.x

---

## What is SYNAPSE

SYNAPSE is the AIOX context engine. It injects rules (coding standards, constitution, domain) into Claude Code on every prompt via the `UserPromptSubmit` hook.

**Normal flow:**
```
User types prompt
       |
       v
Claude Code fires UserPromptSubmit hook
       |
       v
synapse-engine.cjs reads stdin JSON, calls SynapseEngine
       |
       v
SynapseEngine generates <synapse-rules> XML
       |
       v
synapse-engine.cjs writes JSON to stdout
       |
       v
Claude Code injects XML as additionalContext
```

**When the hook fails**, Claude Code does not receive the SYNAPSE rules and operates without project context — ignores conventions, constitution, domain, etc.

---

## Dependencies

SYNAPSE requires two directories to function:

| Directory | Contents | Required |
|-----------|----------|----------|
| `.synapse/` | Context domains, sessions, cache, agents, constitution, workflows | YES |
| `.aiox-core/core/synapse/` | Engine, runtime, session manager | YES |

Both come from the official AIOX repository.

---

## Installing .synapse/

If the `.synapse/` directory does not exist in the project, the hook exits silently and no rules are injected.

### Obtain from the official repository

**Repository:** https://github.com/SynkraAI/aiox-core

```bash
# Clone the official repository
git clone https://github.com/SynkraAI/aiox-core.git /tmp/aiox-core

# Copy .synapse/ to the project
cp -r /tmp/aiox-core/.synapse/ <MY-PROJECT>/.synapse/

# Clean up
rm -rf /tmp/aiox-core
```

### Alternative: sparse checkout (.synapse/ only)

```bash
cd <MY-PROJECT>
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/SynkraAI/aiox-core.git /tmp/aiox-sparse
cd /tmp/aiox-sparse
git sparse-checkout set .synapse
cp -r .synapse/ <MY-PROJECT>/.synapse/
rm -rf /tmp/aiox-sparse
```

### Expected structure

```
.synapse/
├── .gitignore
├── agent-aiox-master
├── agent-analyst
├── agent-architect
├── agent-data-engineer
├── agent-dev
├── agent-devops
├── agent-pm
├── agent-po
├── agent-qa
├── agent-sm
├── agent-squad-creator
├── agent-ux
├── cache/
├── commands
├── constitution
├── context
├── global
├── manifest
├── metrics/
├── sessions/
├── workflow-arch-review
├── workflow-epic-create
└── workflow-story-dev
```

---

## Verification

### 1. Check if .synapse/ exists

```bash
ls .synapse/manifest && echo "OK" || echo "MISSING"
```

### 2. Check if the hook works

```bash
echo '{"prompt":"test","session_id":"verify","cwd":"DIR-MEU-PROJETO"}' \
  | node .claude/hooks/synapse-engine.cjs 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log('hookEventName:',j.hookSpecificOutput?.hookEventName);console.log('rules:',j.hookSpecificOutput?.additionalContext?.includes('CONSTITUTION')?'YES':'NO');console.log('STATUS: OK');}catch(e){console.log('STATUS: FAIL',e.message);}})"
```

Expected:
```
hookEventName: UserPromptSubmit
rules: YES
STATUS: OK
```

### 3. Failure diagnostics

| Cause | Diagnostic |
|-------|------------|
| `.synapse/` does not exist | Hook exits silently, no entry in the log |
| `.aiox-core/core/synapse/` missing | Hook crashes with `Cannot find module` |
| Engine did not find rules | Bracket appears in trace, XML empty |
| Domain not configured | XML present but without rules from the expected domain |

---

## Hook configuration

The hooks must be registered in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/synapse-engine.cjs"
          }
        ]
      }
    ]
  }
}
```

For known bugs in the hooks, see `02-fix-hooks-bugs.md`.

---

## Files involved

| File | Role |
|------|------|
| `.synapse/` | Context domains, constitution, agents, workflows |
| `.aiox-core/core/synapse/engine.js` | SynapseEngine — processes domains and generates XML |
| `.aiox-core/core/synapse/runtime/hook-runtime.js` | Runtime: resolves session, builds output |
| `.aiox-core/core/synapse/session/session-manager.js` | Manages sessions and bracket transitions |
| `.claude/hooks/synapse-engine.cjs` | Hook entry point — reads stdin, calls engine, writes stdout |
| `.claude/settings.local.json` | Hook registration in Claude Code |

---

*Documented on 2026-03-06 — RIAWORKS*