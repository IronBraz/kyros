---
ID: 019
TASK: Test End-to-End Completo (MVP Validation)
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Eseguire scenario completo Cliente → Admin con validazione DB e Socket.io

**PERCHÉ:** Validation finale che TUTTO il sistema funzioni insieme: API, Socket.io, PWA, DB

**COME:**

**SCENARIO TEST COMPLETO**:

**FASE A - Preparazione Dati**:
```bash
cd C:/NeuroForge

# Crea tenant, store, entry_point, service_point, admin_access per test
docker compose exec postgres psql -U n8n_user -d kyros_db <<EOF
-- Tenant
INSERT INTO tenants (id, name) VALUES (gen_random_uuid(), 'Test Tenant') RETURNING id;
-- Copia UUID tenant e inserisci sotto

-- Store
INSERT INTO stores (id, tenant_id, name, address)
VALUES (gen_random_uuid(), '<tenant_id>', 'Test Store', 'Via Test 1') RETURNING id;
-- Copia UUID store

-- Entry Point
INSERT INTO entry_points (store_id, name, slug)
VALUES ('<store_id>', 'Ingresso Principale', 'test-entrance');

-- Service Point
INSERT INTO service_points (store_id, name)
VALUES ('<store_id>', 'Cassa Test');

-- Admin Access (PIN: 1234)
INSERT INTO admin_access (store_id, access_code, label, is_active)
VALUES ('<store_id>', '1234', 'Test PIN', true);
EOF
```

**FASE B - Test Client Entry**:
1. Browser: `https://kyros.neuroforge.club/`
2. (Simula QR scan) Naviga manualmente a: `/?slug=test-entrance`
3. Click "Entra in Coda"
4. **VERIFICA**:
   - UI mostra ticket code (es: `A-001`)
   - UI mostra posizione in coda (es: `Posizione: 1`)
   - DevTools Console: "Socket connected: <id>"
   - DevTools Network: POST `/api/v1/client/sessions` → 200 OK

5. **VERIFICA DB**:
   ```bash
   docker compose exec postgres psql -U n8n_user -d kyros_db \
     -c "SELECT ticket_code, status, created_at FROM sessions ORDER BY created_at DESC LIMIT 1;"
   ```
   Atteso: `A-001 | waiting | <timestamp>`

**FASE C - Test Admin Call**:
1. Browser (altra tab): `https://kyros.neuroforge.club/control-room/`
2. Login PIN: `1234`
3. Seleziona store "Test Store"
4. **VERIFICA**: UI mostra coda con 1 cliente (A-001)
5. Click "Chiama Prossimo"
6. **VERIFICA**:
   - UI Admin: cliente A-001 passa a "Chiamato"
   - DevTools Network: POST `/api/v1/admin/queue/call-next` → 200 OK
   - Socket.io logs:
     ```bash
     docker compose logs socketio | grep "TICKET_CALLED\|ADMIN_DING"
     ```

**FASE D - Test Client Notification**:
1. Torna a tab Client
2. **VERIFICA**:
   - UI cambia automaticamente a schermata "È il tuo turno!"
   - DevTools Console: "🎫 YOUR TURN! {ticket_code: 'A-001'}"
   - (Opzionale) Vibrazione/suono se implementato

3. **VERIFICA DB**:
   ```bash
   docker compose exec postgres psql -U n8n_user -d kyros_db \
     -c "SELECT ticket_code, status, called_at FROM sessions WHERE ticket_code='A-001';"
   ```
   Atteso: `A-001 | called | <timestamp>`

**FASE E - Test Heartbeat**:
1. Resta in waiting room per 90 secondi
2. **VERIFICA DB**:
   ```bash
   docker compose exec postgres psql -U n8n_user -d kyros_db \
     -c "SELECT ticket_code, last_seen_at FROM sessions WHERE ticket_code='A-001';"
   ```
   Atteso: `last_seen_at` aggiornato negli ultimi 60 sec

**FASE F - Test Abandon**:
1. Client tab → Click "Abbandona Coda"
2. **VERIFICA**:
   - UI redirect a schermata "Grazie"
   - DevTools Network: POST `/abandon` → 200 OK

3. **VERIFICA DB**:
   ```bash
   docker compose exec postgres psql -U n8n_user -d kyros_db \
     -c "SELECT ticket_code, status, finished_at FROM sessions WHERE ticket_code='A-001';"
   ```
   Atteso: `A-001 | abandoned | <timestamp>`

**FASE G - Test Janitor** (opzionale):
1. Crea session senza heartbeat:
   ```bash
   curl -X POST https://kyros.neuroforge.club/api/v1/client/sessions \
     -H "Content-Type: application/json" \
     -d '{"entry_point_slug":"test-entrance"}'
   ```
2. Attendi 16 minuti (o modifica temporaneamente Janitor interval a 1 min)
3. **VERIFICA DB**: Session deve essere `abandoned`

**Acceptance Criteria:**
- [ ] Client: entry coda crea session con ticket A-001 in DB
- [ ] Client: Socket.io connesso (console log)
- [ ] Admin: login PIN funziona
- [ ] Admin: call-next aggiorna DB status → 'called'
- [ ] Client: riceve evento TICKET_CALLED e UI cambia
- [ ] Socket.io logs: eventi TICKET_CALLED e ADMIN_DING presenti
- [ ] Heartbeat: last_seen_at aggiornato ogni 60 sec
- [ ] Abandon: status diventa 'abandoned' in DB
- [ ] (Opzionale) Janitor: ghost session marcata abandoned dopo 15 min

**SE FALLISCE:**
- **Client 404 on /sessions**: Workflow n8n non attivo → task 008
- **Admin 401 on login**: Workflow auth non funziona → task 009
- **Socket.io non connette**: Routing Caddy mancante → task 005
- **Evento non ricevuto**: Room join mancante → verifica `socket.emit('join_session', id)`
- **DB non aggiorna**: SQL query errate → controlla n8n execution logs

**Tempo Stimato:** 45 min - 1 ora (include preparazione dati)

**Dipendenze:** TUTTI i task precedenti (004-018) devono essere DONE

**Riferimenti - CROSS CHECK:**
- **Scenario completo**: Piano FASE 4 § "Testing End-to-End"
- **User flows**: SPECS/03_Architettura_Funzionale.md § "Journey Cliente/Admin"

**Note & Log:**
