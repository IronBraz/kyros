# CHANGELOG - Kyros Project

Questo file tiene traccia di tutte le modifiche rilevanti apportate al progetto, seguendo il principio di "Automated Documentation" del sistema PSB.

## Istruzioni per il popolamento (Regole d'oro):
1. **Aggiornamento Atomico:** Ogni volta che un task passa da `2_IN_PROGRESS` a `4_DONE`, deve essere aggiunta un'entrata in questo file.
2. **Formato:** Utilizzare il formato `[AAAA-MM-DD] - [Ambito] - Descrizione breve`.
3. **Livello di Dettaglio:** Non elencare ogni singola riga di codice, ma le pietre miliari (es. "Creato schema DB", "Implementato Onboarding PWA", "Configurato Tunnel Cloudflare").
4. **Tracciabilità:** Se possibile, citare il file del task in `PROJECT_BOARD` che è stato completato.

---

## Storico Modifiche

### [2025-12-21] - [METODO]
- **Analisi PSB & Ottimizzazione Memoria:** Analizzato il file `ClaudeCodeTips_2025-12-21` e integrate le best practice nel workflow Kyros.
- **Creazione CHANGELOG:** Inizializzato il registro delle modifiche per separare lo storico dal contesto operativo.
- **Aggiornamento GEMINI.md:** Aggiunta sezione "Anti-Patterns & Lessons Learned" per prevenire regressioni comportamentali dell'AI.

## [1.1.0] - 2025-12-22
### Added
- Integrazione completa dei fix di Claude (`PRD_KYROS_FIXES_v1.md`).
- Supporto a Postgres 18.1 con UUIDv7 nativo.
- Logica di generazione automatica `ticket_code` (`A-001`, etc.) via trigger/function SQL.
- Sistema di Heartbeat e Janitor Job per la pulizia delle sessioni fantasma.
- Definizione degli Standard Response per le API (Success/Error).
- Requisiti di Accessibilità (WCAG 2.1 AA) e gestione Empty States.

### Changed
- Uniformati gli endpoint API sotto il prefisso `/api/v1/client` e `/api/v1/admin`.
- Aggiornato lo stack tecnologico: React + Vite + Zustand + Tailwind CSS.
- Ottimizzati gli indici SQL (Partial Indexes e GIN per JSONB).

### Fixed
- Risolta l'incoerenza tra Heartbeat e schema database.
- Risolta la mancanza di tracciamento per i codici ticket visualizzati nella UI.

## [1.2.0] - 2026-01-07
### Added
- **Workflow API_Admin_MarketingCards** (`unPXNJKrTdXC8iWa`): CRUD completo per marketing cards (GET/POST/PATCH/DELETE).
- **Workflow API_Admin_UpdateSessionStatus** (`rO0comGnekVnZOEb`): Endpoint PATCH per Mark Served/Missed.
- **Workflow API_Client_MarketingCards** (`rAqQZikfzpBuNDr8`): Endpoint GET per client-side marketing cards.
- Frontend BACK: ContentMode.tsx con editor cards, preview live, e CRUD handlers.
- Frontend BACK: Integrazione API reali per marketing cards in App.tsx.

### Changed
- **CallNext workflow** (`LW27CrId1WjLwiDl`): Aggiunto auto-assign di `service_point_id` e `typeValidation: "loose"`.
- **GetSession workflow** (`1EEMBmIUQlpcGrHL`): Aggiunto LEFT JOIN per `service_point_name`.
- Frontend FRONT: WaitingRoom.tsx ora usa API reale `getSession` con polling ogni 3 secondi.
- Frontend FRONT: LandingPage.tsx migrato da `mockApi` a `createSession` API reale.

### Fixed
- **MarketingCards SQL**: Corretto `display_order` → `priority` (colonna corretta nello schema).
- **UpdateSessionStatus SQL**: Rimosso riferimento a `updated_at` (non esiste in tabella `sessions`).
- **DeleteEntryPoint**: Corretto endpoint da POST a DELETE method.
- **Leave Queue auto-rejoin**: Spostato controllo flag `kyros_just_left` nell'useEffect prima di `joinQueue()` per evitare race condition con re-render React.
- **Mark Served**: Verificato funzionamento corretto del workflow UpdateSessionStatus (SQL fix applicato).
- **Client polling**: Deployata nuova build FRONT con polling attivo per navigazione a "Your Turn".

