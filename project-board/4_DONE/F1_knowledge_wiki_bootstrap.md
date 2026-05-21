---
ID: F1
TASK: Knowledge Wiki — bootstrap LLM Wiki folder structure
OWNER: Claude
STATUS: DONE
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
│   ├── store_info.md      # Naming, ubicazione (fittizia), brand story inventata
│   ├── hours.md
│   ├── returns_policy.md
│   ├── product_catalog.md # Capsule/grani/macchine/accessori — tutto inventato
│   ├── faq.md
│   └── in_store_services.md  # Workshop degustazione, riparazione macchine, etc.
├── internal/              # Solo workflow admin, MAI alla chat cliente
│   ├── staff_notes.md
│   ├── pricing_internal.md
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
- **Tema dello store demo (confermato 2026-05-21):** Store "Nespresso-like" generico — caffè in capsule e in grani, macchine espresso (compatte / pro / commerciali), accessori (tazzine, decalcificanti, schiumalatte). **MAI citare Nespresso né altri brand reali**, niente claim numerici verificabili (mg caffeina, prezzi reali, certificazioni), niente nomi prodotto copiati da siti reali. Naming del demo store: placeholder `Aurum Caffè` o `Riserva Espresso` (owner sceglierà nella prima pagina `store_info.md`).
- Rinominato `product_overview.md` → `product_catalog.md` (più chiaro per dominio caffè)

## 4. Definition of Done

- [ ] Cartella `knowledge/` creata con tutte le sottocartelle indicate
- [ ] `knowledge/CLAUDE.md` con convenzioni complete (frontmatter, stile, link, lingua, **niente brand reali / niente claim numerici verificabili**)
- [ ] Almeno 6 pagine in `public/` + 3 in `internal/` con contenuto plausibile EN coerente col tema Nespresso-like
- [ ] `index.md` rigenerato con 1-riga per ogni pagina
- [ ] `log.md` inizializzato con **un'entry per ogni file scritto** (audit trail richiesto dall'owner)
- [ ] `tools/ingest_pdf.md` con runbook semi-automatico (pdftotext + prompt template per Claude)
- [ ] `specs/07_AI_Engine.md` aggiornato (Wiki approach, niente pgvector) — nota Pilot già aggiunta in cima
- [ ] `.gitignore` aggiornato (knowledge/_raw/*.pdf)
- [ ] **Token count totale della wiki misurato e riportato in `log.md`** (es. via `wc -w` + stima 1 token ≈ 0.75 parole, o tramite Anthropic count-tokens API). Se > 80k token → segnalare all'owner prima di chiudere F1 (impatta cache cost e turn cap).

## Note per la prossima sessione

- Tema confermato: **Nespresso-like generico** (caffè + macchine + accessori). Naming demo store da scegliere nella prima pagina `store_info.md` — suggerimenti placeholder: `Aurum Caffè`, `Riserva Espresso`. Owner conferma al momento.
- Lingua wiki: **inglese** (decisione locked, vedi memoria project-pilot-approach-decision).
- Non serve ingestare un PDF vero: l'owner ha detto che inventerà tutto. Crea contenuti inventati coerenti col tema.
- **Vincoli content**: niente brand reali (Nespresso, Illy, Lavazza, etc.), niente claim numerici verificabili online (mg caffeina, score qualità, prezzi di mercato), niente nomi-prodotto copiati. Inventa varietà, blend, modelli macchina, accessori plausibili ma fittizi.
- A fine sessione, misurare token count totale wiki e annotarlo in `log.md`. Soglia di attenzione: 80k token.
