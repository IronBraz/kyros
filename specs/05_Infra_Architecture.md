# Kyros - Infrastructure & Backend Architecture

**Ambito:** backend, API, sicurezza, job in background.
**Supporta i flussi definiti in** `03_Architettura_Funzionale.md`.
**Aggiornato:** 2026-08-17, dopo la migrazione da n8n a Vercel.

> **Nota sulla storia.** Fino al 2026-08-16 questo documento descriveva un backend fatto di 32
> workflow n8n self-hosted, con Socket.io e Caddy dietro un Cloudflare Tunnel. Quella
> architettura non esiste più. È congelata al tag `v1.5.0-n8n-final` e al branch `legacy/n8n`,
> con l'export letterale dei workflow vivi in `n8n/live_export_2026-08-16/`. Il presente
> documento descrive solo ciò che gira adesso.

---

## 1. Stack tecnologico

| Pezzo | Cosa è | Dove sta |
| :--- | :--- | :--- |
| **Backend** | **una sola** funzione serverless che monta un'app Hono | `api/index.ts` + `server/` |
| **Database** | Neon serverless Postgres 18, regione `eu-central-1` | driver HTTP `@neondatabase/serverless` |
| **Frontend** | React 19 + TypeScript + Vite + Tailwind + Zustand | `pwa/` |
| **Hosting** | Vercel, team `brainforge1`, progetto `kyros`, piano Hobby, regione `fra1` | `vercel.json` |
| **Real-time** | **nessuno.** Polling HTTP dal client | — |
| **Dominio** | `kyros.neuroforge.club` (CNAME su Cloudflare, proxy **disattivato**) | — |

### Perché una funzione sola e non una per route
Il piano Hobby limita il numero di funzioni. Una sola funzione tiene caldo un unico bundle,
riduce i cold start e permette middleware veri (`adminGuard`) invece di copiare la stessa
validazione in cima a ogni file.

### Perché il driver HTTP e non `pg`
Ogni invocazione serverless è un processo nuovo. Un connection pool non verrebbe mai riusato e
finirebbe per esaurire le connessioni del database. Dove serve atomicità su più statement si usa
`sql.transaction([...])`.

### Perché niente CORS
La SPA e le API stanno sullo stesso host, quindi `API_BASE` resta `''` e non c'è nessuna
preflight da gestire. Le rewrite in `vercel.json` mandano `/api/*` alla funzione e tutto il
resto a `index.html`.

---

## 2. Contratto di risposta

Ogni risposta passa da `server/lib/respond.ts`, che eredita il formato del vecchio
`SUB_Response_Standardizer`.

**Successo (2xx):**
```json
{
  "success": true,
  "data": { },
  "meta": { "timestamp": "2026-08-17T10:00:00Z", "request_id": "uuid" }
}
```

**Errore (4xx/5xx):**
```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message", "data": { } },
  "meta": { "timestamp": "2026-08-17T10:00:00Z", "request_id": "uuid" }
}
```

Gli errori non gestiti sono intercettati da `app.onError` e non espongono mai lo stack trace.
Una route inesistente risponde 404 con `NOT_FOUND` e il messaggio `No route for <METODO> <path>`.

---

## 3. Regola che è facile sbagliare: niente `:id` nel path

**Non esiste un solo path parameter in tutta l'API.** L'id viaggia nel body (POST/PATCH/DELETE)
o nella query string (GET). È la forma che avevano i webhook n8n e che il frontend parla ancora.
Scrivere `POST /sessions/:id/abandon` a memoria produce un 404.

La lista qui sotto è quella reale; la fonte di verità è `server/routes/*.ts`.

---

## 4. Client API — prefisso `/api/v1/client`

Nessuna autenticazione. Il possesso del `session_id` è la credenziale.

