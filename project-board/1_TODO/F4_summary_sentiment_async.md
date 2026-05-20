---
ID: F4
TASK: Summary + sentiment async — n8n job triggered on Call Next
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F3 (need ai_messages populated)
ESTIMATE: 0.5 day
---

## 1. Contesto e Obiettivo

Quando l'admin clicca "Call Next", lanciare in background un workflow che riassume la conversazione AI del cliente chiamato + sentiment, e lo scrive in `ai_summaries`. L'admin lo vede comparire in Control Room via polling (no Socket.io).

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F4
- **Memoria progetto:** `project-pilot-approach-decision`
- **Obiettivo:** L'admin che chiama un cliente vede entro ~5s un riassunto + sentiment badge in Control Room.

## 2. Specifiche Tecniche

### Nuovo workflow

- `n8n/027_JOB_Conversation_Summary.json` — webhook interno `POST /internal/ai/summarize`
  - Input: `{ conversation_id }`
  - Logic:
    1. SELECT ultimi N messaggi (max 30) `WHERE conversation_id=...`
    2. INSERT placeholder in `ai_summaries` con `status='pending'` (idempotente: ON CONFLICT DO NOTHING)
    3. Chiamata Haiku 4.5 con **structured output JSON**:
       ```json
       {"summary": "string (max 200 chars)", "sentiment": -1|0|1, "flags": ["string"]}
       ```
    4. UPDATE `ai_summaries` con risultato + `status='ready'` + `generated_at`
    5. Su errore: `status='error'`
  - Output: `{ status, summary_id }`

### Prompt summary

- File: `n8n/prompts/system_summary.md` (English)
- Output strict JSON
- Instructions: 2-3 sentences max, sentiment based on customer tone (-1 frustrated, 0 neutral, +1 satisfied), flags = topics highlighted (e.g. "return-issue", "product-inquiry", "complaint")

### Modifiche ai workflow esistenti

- **Workflow Call Next** (verificare nome reale in `n8n/`, candidato: `014_API_Admin_CallNext.json`): aggiungere nodo HTTP **fire-and-forget** verso `/internal/ai/summarize` subito dopo che la sessione passa a `called`. Non bloccare la risposta admin.
  
- **Workflow GetQueueStatus** (verificare nome reale, candidato: `017_API_Admin_GetQueueStatus.json`): includere nel payload il campo `ai_summary` via `LEFT JOIN ai_summaries ON ai_summaries.conversation_id = sessions.ai_conversation_id`. Il polling esistente di `ControlRoom.tsx` lo legge senza modifiche server-side.

### File Coinvolti

- `n8n/027_JOB_Conversation_Summary.json` — Nuovo
- `n8n/prompts/system_summary.md` — Nuovo
- `n8n/014_API_Admin_CallNext.json` (nome da verificare) — Modifica
- `n8n/017_API_Admin_GetQueueStatus.json` (nome da verificare) — Modifica

## 3. Vincoli e Convenzioni

- **Async fire-and-forget**: la chiamata da CallNext a /summarize non blocca la response admin
- Modello: Haiku 4.5 (stesso della chat — una sola dipendenza)
- Structured output via Anthropic API tool use o JSON mode
- Idempotenza: chiamare /summarize più volte per stessa conversation_id non duplica
- Lingua summary + flags: **English**

## 4. Definition of Done

- [ ] Workflow 027 creato e attivo
- [ ] CallNext modificato per triggerare /summarize
- [ ] GetQueueStatus restituisce `ai_summary` quando esiste
- [ ] Test end-to-end: cliente chatta → admin clicca Call Next → entro 5s `ai_summaries` ha row con `status='ready'`
- [ ] Sentiment corretto in 3 casi (cliente felice/neutrale/frustrato — testabile con seed script in F7)
- [ ] Idempotenza verificata (doppio trigger → 1 sola row)

## Note per la prossima sessione

- Aprire l'UI n8n e verificare i nomi REALI dei workflow CallNext e GetQueueStatus prima di modificarli. I numeri (014, 017) sono stati ipotizzati.