## [1.3.0] - 2026-05-22 - Pilot Phase (AI Chat Concierge)
### Added
- **Repo bootstrap (2026-05-15)**: Initial commit codebase Kyros MVP Phase 1 + `_local/` gitignored + `.env` root-level esternalizzato per config per-macchina.
- **Pilot F1 — n8n chat backend (2026-05-21)**: Workflow `API_Client_Chat_Start` (`025`) e relative API conversazionali via OpenRouter (modello LLM esterno).
- **Pilot F2 — DB AI tables (2026-05-21)**: migrazione `database/migrations/2026_05_pilot_ai.sql` con tabelle `ai_conversations`, `ai_messages`, `ai_summaries` e colonna `sessions.ai_conversation_id UNIQUE` (link bidirezionale 1:1).
- **Pilot F3-F8 — frontend AI (2026-05-22)**: AI Chat Concierge nel client (`ChatPanel.tsx`) + Admin Summary UI nella Control Room con summary/sentiment via async job.
- **docker-compose override (2026-05-22)**: file `docker-compose.override.yml` per personalizzazioni locali senza toccare la base NeuroForge.

### Changed
- **CallNext workflow** (`014`): aggiunta query `ai_conversation_id` per trigger del Summarize asincrono al call-next.
- Rimossi riferimenti legacy a `GEMINI_API_KEY` in favore di OpenRouter come provider LLM.

### Fixed
- **Concierge button & history panel**: polish UI dopo feedback pilot.
- **Race condition chat**: gestione fetch pendenti su unmount tramite `AbortController`.
- **Summary CSV bug**: corretto export CSV summary admin (ref. commit `9f2a694`).

---

## [Unreleased] — review di sicurezza/architettura (2026-06-01)
- Audit cross-cutting completato: identificati 4 critici di sicurezza (SQL injection in `003_setup_tenant*`, PIN in plaintext, token admin non firmato, multi-tenant isolation gap su marketing cards) e ~15 issue medi (race janitor/heartbeat, Socket.io non implementato lato client, schema desync `kyros_schema.sql` vs migration AI, no CI/CD, branch protection assente).
- Vedi `~/.claude/plans/leggi-il-grafo-e-declarative-peacock.md` per il dettaglio completo e l'ordine di triage proposto.

## [1.4.0] - 2026-06-01 — Demo Hardening (P0)
### Fixed
- **P0-1 Schema consolidato:** Tabelle AI (`ai_conversations`, `ai_messages`, `ai_summaries`, `ai_usage_monthly`) e colonna `sessions.ai_conversation_id` incorporate in `database/kyros_schema.sql` (sezione 5D). File migration `2026_05_pilot_ai.sql` marcato come reference storica. Drop DB + applica solo `kyros_schema.sql` è ora sufficiente.
- **P0-2 WaitingRoom race condition:** Sostituito `setInterval` con `setTimeout` ricorsivo in `WaitingRoom.tsx`; il prossimo poll parte solo dopo che il precedente è completato. Aggiunto Page Visibility API: heartbeat immediato quando la tab torna in foreground. Rimossi `eslint-disable` con ref pattern corretto.
- **P0-3 Janitor soglia:** Aumentato timeout ghost session da 15 a 30 minuti in `018_JOB_Janitor.json` per evitare che sessioni vive vengano uccise durante demo prolungate.
- **P0-4 PIN error UX:** `setError(false)` spostato come prima riga incondizionale di `handleDigit` in `LoginGate.tsx`. Errore scompare al primo digit, non al completamento.
- **P0-5 ChatPanel memory leak:** `abortPending()` chiamato anche su chiusura del panel (non solo su unmount). Aggiunto timeout 15s su ogni fetch AI in `handleSend`. Rimossi `eslint-disable` con ref guard (`handoverShownRef`) e deps corrette.
### Added
- **P1-3 Node version lock:** `.nvmrc` con Node 20 in root; `engines: { "node": ">=20" }` in `pwa/package.json`.
- **P1-4 Pre-demo snapshot script:** `scripts/pre_demo.ps1` — backup DB con `pg_dump`, export n8n workflows via REST API, flag `-Reset` per pulizia sessioni/AI data prima della demo.
- **Smoke test script:** `scripts/smoke_test.ps1` — testa concorrenza (5 session parallele, uniqueness ticket, FIFO positions, dual call-next race), session recovery GET, e stampa checklist per i test manuali (heartbeat sotto carico, chat AI parallela).
### Fixed
- **P1-1 Empty states audit:** WaitingRoom: banner amber "Connection lost — retrying…" quando il poll fallisce (rete persa o risposta non-success). ControlRoom: banner rosso "Backend offline — queue updates paused" quando `loadQueueStatus` lancia eccezione; redirect a `/control-room/login` se session localStorage mancante o `expires_at` scaduto.
- **P1-2 ESLint cleanup:** Rimosso l'ultimo `eslint-disable` in `AIUsageCard.tsx` convertendo `fetchUsage` a `useCallback`. Zero `eslint-disable` rimasti nei file TSX.

