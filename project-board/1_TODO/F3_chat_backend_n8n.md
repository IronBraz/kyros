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
    2. **Controlla budget cap** (sub-workflow `030_SUB_Budget_Check`): se `ai_usage_monthly.total_cost_eur >= 3.00`, ritorna canned response senza chiamare Anthropic
    3. Controlla turn cap: se `message_count >= 30` (totale msg user+assistant), ritorna canned di chiusura senza chiamare AI. **Il canned NON viene salvato in `ai_messages`** (counter resta a 30, no off-by-one).
    4. Carica wiki da cache (sub-workflow `028_SUB_Wiki_Loader`)
    5. Chiamata HTTP a Anthropic Messages API con prompt caching
    6. INSERT user message + assistant message in `ai_messages`
    7. UPDATE `ai_conversations.message_count`, `last_message_at`
    8. **UPDATE `ai_usage_monthly`** del mese corrente: `total_input_tokens += input_tokens`, `total_output_tokens += output_tokens`, `total_cost_eur = computed(...)`
  - Output: `{ reply, message_count, capped: bool, capped_reason: 'turn'|'budget'|null }`

- `n8n/028_SUB_Wiki_Loader.json` — sub-workflow riusabile
  - Carica tutti i file in `knowledge/public/*.md` in una variabile di environment / cache
  - Trigger di reload: chiamato da workflow `029_HOOK_Admin_Login_WikiReload` + da endpoint `/api/v1/admin/wiki/reload` (bottone manuale, vedi F8) + all'avvio se cache vuota

- `n8n/030_SUB_Budget_Check.json` — sub-workflow riusabile (**nuovo, aggiunto 2026-05-21**)
  - Input: nessuno
  - Logic: SELECT `total_cost_eur` da `ai_usage_monthly WHERE year_month = TO_CHAR(NOW(), 'YYYY-MM')`. Se non esiste, INSERT con default 0.
  - Output: `{ within_budget: boolean, current_cost: number, cap_eur: 3.00 }`

### Workflow per reload wiki

- `n8n/029_HOOK_Admin_Login_WikiReload.json` — chiamato dal workflow admin login (modifica a `013_API_Admin_AuthVerify.json` o nome reale) per forzare reload della wiki cache all'inizio della sessione admin
- **Endpoint manuale**: `POST /api/v1/admin/wiki/reload` — esposto dal workflow `029` (o creare un wrapper `031_API_Admin_Wiki_Reload.json`) per il **bottone "Reload Knowledge Base"** in F8

### Endpoint admin per usage counter

- `GET /api/v1/admin/usage` — workflow `032_API_Admin_AIUsage.json` (nuovo). SELECT da `ai_usage_monthly` del mese corrente, ritorna `{ year_month, total_input_tokens, total_output_tokens, total_cost_eur, cap_eur: 3.00, percent_used }`. Letto dal `AIUsageCard` in F8.

### System prompt

- File: `n8n/prompts/system_chat.md` (preferibile a inline per facilità di tuning)
- Lingua: **English** (override del default IT — vedi `specs/07_AI_Engine.md` nota in cima)
- **Importante**: NON copiare letteralmente la persona da `specs/07_AI_Engine.md` §2-§3 — quella è in italiano. Tradurre i concetti in EN, mantenendo: ruolo "Brand Concierge", tono caldo + professionale, risposte 2-3 frasi mobile-optimized, prime directive "never put the brand in a bad light".
- Strict grounding: l'AI risponde solo basandosi sulla wiki; se la risposta non è in wiki, ammette di non sapere e suggerisce di chiedere all'assistant in store.
- **Guardrail content**: niente claim numerici (caffeina mg, prezzi reali, certificazioni). Niente nomi di brand reali (Nespresso, Illy, etc.). Se l'utente chiede esplicitamente di un brand reale, redirigere educatamente al catalogo dello store.

### Budget & turn cap — semantiche precise

