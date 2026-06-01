# Demo Hardening Plan

**Data:** 2026-06-01
**Scope:** rendere Kyros **solido per dimostrazioni live** con più utenti contemporanei. **NON è un piano production-grade.**
**Vincoli:** evitare over-engineering. Nessun CI/CD, nessuna riscrittura auth, nessuna nuova feature.

---

## 1. Ipotesi sul contesto demo

Verificare con l'utente prima di partire (se uno di questi salta, ricalcola il piano):

- D-A. La demo gira su **una sola macchina** (Local PC + Cloudflare Tunnel), un solo tenant, un solo store. → multi-tenant isolation non è una priorità.
- D-B. Gli utenti che si connettono sono **conoscenti/clienti invitati**, non internet pubblico. → no rate-limit, no brute-force PIN, no enumeration attack.
- D-C. La demo dura **al massimo qualche ora**, non 8h+. → token expiry non è un problema reale.
- D-D. Il DB viene **resettato/seedato prima della demo**, non è un sistema vivo da preservare. → schema deve essere applicabile da zero senza intoppi.
- D-E. Possiamo avere **2-3 casse + 10-20 client** contemporanei come picco realistico. → questo è il vero test.

---

## 2. Cosa è già OK (verificato 2026-06-01)

Da non toccare, sono fonti di FUD eliminate:

- ✅ **Multi-cassa concorrente**: `014_API_Admin_CallNext.json:68` usa `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1)`. Due casse non possono prendere lo stesso ticket.
- ✅ **Ticket code univoco**: `generate_ticket_code()` in `kyros_schema.sql:129` usa `INSERT … ON CONFLICT DO UPDATE … RETURNING`, atomico. Più `CreateSession` paralleli non collidono.
- ✅ **`ai_conversation_id`**: la colonna esiste via `database/migrations/2026_05_pilot_ai.sql`. Runtime ok. Problema solo se si applica solo `kyros_schema.sql` senza migration (vedi P0-1).

---

## 3. Da fixare — P0 (bloccanti per demo multi-user)

### P0-1. Schema consolidato applicabile da zero
**Problema:** `database/kyros_schema.sql` è dichiarato "source of truth" in CLAUDE.md, ma le tabelle AI (`ai_conversations`, `ai_messages`, `ai_summaries`) e la colonna `sessions.ai_conversation_id` vivono solo in `database/migrations/2026_05_pilot_ai.sql`. Se prima della demo resetti il DB e applichi solo lo schema base, la chat AI si rompe e `CallNext` esegue query su colonna inesistente.
**Fix scelto (deciso 2026-06-01):** **Opzione A** — incorporare il contenuto di `database/migrations/2026_05_pilot_ai.sql` dentro `database/kyros_schema.sql` come sezione "5D. AI TABLES (Pilot Phase)". Mantenere il file migration sul disco come reference storica ma con una nota in testa: "Già incorporata in kyros_schema.sql dal 2026-06-01 — non riapplicare su DB fresco". Adeguare `scripts/manage_kyros_db.ps1` se esiste e fa riferimento separato a migration.

**Verifica:** drop DB, applica solo `kyros_schema.sql`, esegui smoke test (creare sessione, avviare chat AI, call-next). Tutto deve funzionare senza toccare la cartella `migrations/`.

### P0-2. Race condition WaitingRoom (frontend)
**Problema:** `pwa/src/.../WaitingRoom.tsx:107-111` ha 3 `useEffect` indipendenti (heartbeat 30s, polling status 3s, marketing cards) senza coordinamento. Con 10-20 client e server lento, i poll si sovrappongono → la UI sfarfalla, position aggiornata fuori ordine, occasionalmente redirect lampeggiante.
**Fix minimo:**
- Sostituire i poll con un singolo orchestrator che usa `setTimeout` ricorsivo (no `setInterval`) e attende la fine della richiesta precedente prima di schedulare la successiva.
- Aggiungere `AbortController` per cancellare fetch in volo su unmount o cambio sessione.
- Rimuovere gli `eslint-disable react-hooks/exhaustive-deps` solo dopo aver verificato cosa nascondevano.

**Verifica:** aprire 10 tab in parallelo su `/waiting`, throttlare la rete a "Slow 3G" in DevTools, osservare che non ci sono richieste in coda né flicker.

