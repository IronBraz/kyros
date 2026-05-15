---
ID: 010
TASK: Implementare Admin API - Call Next (CRITICO)
OWNER: Claude
STATUS: DONE
COMPLETED: 2025-12-31
---

**COSA:** Creare endpoint POST /queue/call-next con logica FIFO + DB lock per concorrenza

**PERCHÉ:** Pulsante "Chiama Prossimo" in Admin Control Room. CRITICO: 2 operatori simultanei NON devono chiamare stesso cliente (race condition)

**RISULTATO:**

- [x] API_Admin_CallNext → POST /api/v1/admin/queue/call-next (ID: LW27CrId1WjLwiDl)
  - Query SQL critica con FOR UPDATE SKIP LOCKED:
    ```sql
    UPDATE sessions SET status='called', called_at=NOW(), service_point_id=$1
    WHERE id = (
      SELECT id FROM sessions
      WHERE store_id=$2 AND status='waiting'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, ticket_code, store_id, entry_point_id, service_point_id, called_at;
    ```
  - Ritorna 404 NO_CUSTOMERS_WAITING se coda vuota
  - Include service_point_name nella risposta
- [x] File JSON esportato: OUTPUT/n8n/014_API_Admin_CallNext.json

**Riferimenti:**
- SPECS/05_Infra_Architecture.md § POST /queue/call-next
- SPECS/03_Architettura_Funzionale.md § FIFO Queue Logic

**Note & Log:**
- 2025-12-31: Implementato con FOR UPDATE SKIP LOCKED per prevenire race conditions. Due chiamate simultanee prenderanno clienti diversi.
