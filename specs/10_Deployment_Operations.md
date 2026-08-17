# Kyros - Deployment & Operations

**Ambito:** hosting, deploy, variabili d'ambiente, backup, disaster recovery.
**Aggiornato:** 2026-08-17, dopo la migrazione da n8n a Vercel.

> **Nota sulla storia.** Fino al 2026-08-16 Kyros girava su un PC di casa, dentro lo stack
> Docker "NeuroForge", esposto da un Cloudflare Tunnel verso Caddy, con la logica in 32 workflow
> n8n. Niente di tutto questo è più vero. Restano il tag `v1.5.0-n8n-final` e il branch
> `legacy/n8n` come rollback. Gli script `manage_kyros_db.ps1` e il `docker-compose` di
> NeuroForge non servono più a nulla per Kyros.

---

## 1. Architettura di deployment

| Cosa | Dove |
| :--- | :--- |
| **Hosting** | Vercel, team `brainforge1`, progetto `kyros`, piano **Hobby** |
| **Regione funzione** | `fra1` (Francoforte) |
| **Database** | Neon serverless Postgres, regione `eu-central-1` |
| **Dominio pubblico** | `kyros.neuroforge.club` |
| **Dominio Vercel** | `kyros-phi.vercel.app` (funziona anche lui, pubblico) |
| **Repository** | GitHub, branch `main` = produzione |

### DNS
`kyros.neuroforge.club` è un **CNAME** verso Vercel su Cloudflare, con il proxy **disattivato
(nuvoletta grigia, "DNS only")**. Se qualcuno riaccende il proxy arancione, Vercel non riesce più
a emettere o rinnovare il certificato TLS e il sito va giù. È l'errore più facile da fare su
questo progetto.

Dopo un cambio DNS il certificato ci mette qualche minuto: nella finestra di emissione HTTPS
risponde con errore mentre la porta 80 risponde già 200. Non è un guasto, è la norma.

### Deployment Protection
`ssoProtection: all_except_custom_domains`. Il dominio pubblico è aperto a tutti, le preview
sono protette. Gli script automatici passano dal **Protection Bypass for Automation**, che è una
variabile **di sistema** Vercel: non compare in `vercel env pull`, si legge come chiave
dell'oggetto `protectionBypass` in `GET /v9/projects/{id}`.

---

## 2. Deploy

### La procedura normale
```powershell
git push origin main
```
Basta questo. Vercel costruisce da GitHub e pubblica. Non serve la CLI, non serve `vercel deploy`.

Il build gira `npm run prebuild` (genera `server/lib/wiki.generated.ts` da `knowledge/public/*.md`)
e poi `npm run build` (Vite, output in `pwa/dist`).

### Cose che rompono il deploy
- **`.vercelignore` va tenuto aggiornato.** `vercel deploy` dalla CLI aspira anche cartelle
  gitignorate: `_local/` da solo pesa 150 MB e sfonda il limite dei 100 MB. `knowledge/public`
  invece deve **restare**, perché il prebuild la legge.
- **La wiki è un artefatto di build.** `server/lib/wiki.generated.ts` è gitignorato. Modificare
  un file in `knowledge/public/` non ha effetto finché non si rifà il deploy.
- **Cambiare una variabile d'ambiente non basta.** Serve un deploy nuovo perché venga letta.

---

## 3. Variabili d'ambiente

Vivono su Vercel, separate per ambiente. In locale si tirano giù con:
```powershell
npx vercel env pull .env.local
```
`.env.local` è in `.gitignore`. Lo leggono solo gli script di manutenzione, tramite
`scripts/load-env.ts`; il codice in `server/` non lo tocca mai.

| Variabile | Note |
| :--- | :--- |
| `DATABASE_URL` | Neon, driver HTTP. Uguale nei tre ambienti (c'è un database solo) |
| `KYROS_SESSION_SECRET` | Firma i token admin. **Valore diverso per Production, Preview e Development** |
| `OPENROUTER_API_KEY` | Concierge AI. Sensitive su Preview e Production |
| `KYROS_AI_MODEL` | Modello del concierge |
| `KYROS_AI_BUDGET_EUR` | Tetto di spesa mensile, kill-switch |
| `KYROS_PUBLIC_URL` | Base degli URL dei QR code |
| `CRON_SECRET` | Iniettata da Vercel. Protegge `/api/internal/*` |

### Ruotare il segreto di sessione
```powershell
npx vercel env rm KYROS_SESSION_SECRET production -y
# genera 48 byte casuali e passali su stdin, senza mai stamparli a schermo
npx vercel env add KYROS_SESSION_SECRET production --sensitive
git commit --allow-empty -m "redeploy" ; git push origin main
```
**Conseguenza:** tutte le sessioni admin aperte muoiono. Chi è dentro la Control Room deve
rifare il login col PIN. Non tocca i clienti in coda.

---

## 4. Gestione dei dati

| Comando | Cosa fa |
| :--- | :--- |
| `npm run db:apply` | Applica `database/kyros_schema.sql` |
| `npm run db:seed` | Crea o aggiorna tenant, store, PIN admin, entry point, casse, contenuti. Idempotente |
| `npm run db:cards` | Riallinea solo il feed contenuti. Non serve il PIN. `-- --apply` per scrivere |
| `npm run smoke` | 14 controlli end-to-end contro la produzione |

### Il PIN admin
```powershell
$env:KYROS_SEED_ADMIN_PIN = "<pin>"
npm run db:seed
```
Da 4 a 6 cifre. Finisce nel database solo come hash scrypt. `1234` è rifiutato perché è
pubblicato nella history del repo. **Il PIN non va mai scritto in chat, in un file del repo o in
un messaggio.**

### Entry point
Gli slug (`entrata`, `macchine`, `cassa`) sono quelli fisicamente scritti sui tag NFC attaccati
agli arredi. Il database segue il mondo fisico, non il contrario: cambiare uno slug significa
andare a riscrivere il tag a mano.

---

## 5. Backup

Il database è su **Neon**, che fa point-in-time recovery da solo. Sul piano gratuito la finestra
è breve (ordine di giorni): per un pilota va bene, per un cliente vero no.

Il codice è su GitHub. Lo schema è versionato in `database/kyros_schema.sql`.

**Quello che non è coperto:** un dump periodico dei dati fuori da Neon. Se serve, è
`pg_dump "$env:DATABASE_URL"` schedulato via Task Scheduler. *Non implementato ad oggi.*

---

## 6. Disaster recovery

Non c'è più un PC che può esplodere. Gli scenari residui:

| Scenario | Cosa fare |
| :--- | :--- |
| Deploy rotto | Vercel → Deployments → il deploy precedente → **Promote to Production**. Istantaneo |
| Database perso o corrotto | Neon → Restore (point-in-time). Poi `npm run db:apply` e `npm run db:seed` se serve ricostruire |
| Vercel giù | Nessun piano B. Dipendenza accettata per il pilota |
| Rollback totale all'era n8n | `git checkout legacy/n8n`, riaccendere lo stack Docker, ripuntare il DNS al tunnel. Ha senso solo se il problema è strutturale |

---

## 7. Cosa resta aperto

- **Nessun monitoring né alerting.** Se il sito cade di notte non lo sa nessuno.
- **Nessun backup fuori da Neon.**
- **Branch protection su `main` non attiva**: richiede repo pubblico o GitHub Pro.
- **Prompt caching inefficace** sul concierge (`cached_tokens: 0` a ogni chiamata). Costa
  qualche centesimo in più al mese. Accettato: il sistema è un mockup.