## [1.5.0] - 2026-08-16 — Ultima release con backend n8n

**Questa è l'ultima versione funzionante di Kyros con il backend su n8n.** Da qui in poi il
backend passa a **TypeScript serverless su Vercel** (una singola funzione Hono) con database
**Neon Postgres**. Lo stack Docker NeuroForge non è più il runtime di Kyros.

Il punto di ripristino è il tag `v1.5.0-n8n-final` e il branch `legacy/n8n`.

### Added
- **`n8n/live_export_2026-08-16/`**: export verbatim dei 35 workflow Kyros presi
  dall'istanza viva prima del taglio. Diventa la fonte storica di verità per il backend n8n,
  al posto dei file numerati in `n8n/*.json`.

### Fixed (igiene, audit di sicurezza pre-migrazione)
- **`knowledge/internal/` non è più tracciato** (`.gitignore` + `git rm --cached`). Contiene
  prezzi, margini e note staff: cartella progettata per dati interni, su un repo pubblico.
  I file restano sul disco locale. Nessun codice la legge (la chat AI carica solo
  `knowledge/public/`, vedi `specs/07_AI_Engine.md`).
- **PIN demo `1234` rimosso dai file tracciati**: `scripts/smoke_test.ps1`,
  `project-board/_archive_mvp_phase1/019_test_end_to_end.md`,
  `project-board/4_DONE/002_onboarding_setup.md`, `specs/05_Infra_Architecture.md`,
  `specs/10_Deployment_Operations.md`. Sostituito con placeholder.

### Known issues — non risolti in questa release, per progetto
Sono i motivi per cui si migra. Chi ripristina questo tag li eredita:
1. **Nessuna autenticazione server-side.** Ogni webhook n8n è `authentication: none` e
   `SUB_Auth_Manager` ritorna `authorized: true` hardcoded senza che nessuno lo chiami.
   Chiunque conosca l'URL può chiamare la coda. Il frontend non manda mai `X-Admin-Session`.
2. **IDOR su tutti gli endpoint admin.** `store_id` arriva da query string o body e non viene
   mai validato contro una sessione.
3. **PIN admin in chiaro** in `admin_access.access_code`, senza rate limiting: 4 cifre =
   10.000 combinazioni provabili senza alcun limite.
4. **`internal/ai/summarize` è un webhook pubblico non autenticato** che consuma budget
   OpenRouter a ogni chiamata.

### Rollback — come rimettere in piedi questa versione
1. Stack Docker NeuroForge attivo (`C:\Progetti\NeuroForge`, `docker compose up -d`), con
   i container `n8n`, `postgres`, `caddy`, `tunnel`.
2. Applicare `database/kyros_schema.sql` su Postgres.
3. Importare i workflow da **`n8n/live_export_2026-08-16/`** (non da `n8n/*.json`, sono stalli):
   `n8n import:workflow --separate --input=<dir>`.
4. Ricreare a mano le credenziali n8n (`Postgres Kyros`, OpenRouter): l'export le strippa.
5. Cloudflare Tunnel su `mind.neuroforge.club`, PWA buildata in `config/caddy/kyros/`.

## [2.0.0] - 2026-08-16 — Backend serverless su Vercel + Neon

Il backend passa da **32 workflow n8n** su PC locale a una **singola funzione serverless
TypeScript** (Hono) su Vercel, con **Neon Postgres**. Il frontend React resta invariato al
95%: SPA e API condividono lo stesso origin, quindi `API_BASE` resta `''` e non c'è CORS.

Versione maggiore perché cambia il runtime, cambia il database e **cambia il contratto di
autenticazione**: il header `X-Admin-Session` ora è obbligatorio su tutti gli endpoint admin.

### Added
- **Backend TypeScript versionato** in `server/`: `app.ts`, `routes/{client,chat,admin,internal}.ts`,
  `lib/{db,respond,auth,pin,ratelimit,janitor,openrouter,wiki,settings,config}.ts`.
  Una sola funzione (`api/index.ts`): un bundle solo da scaldare, dentro il limite Hobby,
  e middleware veri invece degli stessi controlli ricopiati in ogni handler.
- **Autenticazione**, che prima non esisteva affatto:
  - PIN hashati con `scrypt` (`admin_access.access_code_hash`), niente più chiaro nel DB
  - Sessioni come token HMAC-SHA256 firmati, scadenza 8 ore
  - `adminGuard` su tutto `/admin/*` tranne `auth/verify` e `auth/stores`
  - Rate limiting a token bucket su Postgres: 10 tentativi PIN / 15 min, anti-flood su
    creazione sessione e chat. L'IP è hashato col secret, mai memorizzato in chiaro
  - `/api/internal/*` dietro `CRON_SECRET`, confronto a tempo costante