| Metodo | Route | Cosa fa |
| :--- | :--- | :--- |
| POST | `/sessions` | Crea la sessione in coda. Valida lo slug dell'entry point, controlla `accepting_tickets`, genera il `ticket_code` |
| GET | `/sessions?session_id=` | Recupero sessione dopo un refresh di pagina |
| POST | `/sessions/heartbeat` | Keep-alive ogni 60s. `session_id` nel body |
| POST | `/sessions/abandon` | Il cliente lascia la coda. `session_id` nel body |
| GET | `/marketing-cards?store_id=` | Feed contenuti della sala d'attesa |
| POST | `/chat/start` | Apre o riprende la conversazione col concierge |
| POST | `/chat/send` | Un turno di conversazione |

### POST /sessions — coda chiusa
Se `stores.settings->'queue'->>'accepting_tickets'` è `false`, risponde **503**:
```json
{
  "success": false,
  "error": {
    "code": "QUEUE_CLOSED",
    "message": "We're not accepting new customers at the moment. Please speak to our staff.",
    "data": { "store_name": "Milano Centro", "custom_message": true }
  }
}
```

### GET /marketing-cards — nomi dei campi
Restituisce `icon` e `theme`, **non** `icon_name`/`theme_color` e **non** `iconName`/`themeColor`.
`pwa/src/components/shared/MarketingCard.tsx` fa lo spread della risposta e destruttura proprio
quei due nomi. I valori ammessi sono chiusi da quel componente:

- `icon`: `Gift` | `Coffee` | `Star` | `Info` — qualunque altra cosa disegna `Info`
- `theme`: `purple` | `orange` | `blue` | `green` — qualunque altra cosa disegna `blue`

---

## 5. Admin API — prefisso `/api/v1/admin`

Tutto tranne `auth/verify` e `auth/stores` sta dietro `adminGuard`, dichiarato **dopo** quelle
due di proposito.

| Metodo | Route | Cosa fa |
| :--- | :--- | :--- |
| GET | `/auth/stores` | Lista store per la schermata di login. **Pubblica** |
| POST | `/auth/verify` | Login col PIN, restituisce `session_token` |
| GET | `/queue/status` | Board completa: waiting, called, serving, conteggi, `accepting_tickets`, stima attesa |
| GET | `/queue/current` | Stato coda per il display del banco |
| POST | `/queue/call-next` | Chiamata FIFO con lock `FOR UPDATE SKIP LOCKED` |
| PATCH | `/sessions/status` | Avanza una sessione nel suo ciclo di vita |
| GET/PATCH | `/stores/settings` | Legge e aggiorna la configurazione dello store |
| GET/POST | `/entry-points` | Elenca e crea entry point |
| DELETE | `/entry-points/delete` | Cancella un entry point. Rifiuta se ha sessioni `waiting` o `called` |
| GET/POST/PATCH/DELETE | `/marketing-cards` | CRUD del feed contenuti |
| POST | `/wiki/reload` | Rilegge la wiki incorporata nel bundle |
| GET | `/usage` | Spesa AI del mese contro il tetto |

### Autenticazione: token HMAC, non JWT, non UUID
`server/lib/auth.ts`. Il token è:

```
base64url(payload) "." base64url(HMAC-SHA256(payload, KYROS_SESSION_SECRET))
```

con payload `{ aid, sid, tid, exp }` (admin id, store id, tenant id, scadenza unix).
Viaggia nell'header **`X-Admin-Session`**, non in `Authorization: Bearer`.

La validazione è **server-side**, non client-side come diceva la versione MVP di questo
documento: la firma non è falsificabile senza il segreto. Se `KYROS_SESSION_SECRET` manca, il
server rifiuta ogni sessione admin invece di lasciar passare tutti.

`KYROS_SESSION_SECRET` ha **un valore diverso per Production, Preview e Development**
(separati il 2026-08-17). Un token generato in locale non vale in produzione. Ruotarlo invalida
tutte le sessioni admin aperte: chi è dentro deve rifare il login col PIN.

