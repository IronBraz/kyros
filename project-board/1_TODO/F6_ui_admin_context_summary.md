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
  - Props: `{ summary, sentiment: -1|0|1, flags: string[], status: 'pending'|'ready'|'error' }`
  - Display:
    - Summary (max 2 righe, truncate con ellipsis se più lungo)
    - Sentiment badge: 🟢 verde (+1) / 🟡 giallo (0) / 🔴 rosso (-1) — usare Lucide icon CheckCircle / Minus / AlertCircle
    - Flag chips orizzontali (max 3 visibili, "+N" se più)
  - Stati:
    - `pending`: skeleton loader
    - `ready`: card piena
    - `error`: "Could not generate summary" + retry button
    - no data: card non viene renderizzata

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

- Lingua UI: il resto della Control Room è in italiano, ma il **summary in sé è in inglese** (perché generato da AI in EN per coerenza con la chat). La cornice della card (titolo "AI Conversation Summary", labels) può restare in IT o passare a EN per uniformità — **DA CHIEDERE all'owner**: card label in IT o EN?
- Design system: Tailwind, Glass Card, Lucide
- Polling esistente di ControlRoom (~5s) raccoglie automaticamente il summary quando ready

## 4. Definition of Done

- [ ] ContextSummaryCard renderizza correttamente nei 4 stati (pending, ready, error, no-data)
- [ ] CounterMode mostra la card sopra al customer chiamato quando esiste
- [ ] Sentiment badge colore corretto in tutti i 3 casi
- [ ] Flag chips troncano con "+N" se >3
- [ ] Test E2E: cliente chatta + admin clicca Call Next → entro ~5-10s la card appare ready in Control Room
- [ ] Build production OK: `cd pwa && npm run build`

## Note per la prossima sessione

- Chiedere all'owner: language della cornice card (IT o EN)?
