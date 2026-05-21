---
ID: F8
TASK: Settings admin panel — wiki reload + AI usage counter
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F3 (endpoints /admin/wiki/reload e /admin/usage devono esistere)
ESTIMATE: 2-3 hours
---

## 1. Contesto e Obiettivo

Aggiungere alla Control Room una sezione Settings che esponga due controlli admin necessari per gestire il Pilot in modo "owner-friendly":

1. **Reload Knowledge Base** — bottone manuale per ricaricare il contenuto della wiki cache n8n senza dover fare logout/login.
2. **AI Usage Counter** — indicatore del consumo Anthropic del mese corrente vs. il cap di €3/mese (hard kill-switch).

- **Riferimento Master:** piano di pre-Pilot audit del 2026-05-21 (sezione C8), `specs/Pilot_Handover.md` §11.
- **Memoria progetto:** `project-pilot-approach-decision` (decision D3 — budget cap €3 con counter visibile in Settings).
- **Obiettivo:** L'owner durante la demo può ricaricare la wiki dopo aver aggiornato un file in `knowledge/public/`, e ha visibilità in tempo reale del consumo Anthropic per evitare sorprese.

## 2. Specifiche Tecniche

### Nuova schermata / sezione

La Control Room ha già 5 mode (Counter, Analytics, Zones, Content, Settings). Aggiungere una **sotto-sezione "AI / Pilot"** dentro SettingsMode (se non esiste un container Settings dedicato, crearne uno).

Path frontend: `pwa/src/routes/admin/modes/SettingsMode.tsx` (verificare nome reale) — aggiungere card:

```
┌─ AI / Pilot ────────────────────────────┐
│ Knowledge Base                          │
│ Last reload: 2026-05-21 14:32 UTC       │
│ Wiki version: 2026-05-21-a (5 pages)    │
│   [ Reload Knowledge Base ]             │
│                                         │
│ Anthropic Usage (May 2026)              │
│ €0.42 / €3.00 used  ▓▓░░░░░░  14%       │
│ (kill-switch active above €3.00)        │
└─────────────────────────────────────────┘
```

### Nuovi componenti

- `pwa/src/components/admin/WikiReloadCard.tsx`
  - Mostra last_reload + wiki_version + numero pagine
  - Bottone "Reload Knowledge Base" → `POST /api/v1/admin/wiki/reload`
  - Stati: idle / loading (durante reload, 2-10s) / success (toast) / error (messaggio rosso)
  - Conferma non bloccante (no modal): click parte subito

- `pwa/src/components/admin/AIUsageCard.tsx`
  - Mostra `total_cost_eur` / `cap_eur` con progress bar
  - Colore progress bar: verde fino 50%, giallo 50-80%, rosso >80%, lampeggiante rosso a 100%
  - Auto-refresh via polling 30s (no spam, è un counter slow-moving)
  - Tooltip: spiegazione "If the cap is reached, the AI chat returns a canned message until the next month."

### Modifiche

- `pwa/src/routes/admin/modes/SettingsMode.tsx` — inserire le due card nella sezione "AI / Pilot"
- `pwa/src/lib/api/admin.ts` — aggiungere `reloadWiki()` e `getAIUsage()` helpers
- `pwa/src/types/admin.ts` — aggiungere tipi `AIUsage` e `WikiStatus`

### Tipi

```ts
interface AIUsage {
  year_month: string;       // '2026-05'
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_eur: number;
  cap_eur: number;          // 3.00
  percent_used: number;     // 0-100+
}

interface WikiStatus {
  version: string;
  last_reload_at: string;   // ISO timestamp
  page_count: number;
}
```

### File Coinvolti

- `pwa/src/components/admin/WikiReloadCard.tsx` — Nuovo
- `pwa/src/components/admin/AIUsageCard.tsx` — Nuovo
- `pwa/src/routes/admin/modes/SettingsMode.tsx` — Modifica (o crea se non esiste)
- `pwa/src/lib/api/admin.ts` — Modifica
- `pwa/src/types/admin.ts` — Modifica

## 3. Vincoli e Convenzioni

- Lingua UI: **English** (coerenza con la chat e con la ContextSummaryCard del Pilot)
- Design system: Tailwind, Glass Card, Lucide icons (`RefreshCw`, `Gauge`, `AlertTriangle`)
- Polling AI usage: 30s (slow change rate, no spam)
- Reload wiki: NON bloccare l'admin durante l'operazione (loading state nel componente, resto della UI funzionante)

## 4. Definition of Done

- [ ] Card "Knowledge Base" mostra info wiki corrente + bottone reload
- [ ] Click su Reload chiama `POST /api/v1/admin/wiki/reload` e mostra feedback (toast success o error rosso)
- [ ] Card "Anthropic Usage" mostra cost/cap con progress bar colorata
- [ ] Polling 30s aggiorna automaticamente il counter
- [ ] Stati error e empty gestiti graficamente (es. endpoint down)
- [ ] Build production OK: `cd pwa && npm run build`

## Note per la prossima sessione

- Verificare se esiste già una `SettingsMode.tsx` in `pwa/src/routes/admin/modes/` o se va creata.
- Il bottone "Reload Knowledge Base" sostituisce il trigger automatico su admin login (B6 del piano audit) — più owner-friendly e meno fragile in demo.
- Se l'owner vuole anche un counter di conversazioni totali del mese (oltre al costo), aggiungere campo `total_conversations` in `ai_usage_monthly` e nel display. Decisione differibile a fine F8.
