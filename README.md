# riaworks-claude

RIAWORKS utilities for Claude Code — tools, fixes, and extensions.

> **By [RIAWORKS](https://github.com/riaworks)**

## Packages

### [`read-transcript`](read-transcript/)

Interactive CLI tool for reading and analyzing Claude Code session transcripts (`.jsonl` files).

- Cross-platform: Windows, macOS, Linux
- Interactive menu with project browser, session search, and stats
- Filter by user messages, tool calls, or view full transcripts
- Zero external dependencies — Node.js stdlib only

```bash
node read-transcript/read-transcript.js          # Interactive menu
node read-transcript/read-transcript.js last      # Most recent session
node read-transcript/read-transcript.js --help    # Usage
```

**Docs:** [English](docs/read-transcript/read-transcript-manual.md) | [Portugues](docs/read-transcript/manual-pt-BR.md)

---

### [`aios-aiox-fixes`](aios-aiox-fixes/)

Hook fix pack for Synkra AIOS/AIOX projects. Fixes 9 bugs in the hook system and adds persistent logging.

- 4 corrected files ready to drop into any AIOS project
- Fixes: hook errors, stdout cutoff on Windows, session persistence, orphan cleanup
- Adds `hookLog()` fire-and-forget logging to `.logs/hooks.log`

**Docs:** [English](docs/aios-aiox-fixes/manual.md) | [Portugues](docs/aios-aiox-fixes/manual-pt-BR.md)

---

## Requirements

- Node.js 18+
- Claude Code installed (for `read-transcript`)
- AIOS/AIOX project (for `aios-aiox-fixes`)

## License

MIT

---

# riaworks-claude (PT-BR)

Utilitarios RIAWORKS para Claude Code — ferramentas, correções e extensoes.

## Pacotes

### [`read-transcript`](read-transcript/)

Ferramenta CLI interativa para ler e analisar transcripts de sessoes do Claude Code (arquivos `.jsonl`).

- Cross-platform: Windows, macOS, Linux
- Menu interativo com navegador de projetos, busca de sessoes e estatisticas
- Filtro por mensagens do usuario, tool calls, ou transcript completo
- Zero dependencias externas — apenas Node.js stdlib

```bash
node read-transcript/read-transcript.js          # Menu interativo
node read-transcript/read-transcript.js last      # Sessao mais recente
node read-transcript/read-transcript.js --help    # Uso
```

**Docs:** [English](docs/read-transcript/read-transcript-manual.md) | [Portugues](docs/read-transcript/manual-pt-BR.md)

---

### [`aios-aiox-fixes`](aios-aiox-fixes/)

Pack de correções de hooks para projetos Synkra AIOS/X. Corrige 9 bugs no sistema de hooks e adiciona logging persistente.

- 4 arquivos corrigidos prontos para usar em qualquer projeto AIOX
- Fixes: erros de hook, stdout cortado no Windows, persistencia de sessao, limpeza de orphans
- Adiciona `hookLog()` logging fire-and-forget em `.logs/hooks.log`

**Docs:** [English](docs/aios-aiox-fixes/manual.md) | [Portugues](docs/aios-aiox-fixes/manual-pt-BR.md)
