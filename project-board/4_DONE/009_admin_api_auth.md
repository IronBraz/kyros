---
ID: 009
TASK: Implementare Admin API - Auth + Stores
OWNER: Claude
STATUS: DONE
COMPLETED: 2025-12-31
---

**COSA:** Creare 2 endpoint autenticazione Admin: login PIN + lista stores

**PERCHÉ:** Admin Control Room richiede login con PIN prima di accedere. Lista stores serve per dropdown pre-login

**RISULTATO:**

- [x] API_Admin_GetStores → GET /api/v1/admin/auth/stores (ID: ali7OUqOD0B5ZZON)
  - Query pubblica (no auth): SELECT id, name FROM stores ORDER BY name
- [x] API_Admin_AuthVerify → POST /api/v1/admin/auth/verify (ID: nX6K2xLabjaKBKbu)
  - Verifica PIN vs admin_access table
  - Genera session_token UUID (8h expiry)
  - Update last_used_at
  - Gestisce 404 STORE_NOT_FOUND e 401 INVALID_ACCESS_CODE
- [x] 2 file JSON esportati:
  - OUTPUT/n8n/012_API_Admin_GetStores.json
  - OUTPUT/n8n/013_API_Admin_AuthVerify.json

**Riferimenti:**
- SPECS/05_Infra_Architecture.md § Admin API Auth
- SPECS/04_Database.md § admin_access table

**Note & Log:**
- 2025-12-31: Completato. Session token generato come UUID-timestamp. Expiry 8 ore hardcoded per MVP.
