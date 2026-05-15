---
ID: 008
TASK: Implementare 4 Client API Workflow (n8n)
OWNER: Claude
STATUS: DONE
COMPLETED: 2025-12-31
---

**COSA:** Creare 4 endpoint API per Client PWA: create session, get session, heartbeat, abandon

**PERCHÉ:** Client mobile deve poter entrare in coda, recuperare stato, inviare keep-alive, uscire

**RISULTATO:**

- [x] API_Client_CreateSession → POST /api/v1/client/sessions (ID: 9NMKwq3yvccTFBtj)
  - Valida entry_point, check store.settings.queue.accepting_tickets
  - Genera ticket_code con funzione generate_ticket_code(store_id)
  - Ritorna 503 QUEUE_CLOSED se coda chiusa
- [x] API_Client_GetSession → GET /api/v1/client/sessions/:id (ID: 1EEMBmIUQlpcGrHL)
  - Query session + calcola posizione in coda
- [x] API_Client_Heartbeat → POST /api/v1/client/sessions/:id/heartbeat (ID: Oc45wRaXmQylcIJZ)
  - Update last_seen_at timestamp
- [x] API_Client_AbandonSession → POST /api/v1/client/sessions/:id/abandon (ID: 7GaVWzSrUxG6kz25)
  - Set status='abandoned', finished_at=NOW()
- [x] 4 file JSON esportati in OUTPUT/n8n/:
  - 008_API_Client_CreateSession.json
  - 009_API_Client_GetSession.json
  - 010_API_Client_Heartbeat.json
  - 011_API_Client_Abandon.json

**Riferimenti:**
- SPECS/05_Infra_Architecture.md § Client API
- OUTPUT/postgres/kyros_schema.sql § generate_ticket_code()

**Note & Log:**
- 2025-12-31: Tutti workflow implementati con If node v2.2, responseMode: responseNode, gestione errori 404/503.