- **Janitor lazy**: su Hobby i cron sono solo giornalieri, quindi lo sweep gira dentro
  `GET /admin/queue/status` (che la Control Room chiama ogni 2-5s) con lock atomico su
  `job_runs` che lo limita a una volta al minuto, in `waitUntil()` così non rallenta mai la
  risposta. **Risultato: gira ogni 60 secondi invece che ogni 5 minuti.**
  Cron giornaliero alle 02:00 UTC per lo sweep completo quando nessuno guarda.
- **Prompt caching** sul blocco wiki (`cache_control: ephemeral`), previsto in
  `specs/Pilot_Handover.md` e mai implementato. Il wiki è ~10 KB rimandati identici a ogni
  messaggio.
- **Zod** su ogni input. I workflow leggevano `$json.body.x` senza validare niente.
- `scripts/`: `db-apply`, `db-seed`, `smoke` (e2e), `generate-wiki`, `dev-api.ps1`.
- **CI su GitHub Actions**: typecheck, test, build su ogni PR.
- **28 test unitari** (vitest): firma token, hash PIN, deep merge settings, calcolo costi.

### Changed
- **Il wiki è un artefatto di build.** `scripts/generate-wiki.ts` compila
  `knowledge/public/*.md` in un modulo al momento del build, invece di `fs.readdirSync` a
  runtime a ogni messaggio. Conseguenza: modificare il wiki richiede un push.
  `POST /admin/wiki/reload` cambia semantica, da "ricarica" a "dimmi che versione è online".
- **`store_id` viene sempre dal token**, mai da query string o body. Il frontend continua a
  mandarlo, il server lo ignora.
- Gli URL dei QR si costruiscono da `KYROS_PUBLIC_URL`, non più concatenati dentro l'SQL.
- Il cap di budget AI si legge da `KYROS_AI_BUDGET_EUR` in un punto solo e l'API lo
  restituisce come `cap_eur`. Prima era scritto in tre posti.

### Fixed
- **`generate_ticket_code()` usava il fuso del server.** Andava bene finché Postgres girava
  su `Europe/Rome`; Neon gira in UTC, quindi in ora legale il reset sarebbe slittato alle
  02:00 italiane. Ora la data si calcola nel fuso dello store, con `store_today()` per tutte
  le query "di oggi".
- **Rollover `A-999` → `B-001`**, promesso da un commento da sempre e mai implementato: il
  ticket dopo `A-999` era `A-1000`.
- **Merge delle settings profondo.** `settings || $2::jsonb` è shallow: salvando solo
  `accepting_tickets` sparivano `closed_message` e tutti e tre i timeout.
- **`internal/ai/summarize` non è più un endpoint pubblico.** Era un webhook non autenticato
  che chiunque poteva martellare bruciando budget OpenRouter; ora è una chiamata di funzione
  in `waitUntil()` dopo la risposta.
- **Una sola tabella costi AI.** Il summarize hardcodava i prezzi di Haiku dentro l'SQL e
  continuava ad applicarli qualunque modello fosse configurato.
- **IDOR chiusi**, anche sulle 4 route che prendevano solo un id di riga: conoscere un UUID
  bastava per modificare o cancellare i dati di un altro store.
- `marketing_cards.updated_at` ora esiste (l'API la scriveva già dal 1.2.0).
- `sessions.status` ha un `CHECK`: era una VARCHAR libera, un typo scriveva uno stato
  inesistente e la sessione spariva dalla board senza segnalare nulla.
- `idx_entry_points_slug` rimosso, duplicava l'indice del vincolo `UNIQUE`.
- Il proxy dev `/api` in `pwa/vite.config.ts` ora esiste davvero: `pwa/README.md` sosteneva
  di sì dal principio, ma `npm run dev` da solo non parlava col backend.

### Security
- `knowledge/internal/` non è più tracciato; PIN demo `1234` rimosso dai file tracciati.
- Repo passato a **privato** durante la migrazione.
- Da cancellare allo spegnimento di n8n: **`TEMP_DB_Utils`**, webhook di esecuzione SQL
  arbitraria (inattivo, ma presente nell'istanza).

### Note
Nessuna migrazione dati: fresh start deciso, quelli erano dati demo.
Restano fuori da questo giro: Socket.io/real-time, service worker e PWA vera, cookie
HttpOnly al posto di localStorage.