- **Turn cap = 30 messaggi totali** (user + assistant). Praticamente 15 turn conversazionali. Quando `ai_conversations.message_count >= 30`, il workflow ritorna canned response senza chiamare Anthropic e senza salvare la canned in `ai_messages`.
- **Budget cap = €3.00/mese** sulla tabella `ai_usage_monthly`. Costo per chiamata calcolato come `(input_tokens × $0.80 / 1M + output_tokens × $4.00 / 1M) × tasso_USD_EUR`. Tasso USD/EUR hardcodato nel workflow (es. 0.92) — è approssimativo, accettabile per il Pilot. Tariffe Haiku 4.5 da verificare in fase implementazione su anthropic.com/pricing.
- Canned responses (EN):
  - Turn cap raggiunto: `"We've chatted plenty! Your turn is coming up soon — see you at the desk."`
  - Budget cap raggiunto: `"Our concierge is taking a break right now. Please ask the assistant when it's your turn."`

### File Coinvolti

- `n8n/025_API_Client_Chat_Start.json` — Nuovo
- `n8n/026_API_Client_Chat_Send.json` — Nuovo
- `n8n/028_SUB_Wiki_Loader.json` — Nuovo
- `n8n/029_HOOK_Admin_Login_WikiReload.json` — Nuovo
- `n8n/030_SUB_Budget_Check.json` — **Nuovo** (budget cap check)
- `n8n/031_API_Admin_Wiki_Reload.json` — **Nuovo** (endpoint manuale `POST /api/v1/admin/wiki/reload` per F8)
- `n8n/032_API_Admin_AIUsage.json` — **Nuovo** (endpoint `GET /api/v1/admin/usage` per F8)
- `n8n/prompts/system_chat.md` — Nuovo (EN, vedere nota sopra)
- `n8n/013_API_Admin_AuthVerify.json` (o nome reale, da verificare) — Modifica per chiamare 029 al login

## 3. Vincoli e Convenzioni

- **NO microservizio gateway** (decisione owner)
- **NO streaming SSE** (decisione owner) — request-response classico, anche se richiede 3-5s di attesa lato cliente
- **NO Socket.io** (mai introdotto nell'MVP, non si introduce ora)
- Modello: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`)
- Prompt caching: usare `cache_control: { type: "ephemeral" }` sul system prompt per scontare il caricamento wiki
- **Budget cap: €3/mese** (aggiornato 2026-05-21) con **hard kill-switch in n8n** (workflow `030_SUB_Budget_Check`) — NON basarsi solo sulla dashboard Anthropic. Counter visibile in F8.
- API key in variabile n8n environment (non hardcoded)
- Risposta standard via `SUB_Response_Standardizer`
- Multi-tenant isolation: validare `session_id` appartenga a store del cliente

## 4. Definition of Done

- [ ] `/chat/start` crea conversazione e ritorna ID
- [ ] `/chat/send` chiama Anthropic e persiste turni
- [ ] Cache wiki funziona: prima chiamata lenta (carica da disco), successive veloci
- [ ] Reload triggered da admin login funziona (verifica con `log.md` o log n8n)
- [ ] **Endpoint manuale `/admin/wiki/reload`** funziona (usato dal bottone in F8)
- [ ] **Endpoint `/admin/usage`** ritorna counter del mese corrente (usato da F8)
- [ ] Turn cap a 30 messaggi totali (user+assistant): 31° tentativo → canned response senza chiamare Anthropic
- [ ] **Budget cap kill-switch**: con `total_cost_eur >= 3.00` artificialmente settato, `/chat/send` ritorna canned budget message senza chiamare Anthropic
- [ ] Dopo ogni chiamata Anthropic riuscita, `ai_usage_monthly.total_cost_eur` incrementato correttamente
- [ ] Test manuale: 3 messaggi consecutivi → 3 entry user + 3 entry assistant in `ai_messages`
- [ ] Prompt caching attivo: verificare header `cache_read_input_tokens` > 0 dopo prima chiamata
- [ ] **Alert Anthropic dashboard a 80%** del cap configurato come backup di sicurezza (€2.40/mese)

## Note per la prossima sessione

- Verificare il nome esatto del workflow di admin login esistente (in `n8n/` ci sono i file con i nomi reali)
- Se il prompt caching n8n risulta difficile da configurare (header custom?), fallback temporaneo: nessun caching, accettiamo costo più alto solo per la demo
