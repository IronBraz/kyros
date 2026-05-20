---
ID: F3
TASK: Chat backend — n8n workflows for AI chat (NO gateway, no streaming)
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F1 (wiki must exist), F2 (DB tables must exist)
ESTIMATE: 1 day
---

## 1. Contesto e Obiettivo

Implementare il backend della chat AI **direttamente in n8n** (no microservizio gateway, no streaming SSE — decisione owner 2026-05-20).

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F3 (con le modifiche dovute alla decisione "no gateway")
- **Memoria progetto:** `project-pilot-approach-decision` (decisione #1: opzione C — no gateway)
- **Obiettivo:** Endpoint n8n che riceve un messaggio cliente, lo manda a Claude Haiku 4.5 con la wiki pubblica nel system prompt (con prompt caching), aspetta la risposta completa, la persiste in `ai_messages`, la restituisce al frontend.

## 2. Specifiche Tecniche

### Architettura (semplificata rispetto al doc originale)

```
Frontend (ChatPanel) ──POST──▶ n8n /api/v1/client/chat/start
                                      │
                                      ▼
                              crea ai_conversation, ritorna conversation_id
                              
Frontend ──POST──▶ n8n /api/v1/client/chat/send  (per ogni turno)
                          │
                          ├─▶ carica wiki pubblico da cache (vedi sotto)
                          ├─▶ chiama Anthropic Messages API:
                          │     - model: claude-haiku-4-5-20251001
                          │     - system: [wiki content] con cache_control: ephemeral
                          │     - messages: [storia conversazione + nuovo turno]
                          ├─▶ persiste user+assistant in ai_messages
                          └─▶ ritorna { reply, conversation_id }
```

### Workflow n8n da creare

- `n8n/025_API_Client_Chat_Start.json` — `POST /api/v1/client/chat/start`
  - Input: `{ session_id }`
  - Logic: verifica session valida → INSERT in `ai_conversations` (o riusa esistente se già linkata) → UPDATE `sessions.ai_conversation_id`
  - Output: `{ conversation_id, wiki_version }`

- `n8n/026_API_Client_Chat_Send.json` — `POST /api/v1/client/chat/send`
  - Input: `{ conversation_id, message }`
  - Logic:
    1. SELECT storia messaggi (`ai_messages WHERE conversation_id=...` ORDER BY created_at)
    2. Controlla turn cap: se message_count >= 30, ritorna messaggio di chiusura senza chiamare AI
    3. Carica wiki da cache (vedi sub-workflow sotto)
    4. Chiamata HTTP a Anthropic Messages API con prompt caching
    5. INSERT user message + assistant message in `ai_messages`
    6. UPDATE `ai_conversations.message_count`, `last_message_at`
  - Output: `{ reply, message_count, capped: bool }`

- `n8n/028_SUB_Wiki_Loader.json` — sub-workflow riusabile
  - Carica tutti i file in `knowledge/public/*.md` in una variabile di environment / cache
  - Trigger di reload: chiamato da workflow `029_HOOK_Admin_Login_WikiReload` (vedi F4) + chiamato all'avvio se cache vuota

### Workflow per reload wiki

- `n8n/029_HOOK_Admin_Login_WikiReload.json` — chiamato dal workflow admin login (modifica a `009_API_Admin_Auth.json` o equivalente) per forzare reload della wiki cache

### System prompt

- File: `n8n/prompts/system_chat.md` (o inline nel workflow)
- Lingua: **English**
- Persona: Digital Concierge, riferimento `specs/07_AI_Engine.md` §4-16 — tono caldo, professionale, sintetico (2-3 frasi mobile-optimized)
- Strict grounding: l'AI risponde solo basandosi sulla wiki; se la risposta non è in wiki, ammette di non sapere

### File Coinvolti

- `n8n/025_API_Client_Chat_Start.json` — Nuovo
- `n8n/026_API_Client_Chat_Send.json` — Nuovo
- `n8n/028_SUB_Wiki_Loader.json` — Nuovo
- `n8n/029_HOOK_Admin_Login_WikiReload.json` — Nuovo
- `n8n/prompts/system_chat.md` — Nuovo
- `n8n/009_API_Admin_Auth.json` (o nome reale, da verificare) — Modifica per chiamare 029 al login

## 3. Vincoli e Convenzioni

- **NO microservizio gateway** (decisione owner)
- **NO streaming SSE** (decisione owner) — request-response classico, anche se richiede 3-5s di attesa lato cliente
- **NO Socket.io** (mai introdotto nell'MVP, non si introduce ora)
- Modello: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`)
- Prompt caching: usare `cache_control: { type: "ephemeral" }` sul system prompt per scontare il caricamento wiki
- Budget cap: **€1/mese** sull'API key Anthropic (configurare in dashboard Anthropic)
- API key in variabile n8n environment (non hardcoded)
- Risposta standard via `SUB_Response_Standardizer`
- Multi-tenant isolation: validare `session_id` appartenga a store del cliente

## 4. Definition of Done

- [ ] `/chat/start` crea conversazione e ritorna ID
- [ ] `/chat/send` chiama Anthropic e persiste turni
- [ ] Cache wiki funziona: prima chiamata lenta (carica da disco), successive veloci
- [ ] Reload triggered da admin login funziona (verifica con `log.md` o log n8n)
- [ ] Turn cap a 30 turns: oltre, risposta canned senza chiamata AI
- [ ] Test manuale: 3 messaggi consecutivi → 3 entry user + 3 entry assistant in `ai_messages`
- [ ] Prompt caching attivo: verificare header `cache_read_input_tokens` > 0 dopo prima chiamata
- [ ] Budget cap €1/mese configurato in Anthropic console

## Note per la prossima sessione

- Verificare il nome esatto del workflow di admin login esistente (in `n8n/` ci sono i file con i nomi reali)
- Se il prompt caching n8n risulta difficile da configurare (header custom?), fallback temporaneo: nessun caching, accettiamo costo più alto solo per la demo
