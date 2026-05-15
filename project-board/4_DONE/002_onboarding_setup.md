# TASK-002: Onboarding Wizard (First Store)

**Stato:** TODO
**Priorità:** Alta
**Owner:** Gemini

## Descrizione
Implementare l'endpoint `POST /api/v1/admin/setup` che permette di inizializzare il sistema creando la struttura base necessaria per operare. Questo endpoint deve essere chiamato solo se `GET /init` restituisce `setup_required: true`.

## Specifica API
- **Endpoint:** `POST /api/v1/admin/setup`
- **Body Richiesto:**
  ```json
  {
    "brand_name": "My Coffee Shop",
    "store_name": "Milano Centrale",
    "address": "Piazza Duca d'Aosta 1",
    "admin_pin": "1234"
  }
  ```
- **Logica (Transazionale):**
  1. INSERT into `tenants` (Brand).
  2. INSERT into `stores` (Store collegato al Brand).
  3. INSERT into `admin_access` (PIN Manager per lo Store).
  4. INSERT into `ticket_sequences` (Inizializza contatore A-000).
- **Risposta Successo:**
  ```json
  {
    "status": "success",
    "data": {
        "tenant_id": "uuid...",
        "store_id": "uuid..."
    }
  }
  ```

## Checklist
- [ ] Creare workflow n8n `003_setup_tenant.json`.
- [ ] Usare CTE (Common Table Expressions) per garantire atomicità SQL (tutto o niente).
- [ ] Testare creazione con dati validi.
- [ ] Verificare che `GET /init` ora restituisca "Ready".
