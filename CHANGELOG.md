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

