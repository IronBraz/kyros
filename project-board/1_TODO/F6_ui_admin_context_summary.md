---
ID: F6
TASK: UI admin — ContextSummaryCard in Control Room
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F4 (summary deve essere presente nella response GetQueueStatus)
ESTIMATE: 0.5 day
---

## 1. Contesto e Obiettivo

Mostrare in Control Room (CounterMode) un riassunto della conversazione AI del cliente chiamato, con badge sentiment colorato.

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F6
- **Memoria progetto:** `project-pilot-approach-decision`
- **Obiettivo:** Al click "Call Next", entro ~5s sopra al customer chiamato appare una card con summary + sentiment.

## 2. Specifiche Tecniche

### Nuovo componente

- `pwa/src/components/admin/ContextSummaryCard.tsx`
  - Props: `{ summary, sentiment: -1|0|1, flags: string[], status: 'pending'|'generating'|'ready'|'error', message_count: number }`
  - Display (**tutto in inglese**, decisione D4 del piano audit 2026-05-21):
    - Title: **"AI Conversation Summary"**
    - Summary text (max 2 righe, truncate con ellipsis se più lungo) — il contenuto è output del modello, già in EN
    - Sentiment badge: 🟢 verde "Positive" (+1) / 🟡 giallo "Neutral" (0) / 🔴 rosso "Negative" (-1) — usare Lucide icon CheckCircle / Minus / AlertCircle
    - Flag chips orizzontali (max 3 visibili, "+N" se più)
    - Footer: badge `message_count` ("12 messages exchanged")
  - Stati:
    - `pending` / `generating`: skeleton loader con label "Generating summary..."
    - `ready`: card piena
    - `error`: "Summary unavailable" + retry button
    - **empty (cliente non ha chattato)**: card mostra "Customer didn't use the AI concierge." (con icona Info attenuata). NON nascondere la card — l'admin deve sapere che il cliente non ha interagito.
    - no data (entry assente — non dovrebbe mai succedere post-F4 fix): card non renderizzata

### Modifiche

- `pwa/src/routes/admin/modes/CounterMode.tsx` — inserire `<ContextSummaryCard>` sopra al customer chiamato
- `pwa/src/lib/api/admin.ts` — estendere tipo response di `getQueueStatus` per includere `ai_summary?`
- `pwa/src/types/admin.ts` — aggiungere a `Customer`:
  ```ts
  ai_summary?: {
    summary: string;
    sentiment: -1 | 0 | 1;
    flags: string[];
    status: 'pending' | 'ready' | 'error';
  }
  ```

### File Coinvolti

- `pwa/src/components/admin/ContextSummaryCard.tsx` — Nuovo
- `pwa/src/routes/admin/modes/CounterMode.tsx` — Modifica
- `pwa/src/lib/api/admin.ts` — Modifica (tipo)
- `pwa/src/types/admin.ts` — Modifica (tipo)

## 3. Vincoli e Convenzioni

- **Lingua UI della card: TUTTO English** (decisione owner 2026-05-21, D4 del piano audit): titolo, labels sentiment (Positive/Neutral/Negative), footer message count, error/empty messages. Inconsistenza accettata col resto del Control Room in IT.
- Design system: Tailwind, Glass Card, Lucide
- **Polling cadence**: quando c'è un cliente in stato `called`, polling a **2s** per il summary (override del 5s standard del ControlRoom). Timeout: se `status` resta `pending|generating` dopo **8s** dal `called`, mostrare stato `error` con retry button (l'admin può rinunciare al summary e procedere).
- Quando il customer passa a `serving` o `finished`, ricondurre il polling al ritmo standard del ControlRoom (il summary è stabile ormai).

## 4. Definition of Done

- [ ] ContextSummaryCard renderizza correttamente nei 5 stati (pending/generating, ready, error, empty, no-data)
- [ ] CounterMode mostra la card sopra al customer chiamato quando esiste
- [ ] Sentiment badge colore corretto in tutti i 3 casi (Positive/Neutral/Negative)
- [ ] Flag chips troncano con "+N" se >3
- [ ] **Polling 2s** durante stato `called`; **timeout 8s** porta a stato `error`
- [ ] **Empty state** (cliente non ha chattato): card mostra "Customer didn't use the AI concierge."
- [ ] Test E2E: cliente chatta + admin clicca Call Next → entro 8s la card appare ready in Control Room
- [ ] Build production OK: `cd pwa && npm run build`

## Note per la prossima sessione

- Decisione lingua card chiusa il 2026-05-21: **tutto EN** (D4 del piano audit).
