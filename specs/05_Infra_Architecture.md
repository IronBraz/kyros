# Kyros - Infrastructure & Backend Architecture (Fase 1)

**Ambito:** Workflow n8n, Integrazioni, Sicurezza e Deployment.
**Riferimenti:** Supporta i flussi definiti in `03_Architettura_Funzionale.md`.

---

## 1. Stack Tecnologico
*   **Engine Backend**: n8n (Self-hosted su Docker).
*   **Database**: PostgreSQL 18.1.
*   **Real-time**: Socket.io Server (Node.js ultra-light).
*   **Proxy/Edge**: Caddy (HTTPS, Reverse Proxy, Static Assets).
*   **Infrastruttura**: Stack "NeuroForge" (Docker Compose su VPS Linux).

---

## 2. API Design & Workflow Strategy

### A. Core Sub-Workflows (n8n)
Per mantenere pulita l'architettura, ogni azione complessa è delegata a sub-workflow riutilizzabili:
1.  **`SUB_Auth_Manager`**: Gestisce i token JWT per le sessioni Admin.
2.  **`SUB_Socket_Emitter`**: Invia eventi al Socket Server (Ding-Dong, New Ticket, etc.).
3.  **`SUB_Response_Standardizer`**: (Interface Contract) Formatta uniformemente la risposta HTTP finale.

#### Schema Response SUCCESS (2xx):
```json
{
  "success": true,
  "data": { ... },
  "meta": { 
    "timestamp": "2025-12-22T10:00:00Z",
    "request_id": "uuid"
  }
}
```

