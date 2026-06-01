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

