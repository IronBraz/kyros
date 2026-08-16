---
ID: M0
TASK: Migrazione backend da n8n a Vercel + Neon (Fasi 0-4)
OWNER: Claude
STATUS: IN_PROGRESS
PHASE: Migration
DEPENDS_ON: -
ESTIMATE: 15-20h
---

## 1. Contesto e Obiettivo

Esecuzione di `_local/PLAN_Vercel_Migration.md`. Il backend passa da 32 workflow n8n su PC
locale a una singola funzione serverless TypeScript (Hono) su Vercel, con Neon Postgres.
Obiettivo: URL pubblico stabile, logica versionata e testabile, autenticazione vera.

- **Riferimento master:** `_local/PLAN_Vercel_Migration.md`
- **Stato dettagliato e prove:** `_local/MIGRATION_PROGRESS.md`
- **Verità sul backend n8n:** `_local/LIVE_REFERENCE_2026-08-16.md` +
  `n8n/live_export_2026-08-16/`

Branch: `feat/serverless`. `main` resta la versione n8n funzionante.

## 2. Fase 0 — congelare l'ultima release n8n — FATTA

- [x] Riesportati i 35 workflow Kyros dall'istanza viva → `n8n/live_export_2026-08-16/`
- [x] Confronto nodo per nodo: solo 7 su 32 export nel repo erano ancora allineati,
      3 workflow live non avevano alcun file nel repo
- [x] Generato `_local/LIVE_REFERENCE_2026-08-16.md` e rettificata l'appendice (nuova §0)
- [x] Verificato che i 23 path chiamati dalla PWA combacino col live: zero divergenze
- [x] `knowledge/internal/` non più tracciato; PIN `1234` rimosso da 5 file
- [x] `CHANGELOG.md` 1.5.0 con criticità note e rollback; nota in `README.md`
- [x] Commit `b15f6bb`, tag `v1.5.0-n8n-final`, branch `legacy/n8n`
- [ ] **push + GitHub Release** — bloccati dal classifier, servono all'utente

## 3. Fase 1 — scheletro Vercel + Neon — FATTA

- [x] Root `package.json` con workspaces, `vercel.json`, `tsconfig.json`, `api/index.ts`
- [x] `server/lib/db.ts` (driver Neon HTTP), `server/lib/respond.ts` (envelope)
- [x] Progetto Vercel `brainforge1/kyros`, Neon in `eu-central-1`
- [x] `GET /api/v1/health` risponde con la versione di Postgres di Neon
- [x] `scripts/generate-wiki.ts`, proxy dev in `vite.config.ts`, `scripts/dev-api.ps1`

## 4. Fase 2 — schema con le 8 correzioni — FATTA

- [x] Tutte e 8 applicate a `database/kyros_schema.sql`
- [x] Provate su un DB usa-e-getta locale: rollover A-999→B-001, wrap a Z, reset
      giornaliero, store inesistente, e il fuso (store UTC+14 vs server UTC)
- [x] Applicato su Neon: 14 tabelle, 3 funzioni
- [x] `scripts/db-apply.ts` e `scripts/db-seed.ts`

## 5. Fase 3 — i 23 endpoint — FATTA

- [x] client (5), chat (2), admin (16), più le route cron interne
- [x] SQL verbatim dall'export live, zod su ogni input
- [x] 22/23 verificati con curl reali contro Neon (manca il percorso felice di chat/send,
      serve la chiave OpenRouter)
- [x] Test di concorrenza: due call-next simultanei danno due ticket diversi
- [x] Gli 8 miglioramenti del piano, meno i 3 che nel live erano già a posto

## 6. Fase 4 — autenticazione vera — FATTA

- [x] `server/lib/auth.ts` (HMAC), `pin.ts` (scrypt), `ratelimit.ts` (token bucket)
- [x] `adminGuard` su tutto `/admin/*` tranne `auth/verify` e `auth/stores`
- [x] `store_id` sempre dal token; scoping aggiunto anche alle 4 route che prendevano
      solo un id di riga
- [x] `/api/internal/*` dietro `CRON_SECRET`
- [x] Frontend: `adminFetch` con header e redirect su 401, `cap_eur` dall'API
- [x] I quattro controlli della §10.3 del piano, tutti verdi
- [x] 28 test unitari

## 7. Rimanente

**Bloccanti sull'utente:**
- [ ] `OPENROUTER_API_KEY` (da estrarre da n8n prima di spegnerlo)
- [ ] push dei tre branch + GitHub Release
- [ ] PIN admin definitivo (ora ce n'è uno provvisorio)
- [ ] DNS di `kyros.neuroforge.club` su Vercel — **solo dopo preview verde**

**Fase 5:**
- [ ] `scripts/smoke.ts` end-to-end contro l'URL di preview
- [ ] Checklist di parità sui 23 endpoint
- [ ] Test manuale su telefono vero
- [ ] GitHub Actions CI, branch protection, Dependabot
- [ ] Merge su `main`, promozione a produzione
- [ ] Spegnere i workflow n8n e **cancellare `TEMP_DB_Utils`** (esecuzione SQL arbitraria)
- [ ] Aggiornare `specs/05`, `specs/10`, `CLAUDE.md`, `README.md`, `CHANGELOG.md` 2.0.0

## 8. Scoperte che cambiano il piano

1. **Gli export n8n nel repo erano molto più stalli del previsto**: 7 su 32 allineati.
2. **Tre miglioramenti della Fase 3 erano già nel live**: lookup entry point per slug o
   uuid, scope tenant sulle marketing card, janitor che legge `ghost_timeout_minutes`.
   Il bug del flusso QR (§4.4 del piano) non esiste.
3. **I QR usano `/q/<slug>`** su `kyros.neuroforge.club`, hardcoded nell'SQL live.
   Tenendo lo stesso dominio non c'è nessun QR da rigenerare.
4. **`TEMP_DB_Utils`** è un webhook di esecuzione SQL arbitraria, inattivo. Da cancellare.
5. **Neon va creato con `-m region=fra1`**, altrimenti la CLI lo mette in us-east-1.
6. **Il DNS è il vero punto di non ritorno**, non lo spegnimento dei container.
