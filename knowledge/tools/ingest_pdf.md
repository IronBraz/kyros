---
id: ingest_pdf
title: PDF Ingestion Runbook
audience: internal
topics: [tools, pdf, ingestion, workflow, runbook]
updated_at: 2026-05-21
---

# PDF Ingestion Runbook

Semi-automatic process for converting product/policy PDFs into knowledge wiki pages.

## Step 1 — Extract Text from PDF

```bash
# Install pdftotext (part of poppler-utils)
# Linux/macOS: sudo apt install poppler-utils / brew install poppler
# Windows: install via Chocolatey: choco install poppler

pdftotext -layout /path/to/document.pdf output.txt
```

For scanned/image PDFs (no embedded text), use OCR first:
- Adobe Acrobat (Export as TXT with OCR)
- Tesseract: `tesseract input.pdf output --dpi 300`

## Step 2 — Review Extracted Text

Open `output.txt` and check for:
- OCR artifacts (garbled words, missing spaces, broken tables)
- Headers and section breaks to preserve
- Any PII or sensitive internal data to remove

## Step 3 — Convert to Wiki Page with Claude

Open a new Claude session and paste:

```
I have this raw PDF extract from Riserva Espresso store documents.
Convert it into a Kyros knowledge wiki page following these exact conventions:

FRONTMATTER (required):
- id: kebab-case slug matching intended filename
- title: human-readable title
- audience: public (if customer-facing) or internal (if staff-only)
- topics: list of keywords
- updated_at: today's date (YYYY-MM-DD)
- source_pdf: original filename

STYLE RULES:
- Bullet-first, max ~200 words per page (split if needed)
- Language: English only
- No real brand names (Nespresso, Illy, Lavazza, etc.)
- No verifiable numeric claims (caffeine mg, real prices, certifications)
- Cross-links using [[slug]] syntax where relevant
- No marketing fluff — concrete facts only

Raw text:
[PASTE TEXT HERE]
```

## Step 4 — Review and Edit

- Verify accuracy vs. the source PDF
- Confirm no brand names or real claims appeared
- Ensure frontmatter is complete and correct
- If > 200 words: split into two pages, each with its own `id`

## Step 5 — Save and Register

1. Save the file to `knowledge/public/` (customer-facing) or `knowledge/internal/` (staff-only)
2. Add a one-line entry to `knowledge/index.md`
3. Append an entry to `knowledge/log.md` with: date, filename, word count, source PDF

## Step 6 — Token Budget Check

After adding any new public page, re-check total token count:

```bash
# Words in public/ (approximate token count = words / 0.75)
wc -w knowledge/public/*.md
```

Alert the owner if total public/ exceeds **60,000 tokens** — it impacts Anthropic prompt caching cost and the Pilot conversation turn cap.
