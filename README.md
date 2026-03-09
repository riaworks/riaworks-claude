# riaworks-claude

RIAWORKS utilities for Claude Code — tools, fixes, and extensions.

> **By [RIAWORKS](https://github.com/riaworks)**

## Packages

### [`aiox-fixes`](aiox-fixes/)

Patch pack for the Synkra AIOX hook system. Fixes 9 bugs and adds diagnostic logging to the AIOX core.

- 4 patched files ready to apply on top of latest AIOX
- Fixes: hook errors, stdout cutoff on Windows, session persistence, orphan cleanup
- Includes prompt to apply fixes automatically via Claude Code

**Docs:** [English](aiox-fixes/docs/manual.md) | [Portugues](aiox-fixes/docs/manual-pt-BR.md)

---

### [`claude-logs`](claude-logs/)

Unified logging system for Claude Code hooks. Wraps AIOX hooks with RIAWORKS logging and provides real-time monitoring.

- `hooks/` — Claude Code hooks with unified logging (`synapse-logged.cjs`, `code-intel-pretool.cjs`)
- `watch-context.js` — Real-time log monitor (`tail -f` alternative)
- Single env var: `RW_HOOK_LOG` (0=off, 1=summary, 2=verbose)
- Single log file: `.logs/rw-hooks.log`

**Docs:** [Hooks Guide](claude-logs/docs/hooks-guide.md)

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
| [`aiox-fixes`](aiox-fixes/) | Correcao de 9 bugs do AIOX + prompt de aplicacao |
| [`claude-logs`](claude-logs/) | Sistema de logging unificado para hooks do Claude Code |
| [`read-transcript`](read-transcript/) | Leitor interativo de transcripts de sessao |