#### Schema Response ERROR (4xx/5xx):
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  },
  "meta": { 
    "timestamp": "2025-12-22T10:00:00Z",
    "request_id": "uuid"
  }
}
```

---

### B. Public API (Client PWA) - Prefix: `/api/v1/client`

#### 1. POST /api/v1/client/sessions
*   **Trigger**: Scansione QR code da cliente.
*   **Logic**:
    1.  Validate Entry Point (slug exists).
    1.5 **Check store accepting**: Query `stores.settings->'queue'->>'accepting_tickets'`
        - Se `false`: Return `503 QUEUE_CLOSED` con messaggio personalizzato
    2.  Check device fingerprint (anti-spam).
    3.  DB Insert con `ticket_code = generate_ticket_code(store_id)`.
    4.  Calcola stima attesa: `(COUNT waiting * avg_service_time)`.
*   **Response 503** (Queue Closed):
    ```json
    {
      "success": false,
      "error": {
        "code": "QUEUE_CLOSED",
        "message": "We're not accepting new customers at the moment. Please speak to our staff.",
        "data": {
          "store_name": "Milano Centro",
          "custom_message": true
        }
      }
    }
    ```

#### 2. GET /api/v1/client/sessions/:id
*   **Trigger**: Ricarica pagina o riconnessione.
*   **Response**: Status corrente, ticket_code, posizione, stima attesa.

#### 3. POST /api/v1/client/sessions/:id/heartbeat
*   **Trigger**: Timer client ogni 60 secondi.
*   **Logic**: `UPDATE sessions SET last_seen_at = NOW() WHERE id = $1`.

#### 4. POST /api/v1/client/sessions/:id/abandon
*   **Trigger**: Cliente clicca "Abbandona Coda".
*   **Logic**: `UPDATE sessions SET status = 'abandoned', finished_at = NOW()`.

---

### C. Control Room API (Admin) - Prefix: `/api/v1/admin`

#### 0. POST /api/v1/admin/auth/verify
*   **Purpose**: Verifica PIN e crea sessione admin.
*   **Input Body**: 
    ```json
    { 
      "store_id": "uuid",
      "access_code": "1234"
    }
    ```
*   **Logic**:
    1.  Query: `SELECT * FROM admin_access WHERE store_id = $1 AND access_code = $2 AND is_active = true`
    2.  Se trovato: Update `last_used_at = NOW()`
    3.  Genera session token (semplice UUID, non JWT)
*   **Response 200** (Success):
    ```json
    {
      "success": true,
      "data": {
        "session_token": "uuid-sessione",
        "store_name": "Milano Centro",
        "expires_at": "2025-12-23T18:00:00Z",
        "label": "Codice Cassa"
      }
    }
    ```
*   **Response 401** (Invalid):
    ```json
    {
      "success": false,
      "error": {
        "code": "INVALID_ACCESS_CODE",
        "message": "Codice non valido"
      }
    }
    ```
*   **Response 404** (Store not found):
    ```json
    {
      "success": false,
      "error": {
        "code": "STORE_NOT_FOUND",
        "message": "Store non trovato"
      }
    }
    ```

#### 0.1 POST /api/v1/admin/auth/logout
*   **Purpose**: Invalida sessione (client-side, no server state).
*   **Logic**: Il client cancella localStorage. Server-side è stateless.
*   **Response 200**: `{ "success": true }`

#### 0.2 GET /api/v1/admin/auth/stores
*   **Purpose**: Lista stores disponibili per login (senza auth).
*   **Response 200**:
    ```json
    {
      "success": true,
      "data": {
        "stores": [
          { "id": "uuid", "name": "Milano Centro" },
          { "id": "uuid", "name": "Roma Termini" }
        ]
      }
    }
    ```
*   **Note**: Questo endpoint è pubblico per permettere la selezione store prima del PIN.

> **Autenticazione Control Room:**
> Tutti gli endpoint `/api/v1/admin/*` (eccetto `/auth/*`) richiedono header:
> ```
> X-Admin-Session: <session_token>
> ```
> Il token è validato controllando che esista in localStorage e non sia scaduto (8h).
> In MVP la validazione è client-side. In SCALE-UP sarà server-side con Redis.

#### 1. GET /api/v1/admin/health
*   **Purpose**: Health check per monitoring.

#### 2. GET /api/v1/admin/init
*   **Purpose**: Zero State Check per wizard primo avvio.

#### 3. POST /api/v1/admin/queue/call-next
*   **Logic**: 
    1. Lock FIFO (`FOR UPDATE SKIP LOCKED`).
    2. Update status a `called`.
    3. Notifica Socket.

#### 4. GET /api/v1/admin/queue/current
*   **Purpose**: Lista coda attuale (waiting + called) per display Counter.

#### 5. PATCH /api/v1/admin/stores/:id/settings
*   **Purpose**: Aggiorna configurazione store (incluso toggle ON/OFF).
*   **Input Body** (partial update):
    ```json
    {
      "queue": {
        "accepting_tickets": false,
        "closed_message": "Custom closure message"
      }
    }
    ```
*   **Logic**: 
    1.  Merge JSONB con `jsonb_set()`
    2.  Se `accepting_tickets` cambia: log evento per audit
*   **Response 200**: `{ "success": true, "data": { "settings": {...} } }`

#### 6. GET /api/v1/admin/stores/:id/queue/status
*   **Purpose**: Stato rapido della coda per header/widget.
*   **Response 200**:
    ```json
    {
      "success": true,
      "data": {
        "accepting_tickets": true,
        "waiting_count": 5,
        "called_count": 1,
        "avg_wait_minutes": 8,
        "system_status": "active"
      }
    }
    ```
*   **Note**: `system_status` può essere: `active`, `paused` (toggle off ma coda da smaltire), `closed` (toggle off e coda vuota)

---

### D. Background Jobs (n8n Scheduled Workflows)

#### 1. JOB_Janitor (Queue Cleanup)
*   **Trigger**: Ogni 5 minuti.
*   **Logic**:
    ```sql
    -- Step 1: Marca 'abandoned' i ticket waiting senza heartbeat da 15 min
    UPDATE sessions SET status = 'abandoned', finished_at = NOW()
    WHERE status = 'waiting' AND last_seen_at < NOW() - INTERVAL '15 minutes';
    
    -- Step 2: Marca 'missed' i ticket chiamati ma non serviti da 5 min
    UPDATE sessions SET status = 'missed', missed_at = NOW()
    WHERE status = 'called' AND called_at < NOW() - INTERVAL '5 minutes';
    ```

#### 2. JOB_Daily_Reset (Ticket Sequence)
*   **Trigger**: Ogni giorno alle 00:05.
*   **Purpose**: Forza reset sequence ticket.

---

## 3. Real-time Bridge (Socket.io)
Il server Socket.io riceve comandi da n8n (via secret key interna) e li propaga ai client:
*   `TICKET_CALLED`: Il client specifico riceve la notifica "È il tuo turno".
*   `QUEUE_UPDATE`: Tutti i client nello store ricevono la nuova posizione.
*   `ADMIN_DING`: Il display di sala emette il suono e mostra il numero.