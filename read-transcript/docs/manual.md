# read-transcript.js — User Manual

Interactive reader for Claude Code session transcripts. Parses the `.jsonl` files that Claude Code stores in `~/.claude/projects/`.

**Cross-platform:** Windows, macOS, Linux. Automatically detects the Claude projects directory.

## Location

```
.riaworks-claude/read-transcript/read-transcript.js
```

## Requirements

- Node.js 18+
- Claude Code installed (creates `~/.claude/projects/` automatically)

## Interactive Mode (Menu)

```bash
node .riaworks-claude/read-transcript/read-transcript.js
```

Opens the main menu:

```
  +----------------------------------------------------------+
  |        Claude Code Transcript Reader                      |
  |        by RIAWORKS                                        |
  +----------------------------------------------------------+

  1. List projects            -> All projects with sessions
  2. Current project sessions -> Sessions based on cwd
  3. Read last session        -> Opens most recent for cwd
  4. Search by text           -> Search across all projects
  0. Exit
```

### 1. List projects

Shows all Claude projects found, with session count and last activity date. Select a project to browse its sessions.

### 2. Current project sessions

Lists sessions for the project matching the current working directory. Each session shows:
- Relative date (today, yesterday, 3d ago...)
- File size
- First prompt of the session

### 3. Read last session

Shortcut to open the most recent session of the current project.

### 4. Search by text

Searches a text string in the first prompts of all sessions across all projects. Useful for finding a specific session.

## Session View Options

When you select a session, 5 viewing modes are offered:

```
  1. View (truncated)              -> Summarized messages
  2. View (full)                   -> No truncation
  3. User messages only            -> Filter USER only
  4. Tool calls only               -> Filter tool_use only
  5. Session statistics            -> Numeric summary
```

### Statistics

Shows a session summary:
- Total duration
- Message counts (user/assistant)
- Thinking block count and size
- Tool calls with ranking of most used

## Direct Mode (CLI)

For scripting or quick access:

```bash
# Specific session from current project
node .riaworks-claude/read-transcript/read-transcript.js <session-id>

# Most recent session
node .riaworks-claude/read-transcript/read-transcript.js last

# Full mode (no truncation)
node .riaworks-claude/read-transcript/read-transcript.js --full last

# Different project
node .riaworks-claude/read-transcript/read-transcript.js --cwd /path/to/other/project

# Help
node .riaworks-claude/read-transcript/read-transcript.js --help
```

## Directory Detection (Cross-Platform)

The script tries to find the Claude projects directory in this order:

| Priority | Path | When |
|----------|------|------|
| 1 | `$CLAUDE_PROJECTS_DIR` | Manual env override |
| 2 | `~/.claude/projects/` | macOS, Linux, Windows (Git Bash) |
| 3 | `%APPDATA%\.claude\projects\` | Windows native |
| 4 | `%LOCALAPPDATA%\.claude\projects\` | Windows fallback |

If none is found, displays the tested paths and suggests setting `CLAUDE_PROJECTS_DIR`.

## Output Format

```
================================================================================
  TRANSCRIPT: abc123-def456
  Project:    C---sistemas-my-project
  Lines:      342
  Timezone:   GMT-3
================================================================================

L   1 | 2026-03-08 14:30:00 | USER [str]
       I want to implement feature X...

L   2 | 2026-03-08 14:30:05 | ASSISTANT [thinking]
       Let me analyze the existing code...

L   2 | 2026-03-08 14:30:05 | ASSISTANT [tool_use] Read
       input: {"file_path":"/path/to/file.js"}

L   3 | 2026-03-08 14:30:06 | USER [tool_result]
       1>const fs = require('fs');...
```

## Tips

- `file-history-snapshot` entries are filtered out automatically
- No arguments = interactive menu; with arguments = direct mode
- Use `--full` when you need complete content of long messages
- JSONL files can be tens of MB — truncated mode (default) is faster
- All timestamps are shown in your system's local timezone

---

*By RIAWORKS — 2026-03-08*
