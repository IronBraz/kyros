---
ID: F1
TASK: Knowledge Wiki — bootstrap LLM Wiki folder structure
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: (none — can run in parallel with F2)
ESTIMATE: 1 day
---

## 1. Contesto e Obiettivo

Creare la fondazione del knowledge wiki (approccio Karpathy "LLM Wiki", non RAG/pgvector) che alimenterà la chat AI lato cliente in fase Pilot.

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F1
- **Memoria progetto:** `project-pilot-approach-decision` (decisione locked 2026-05-20)
- **Obiettivo:** Avere una cartella `knowledge/` con struttura completa, convenzioni documentate, e almeno 1 PDF di esempio convertito in pagine wiki (anche con contenuto inventato).

## 2. Specifiche Tecniche

### Struttura cartella (root del repo)

```
knowledge/
├── CLAUDE.md              # Convenzioni di scrittura per future iterazioni LLM
├── index.md               # TOC con 1-riga summary per pagina
├── log.md                 # Append-only chronological log
├── public/                # Visibile alla chat cliente
│   ├── hours.md
│   ├── returns_policy.md
│   ├── product_overview.md
│   ├── faq.md
│   └── in_store_services.md
├── internal/              # Solo workflow admin, MAI alla chat cliente
│   ├── staff_sla.md
│   ├── pricing_rules.md
│   └── demo_notes.md
├── tools/
│   └── ingest_pdf.md      # Runbook semi-automatico per ingestion PDF
└── _raw/                  # PDF originali (gitignored)
    └── .gitignore         # !.gitkeep, ignore *.pdf
```

### Convenzioni nelle pagine wiki (in `knowledge/CLAUDE.md`)

- Frontmatter YAML obbligatorio: `id`, `title`, `audience: public|internal`, `topics: [...]`, `updated_at`, `source_pdf` (opzionale)
- Stile: bullet-first, max ~200 parole per pagina
- Cross-link: sintassi `[[slug]]`
- Pagine in **inglese** (decisione owner 2026-05-20: chat tutta in EN)
- No marketing fluff, solo dati concreti

### File Coinvolti

- `knowledge/` (intera nuova cartella) — Nuovo
- `.gitignore` — Modifica per aggiungere `knowledge/_raw/*.pdf`
- `specs/07_AI_Engine.md` — Modifica: sostituire sezione "Layer 3 Strict RAG / pgvector" con "Wiki-in-prompt + prompt caching" (vedi `specs/Pilot_Handover.md` §5)

## 3. Vincoli e Convenzioni

- Lingua wiki + chat: **English** (override del default IT del progetto)
- Niente pgvector, niente embeddings, niente chunking pipeline
- Contenuto demo "inventato" — l'owner ha confermato che metterà PDF reali in seguito; per ora va bene contenuto plausibile
- Tema dello store demo: **DA CONFERMARE CON OWNER A INIZIO SESSIONE** (negozio vestiti? elettronica? pet store? influenza i nomi/contenuti delle pagine)

## 4. Definition of Done

- [ ] Cartella `knowledge/` creata con tutte le sottocartelle indicate
- [ ] `knowledge/CLAUDE.md` con convenzioni complete (frontmatter, stile, link, lingua)
- [ ] Almeno 5 pagine in `public/` + 2 in `internal/` con contenuto plausibile EN
- [ ] `index.md` rigenerato con 1-riga per ogni pagina
- [ ] `log.md` inizializzato con prima entry
- [ ] `tools/ingest_pdf.md` con runbook semi-automatico (pdftotext + prompt template per Claude)
- [ ] `specs/07_AI_Engine.md` aggiornato (Wiki approach, niente pgvector)
- [ ] `.gitignore` aggiornato (knowledge/_raw/*.pdf)

## Note per la prossima sessione

- **PRIMA di iniziare**: chiedi all'owner il tema dello store demo (vestiti? elettronica? altro?). Da quello derivano i nomi e contenuti delle pagine.
- Lingua wiki: **inglese** (decisione locked, vedi memoria project-pilot-approach-decision).
- Non serve ingestare un PDF vero: l'owner ha detto che inventerà tutto. Crea contenuti inventati coerenti.