### P0-3. Race condition janitor vs heartbeat
**Problema:** `018_JOB_Janitor.json` marca `abandoned` ogni 5min le sessioni con `last_seen_at < NOW() - 15min`. In una demo da 30+ minuti, una sessione viva può essere uccisa se l'heartbeat client salta brevemente (tab in background, rete instabile).
**Fix minimo:**
- Rendere il janitor un singolo `UPDATE` atomico con `WHERE last_seen_at < NOW() - INTERVAL '15 minutes' AND status='waiting'` (probabilmente già così — da verificare). Nessuna `SELECT` + loop esterno.
- Aumentare la soglia janitor da 15min a 30min per la demo (`stores.settings.queue.ghost_timeout_minutes` se esiste, oppure direttamente nel workflow). Costo: sessioni morte restano un po' di più, ma demo non si auto-distrugge.
- Sul client: usare Page Visibility API per inviare un heartbeat appena la tab torna in foreground.

**Verifica:** apri 5 client, metti 2 in background per 20min, conferma che tornano "vivi" e non finiscono "abandoned".

### P0-4. PIN error UX (admin login)
**Problema:** `LoginGate.tsx:38-42` — `handleDigit()` non cancella `error` prima di accettare un nuovo digit. Dopo un PIN sbagliato, l'utente vede l'errore mentre sta già digitando il nuovo PIN. Cosmetico ma demo-bloccante (l'admin manager sembra rotto).
**Fix minimo:** in `handleDigit`, `setError(null)` come prima riga.

**Verifica:** sbaglia PIN, ricomincia a digitare, errore deve sparire al primo digit.

### P0-5. Memory leak / fetch pendenti ChatPanel
**Problema:** `ChatPanel.tsx:55` ha `useEffect(() => () => abortPending(), [])` con `eslint-disable`, ma non c'è timeout sui fetch e il cleanup è solo a unmount, non a chiusura modal.
**Fix minimo:**
- Aggiungere timeout di 15s su ogni fetch chat (chat AI può essere lenta, ma 15s è oltre l'umano).
- `abortPending()` anche quando il modal viene chiuso (`onClose`), non solo su unmount.

**Verifica:** apri/chiudi chat 20 volte rapidamente, osserva DevTools Network — nessuna richiesta deve restare "pending" dopo chiusura.

---

## 4. Da fixare — P1 (qualità demo, non bloccanti ma fastidiosi)

### P1-1. Empty/error states audit
Schermate da verificare prima della demo (ogni una deve mostrare un messaggio sensato, non spinner infiniti né crash):
- WaitingRoom: rete persa, sessione scaduta, queue chiusa mentre in attesa.
- ControlRoom: nessun cliente in coda, backend offline, PIN scaduto.
- ChatPanel: AI provider down, timeout, conversazione persa.
- LandingPage: entry_point invalido (QR vecchio).

Per ognuna: se il fallback è già OK lascia, altrimenti aggiungi un componente `<EmptyState message="..." action="..."/>` già presente nel design system.

### P1-2. ESLint disable cleanup
`WaitingRoom.tsx:31` e `ChatPanel.tsx:52` hanno `// eslint-disable-line react-hooks/exhaustive-deps`. Rimuoverli e capire cosa nascondono. Spesso sono bug latenti che si manifestano sotto load.

### P1-3. Lock Node version
Aggiungere `.nvmrc` (`20`) in root e `engines: { "node": ">=20" }` in `pwa/package.json`. Costa 1 minuto, evita disastri se la macchina demo ha Node sbagliato.

### P1-4. Pre-demo snapshot script
Uno script PowerShell che fa:
1. `pg_dump kyros_db > backups/pre_demo_$(date).sql`
2. Export workflow n8n via MCP / API → `n8n/backup/`

Da lanciare 30 min prima della demo per rollback rapido.

---

## 5. Da NON fixare per la demo (giustificazione esplicita)

| Issue audit | Perché lo skippiamo |
|---|---|
| C1 SQL injection in `003_setup_tenant*` | L'endpoint setup tenant non viene chiamato durante demo. Tenant già seedato. |
| C2 PIN in plaintext | DB non esposto a internet, demo controllata. |
| C3 JWT firmato | Token non firmato basta per demo da poche ore. |
| C4 Multi-tenant isolation marketing cards | Un solo tenant in demo. |
| A3 Rate limiting | Pubblico invitato, no abuse vector. |
| A4 Session ID enumeration | Demo non esposta a curiosi anonimi. |
| A5 Token in localStorage HttpOnly | Demo non è target XSS. Le 8h di expiry bastano. |
| A6 Socket.io frontend | Polling 3s è OK per demo. Sostituirlo è lavoro grosso. |
| M2 CORS headers | Dominio singolo via Caddy, no cross-origin. |
| M3 CSRF token | Demo controllata, attaccante esterno improbabile. |
| M4 Focus trap modal a11y | Demo visiva, niente screen reader. |
| M5 Contrast WCAG | Cosmetico, non bloccante. |
| I1 CI/CD | Demo single-shot, deploy manuale OK. |
| I2 Branch protection | Solo dev. |

**Se uno di questi cambia status** (es. demo diventa public-facing), riaprire il punto.

---

## 6. Smoke test multi-utente end-to-end

Da eseguire DOPO i fix P0, PRIMA della demo:

1. **Concorrenza queue** (verifica `FOR UPDATE SKIP LOCKED`):
   - 2 admin loggati su 2 casse diverse.
   - 5 client creano sessione contemporaneamente (`/api/v1/client/sessions` × 5 paralleli, es. `Invoke-WebRequest` in loop PowerShell).
   - Le 2 casse premono "call next" contemporaneamente più volte.
   - Atteso: ogni ticket assegnato a una sola cassa, nessun duplicato, ordine FIFO rispettato.

2. **Heartbeat sotto carico**:
   - 15 client in `/waiting`.
   - Throttle rete a Slow 3G su 5 di loro.
   - Atteso: tutti restano `waiting`, nessuno passa a `abandoned` finché la rete è OK.

3. **Chat AI parallelo**:
   - 5 client aprono ChatPanel insieme, mandano 3 messaggi ciascuno.
   - Atteso: ogni conversazione resta isolata (verifica via DB: `ai_messages.conversation_id` corretto per ognuno).

4. **Recupero sessione**:
   - Client refresh durante `waiting`, `called`, `serving`.
   - Atteso: state ricostruito da `kyros_session` localStorage, no crash, no redirect inatteso.

5. **Reset demo** (a fine sessione):
   - Eseguire pre-demo script con flag `--reset` per ripulire `sessions`, `ai_conversations`, `ai_messages`, `ai_summaries`. Mantenere `tenants`, `stores`, `entry_points`, `service_points`, `admin_access`, `marketing_cards`.

---

## 7. Ordine di esecuzione consigliato (per Sonnet)

Sessione 1 (DB + backend):
1. P0-1 Schema consolidato (~30 min, n8n MCP non serve, solo edit SQL)
2. P0-3 Janitor race (n8n MCP per update workflow `018_JOB_Janitor`)

Sessione 2 (frontend):
3. P0-2 Race WaitingRoom (un solo file, ~1h)
4. P0-4 PIN error UX (1 riga)
5. P0-5 ChatPanel memory leak (~30 min)

Sessione 3 (quality + smoke test):
6. P1-1 Empty states audit
7. P1-2 ESLint cleanup
8. P1-3 .nvmrc + engines
9. P1-4 Pre-demo snapshot script
10. Smoke test § 6

Stima totale: **4-6 ore di lavoro Sonnet**, distribuibili in 2-3 sessioni separate.

---

## 8. File chiave coinvolti (per orientare Sonnet)

**Backend / DB:**
- `database/kyros_schema.sql` (P0-1)
- `database/migrations/2026_05_pilot_ai.sql` (merge in schema base)
- `n8n/018_JOB_Janitor.json` (P0-3)
- `scripts/manage_kyros_db.ps1` se esistente (P0-1 + P1-4)

**Frontend:**
- `pwa/src/.../WaitingRoom.tsx` (P0-2, P1-2)
- `pwa/src/.../ChatPanel.tsx` (P0-5, P1-2)
- `pwa/src/.../LoginGate.tsx` (P0-4)
- `pwa/src/.../ControlRoom.tsx`, `LandingPage.tsx` (P1-1)
- `pwa/package.json` + new `.nvmrc` (P1-3)

**Riferimenti audit completo:**
- `~/.claude/plans/leggi-il-grafo-e-declarative-peacock.md` (analisi originale 2026-06-01)
