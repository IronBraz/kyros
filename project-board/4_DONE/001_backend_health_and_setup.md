# TASK-001: DB Init & Backend Health

**Stato:** TODO
**Priorità:** Alta
**Owner:** Gemini

## Descrizione
Prima inizializzare lo schema del database (tabelle, funzioni, indici) usando lo script dedicato, poi implementare i primi endpoint di base in n8n per verificare la connettività.

## Checklist
- [ ] **Eseguire `OUTPUT/postgres/manage_kyros_db.ps1`** con flag RESET per creare lo schema da zero.
- [ ] Verificare manualmente che le tabelle (`sessions`, `stores`, etc.) esistano nel DB.
- [ ] Implementare `GET /api/v1/admin/health` (deve restituire status DB e versione).
- [ ] Implementare `GET /api/v1/admin/init` (check se esistono già store/tenant).
- [ ] Configurare il `SUB_Response_Standardizer` per uniformare le risposte (success/error).

## Note Tecniche
- Lo script PowerShell usa `docker exec` per lanciare `psql` nel container `neuroforge-postgres-1`.
- Utilizzare lo schema JSON definito in `SPECS/05_Infra_Architecture.md`.
