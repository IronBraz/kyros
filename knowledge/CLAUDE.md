# Knowledge Wiki — Conventions

This file documents the writing conventions for all pages in `knowledge/`. Follow these rules when creating or updating any wiki page.

## Frontmatter (Required)

Every page must start with YAML frontmatter:

```yaml
---
id: slug-of-the-page
title: Human-readable Title
audience: public|internal
topics: [topic1, topic2]
updated_at: YYYY-MM-DD
source_pdf: filename.pdf  # optional — omit if not from a PDF
---
```

- `id`: kebab-case slug matching the filename (without `.md`)
- `audience`: `public` = visible to client chat AI; `internal` = admin/staff only, NEVER sent to client chat
- `topics`: list of keywords for relevance filtering
- `updated_at`: ISO date of last meaningful edit
- `source_pdf`: optional reference to original document in `_raw/`

## Style Rules

- **Bullet-first**: prefer bullet lists over prose paragraphs
- **Concise**: max ~200 words per page; split into multiple pages if needed
- **Cross-links**: use `[[slug]]` syntax to reference other pages
- **Language**: ALL pages must be in **English** (owner decision 2026-05-20 — chat is EN only)
- **No marketing fluff**: concrete facts only, no superlatives without data
- **No real brands**: never name Nespresso, Illy, Lavazza, Starbucks or any real competitor
- **No verifiable claims**: no specific caffeine mg, no certified origin percentages, no awards by real bodies
- **No real prices in public pages**: price ranges or "ask staff" only; real prices live in `internal/pricing_internal.md`

## Audience Rules

| Folder | Audience | Sent to client chat? |
|--------|----------|---------------------|
| `public/` | `public` | YES — included in system prompt on every request |
| `internal/` | `internal` | NO — admin/staff use only |
| `tools/` | internal | NO |

## Cross-linking

Use `[[slug]]` to link between pages:
- `[[store_info]]` — store identity and location
- `[[product_catalog]]` — full product list
- `[[hours]]` — opening hours
- `[[returns_policy]]` — return and refund rules
- `[[faq]]` — frequently asked questions
- `[[in_store_services]]` — workshops, repairs, services

## PDF Ingestion

See `tools/ingest_pdf.md` for the semi-automatic runbook for converting real PDFs into wiki pages.

## Token Budget

The entire `public/` folder is loaded into the LLM system prompt on every request (with Anthropic prompt caching). Keep total `public/` content under **60k tokens** to stay well within the Haiku 4.5 context window and the Pilot turn cap. Estimate: `wc -w knowledge/public/*.md` → divide total words by 0.75.