### Il PIN
`admin_access.access_code_hash`, hash **scrypt** (`server/lib/pin.ts`). Il PIN in chiaro non
esiste da nessuna parte, né nel database né nel repo. Si imposta con `npm run db:seed` passando
`KYROS_SEED_ADMIN_PIN`, che accetta 4-6 cifre e rifiuta `1234` perché è pubblicato nella history
del repo.

### La regola che chiude le IDOR
**`store_id` arriva sempre dal token di sessione, mai dalla query string o dal body**, anche se
il frontend continua a mandarlo. Chiedere la board di un altro store restituisce la propria.

---

## 6. Job in background

### Janitor
`server/lib/janitor.ts`, non più un workflow n8n. Fa due cose:

```sql
-- ghost: waiting senza heartbeat da queue.ghost_timeout_minutes (default 30)
UPDATE sessions SET status = 'abandoned', finished_at = NOW()
 WHERE status = 'waiting' AND last_seen_at < NOW() - INTERVAL '<ghost> minutes';

-- missed: chiamati e mai serviti da queue.called_timeout_minutes (default 5)
UPDATE sessions SET status = 'missed', missed_at = NOW()
 WHERE status = 'called' AND called_at < NOW() - INTERVAL '<called> minutes';
```

**Gira pigro, agganciato alle richieste vere** tramite `waitUntil()`, dietro un lock atomico
sulla tabella `job_runs`. Motivo: i cron del piano Hobby scattano una volta al giorno, il che
per una coda è inutile. Il cron notturno resta come rete di sicurezza per quando il negozio è
chiuso e nessuno genera richieste.

### Cron notturno — `GET /api/internal/cron/daily`, 02:00 UTC
Dichiarato in `vercel.json`. Fa tre cose: sweep completo senza throttle, reset delle
`ticket_sequences` di ogni store la cui data locale è avanzata, pulizia dei bucket scaduti del
rate limiter.

**Le route `/api/internal/*` non sono raggiungibili da un browser.** Richiedono
`Authorization: Bearer $CRON_SECRET`, confrontato in tempo costante; `CRON_SECRET` lo inietta
Vercel da solo. Se manca, l'endpoint resta chiuso invece di aprirsi a tutti. È la differenza
con l'era n8n, dove `internal/ai/summarize` era un webhook pubblico che chiunque poteva chiamare
per bruciare il budget AI.

### Reset giornaliero dei ticket
Succede in due punti indipendenti, ed è voluto: la funzione SQL `generate_ticket_code()` azzera
la sequenza da sola alla prima emissione del giorno (`last_reset_date < store_today()`), e il
cron notturno la azzera comunque per gli store che non hanno emesso nulla.

**Mai `CURRENT_DATE`.** Neon gira in UTC e ogni store ha il suo fuso. Qualunque cosa significhi
"oggi" passa da `store_today(store_id)`.

---

## 7. Real-time: non c'è

Il client fa **polling HTTP**. Non esiste Socket.io in questo repo e non è mai esistito:
`SUB_Socket_Emitter` era prosa nelle specifiche, mai codice funzionante. Gli eventi
`TICKET_CALLED`, `QUEUE_UPDATE` e `ADMIN_DING` descritti nella vecchia versione di questo
documento non sono mai stati implementati. Il client scopre di essere stato chiamato al giro di
polling successivo.

---

## 8. Sicurezza applicativa

- **SQL**: sempre template taggati, che parametrizzano. **Mai** concatenazione di stringhe.
- **Rate limit**: `server/lib/ratelimit.ts`. L'IP non viene salvato in chiaro, ma come HMAC
  troncato a 16 caratteri.
- **Segreti**: nessun segreto nel repo. Tutto in variabili d'ambiente Vercel, separate per
  ambiente. `.env.local` è in `.gitignore` e si ricrea con `npx vercel env pull .env.local`.
- **Deployment Protection**: `ssoProtection: all_except_custom_domains`. Il dominio pubblico è
  aperto, le preview no. Gli script automatici passano dal Protection Bypass, che è una
  variabile **di sistema** Vercel e non compare in `vercel env pull`.
