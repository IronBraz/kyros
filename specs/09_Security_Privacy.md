# Kyros - Security & Privacy (Fase 1)

**Ambito:** Protezione dati, Accessi e Anti-abuse.

---

## 1. Sicurezza dei Dati (GDPR)
Kyros è progettato per essere **Privacy by Design**:
*   **Anonimato**: Non vengono richiesti nomi, email o numeri di telefono.
*   **Identificazione**: Avviene tramite `session_id` (UUIDv7) memorizzato temporaneamente nel browser del cliente.
*   **Data Minimization**: Solo i metadati del dispositivo (browser/OS) vengono salvati per scopi analitici e tecnici.

---

## 2. Authentication Model (Admin)
L'accesso alla Control Room è protetto da un meccanismo "Gate Code" semplificato per l'MVP:
*   **Metodo**: PIN alfanumerico (memorizzato in chiaro su DB `admin_access`).
*   **Sessione**: Token UUID salvato in `localStorage`.
*   **Validazione**: Client-side check per MVP (Server-side in Scale-up).
*   **Sicurezza**: Non adatto a dati sensibili PII (che infatti non trattiamo), ma sufficiente per proteggere l'operatività della coda.

---

## 3. Strategia Anti-Abuse

### Rate Limiting
Per prevenire lo spam di creazione ticket tramite QR code:
*   **Create Session**: Max 3 ticket ogni 10 minuti per IP.
*   **Admin API**: Protetto da rate limit più permissivo ma monitorato.

### Configurazione Infrastrutturale (Caddy)
```caddyfile
# Esempio configurazione Rate Limit in Caddy
@create_session {
    method POST
    path /api/v1/client/sessions
}
rate_limit @create_session {
    zone session_create {
        key {remote_host}
        events 3
        window 10m
    }
}
```

---

## 4. CORS Configuration
Il frontend e il backend comunicano sotto lo stesso dominio o domini autorizzati:
*   `Access-Control-Allow-Origin`: `https://your-domain.example.com`
*   `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS`

---

## 5. Ambiente & Segreti (.env)
Variabili critiche da configurare:
*   `KYROS_JWT_SECRET`: Per la firma dei token socket.
*   `INTERNAL_SOCKET_SECRET`: Per la comunicazione sicura tra n8n e socket-server.
*   `POSTGRES_PASSWORD`: Password del database.