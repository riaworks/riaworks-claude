# riaworks-claude

RIAWORKS utilities for Claude Code — tools, fixes, and extensions.

> **By [RIAWORKS](https://github.com/riaworks)**

## Packages

### [`aiox-fixes`](aiox-fixes/)

Fix pack for the Synkra AIOX hook system. Fixes 9 structural bugs + 1 Windows JSON escape via on-demand prompt.

- `prompt-apply-fixes.md` — paste into Claude Code to apply all fixes automatically
- `ref/` — 3 fix reference files with exact code and verification commands (English)
- Fixes: hook registration, hookEventName, stdout pipe kill on Windows, session persistence, precompact runner, absolute paths, timeout, code-intel process.exit, precompact console.log/error, JSON backslash escape

**Docs:** [English](aiox-fixes/docs/manual.md) | [Portugues](aiox-fixes/docs/manual-pt-BR.md)

---

### [`claude-logs`](claude-logs/)

Logging system for AIOX Claude Code hooks. 4 log levels with independent env var control, optional hook wrappers, and real-time monitoring.

- `prompt-apply-logging.md` — paste into Claude Code to add logging functions
- `ref/` — 5 logging specification files (rwHooksLog, rwSynapseTrace, rwIntelContextLog, rwContextLogFull, rwSkillLog) (English)
- `hooks/` — RIAWORKS hook wrappers with unified logging (`synapse-logged.cjs`, `code-intel-pretool.cjs`)
- `watch-context.js` — Real-time log monitor
- 4 env vars: `RW_HOOKS_LOG`, `RW_SYNAPSE_TRACE`, `RW_INTEL_CONTEXT_LOG`, `RW_CONTEXT_LOG_FULL`

**Docs:** [English](claude-logs/docs/manual.md) | [Portugues](claude-logs/docs/manual-pt-BR.md)

---

### [`read-transcript`](read-transcript/)

Interactive CLI tool for reading and analyzing Claude Code session transcripts (`.jsonl` files).

- Cross-platform: Windows, macOS, Linux
- Interactive menu with project browser, session search, and stats
- Zero external dependencies — Node.js stdlib only

```bash
node read-transcript/read-transcript.js          # Interactive menu
node read-transcript/read-transcript.js last      # Most recent session
```

**Docs:** [English](read-transcript/docs/manual.md) | [Portugues](read-transcript/docs/manual-pt-BR.md)

---

## Requirements

- Node.js 18+
- Claude Code installed
- AIOX project (for `aiox-fixes` and `claude-logs`)

## License

MIT

---

# riaworks-claude (PT-BR)

Utilitarios RIAWORKS para Claude Code — ferramentas, correcoes e extensoes.

## Pacotes

| Pacote | Descricao |
|--------|-----------|
| [`aiox-fixes`](aiox-fixes/) | 9 bug fixes + JSON escape fix do AIOX via prompt sob demanda |
| [`claude-logs`](claude-logs/) | Sistema de logging com 4 niveis para hooks do Claude Code |
| [`read-transcript`](read-transcript/) | Leitor interativo de transcripts de sessao |
