# TASK-003: Infrastructure Setup (Service & Entry Points)

**Stato:** TODO
**Priorità:** Alta
**Owner:** Gemini

## Descrizione
Configurare gli elementi fisici e virtuali del negozio: le Casse (Service Points) dove gli operatori chiamano i ticket, e i Punti di Ingresso (Entry Points) che generano i QR Code per i clienti.

## Specifica API

### 1. GET /api/v1/admin/stores/:store_id/infrastructure
Recupera la lista di tutte le casse e i punti di ingresso di uno store.

### 2. POST /api/v1/admin/stores/:store_id/service-points
Crea una nuova cassa.
- **Body:** `{"name": "Cassa 1"}`

### 3. POST /api/v1/admin/stores/:store_id/entry-points
Crea un nuovo punto di ingresso (QR).
- **Body:** `{"name": "Ingresso Principale", "slug": "main-entrance"}`

## Checklist
- [ ] Creare workflow n8n `004_infrastructure_mgmt.json`.
- [ ] Implementare la logica di Listing.
- [ ] Implementare la logica di Creazione Service Point.
- [ ] Implementare la logica di Creazione Entry Point.
- [ ] Verificare l'integrità dei dati nel DB dopo la creazione.
