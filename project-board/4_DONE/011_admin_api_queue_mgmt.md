---
ID: 011
TASK: Implementare Admin API - Queue Management
OWNER: Claude
STATUS: DONE
COMPLETED: 2025-12-31
---

**COSA:** Creare 3 endpoint gestione coda Admin: get queue, update settings, get status

**PERCHÉ:** Admin Control Room mostra coda corrente, può toggle queue on/off, vede widget status

**RISULTATO:**

- [x] API_Admin_GetQueue → GET /api/v1/admin/queue/current?store_id=uuid (ID: ByLIhDhHZGmvhTj0)
  - Query sessions WHERE status IN ('waiting','called')
  - Calcola wait_minutes per session
  - Ritorna counts.waiting e counts.called
- [x] API_Admin_UpdateStoreSettings → PATCH /api/v1/admin/stores/:id/settings (ID: mEBFtRiS8Condux6)
  - Merge JSONB settings: `settings || $2::jsonb`
  - Supporta toggle queue on/off
- [x] API_Admin_GetQueueStatus → GET /api/v1/admin/stores/:id/queue/status (ID: VZikSmAjfffA90EO)
  - Ritorna accepting_tickets, waiting_count, called_count, avg_wait_minutes
  - Calcola system_status: 'active' | 'paused' | 'closed'
- [x] 3 file JSON esportati:
  - OUTPUT/n8n/015_API_Admin_GetQueue.json
  - OUTPUT/n8n/016_API_Admin_UpdateSettings.json
  - OUTPUT/n8n/017_API_Admin_GetQueueStatus.json

**Riferimenti:**
- SPECS/05_Infra_Architecture.md § Admin API Queue Management
- SPECS/04_Database.md § stores.settings JSONB

**Note & Log:**
- 2025-12-31: system_status logic: active (accepting=true), paused (accepting=false ma coda non vuota), closed (accepting=false e coda vuota).
