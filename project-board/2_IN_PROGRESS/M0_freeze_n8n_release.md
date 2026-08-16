---
ID: M0
TASK: Congelare l'ultima release n8n prima della migrazione a Vercel
OWNER: Claude
STATUS: IN_PROGRESS
PHASE: Migration
DEPENDS_ON: -
ESTIMATE: 30-45 min
---

## 1. Contesto e Obiettivo

Fase 0 di `_local/PLAN_Vercel_Migration.md`. Il backend passa da 32 workflow n8n a una
singola funzione serverless TypeScript su Vercel + Neon. Prima di toccare qualsiasi cosa
serve un punto di ripristino affidabile, e va fatto **con n8n ancora acceso** perché
contiene una riesportazione dei workflow live che dopo non sarebbe più possibile.

- **Riferimento master:** `_local/PLAN_Vercel_Migration.md` §8 Fase 0
- **Appendice:** `_local/APPENDIX_n8n_Inventory.md` (rettificata in §0)

## 2. Cosa è stato fatto

- [x] Riesportati i 35 workflow Kyros dall'istanza viva
      (`docker exec neuroforge-n8n-1 n8n export:workflow --all --separate`)
      → `n8n/live_export_2026-08-16/` + README che spiega la divergenza
- [x] Confronto nodo per nodo live vs `n8n/*.json`: solo 7 su 32 ancora allineati,
      3 workflow live senza alcun file nel repo
- [x] Generato `_local/LIVE_REFERENCE_2026-08-16.md` (SQL, JS e shape delle risposte del live)
- [x] Rettificata `_local/APPENDIX_n8n_Inventory.md` con una nuova §0
- [x] Verificato che i 23 path chiamati dalla PWA combacino col live: **zero divergenze**
- [x] `knowledge/internal/` non più tracciato (gitignore + `git rm --cached`), file salvi su disco
- [x] PIN demo `1234` rimosso da tutti i file tracciati
- [x] `CHANGELOG.md` 1.5.0 con criticità note e procedura di rollback
- [x] Nota di migrazione in cima al `README.md`
- [x] Commit `b15f6bb`, tag annotato `v1.5.0-n8n-final`, branch `legacy/n8n` (in locale)

## 3. Rimanente — richiede l'utente

- [ ] `git push origin main --follow-tags` e `git push -u origin legacy/n8n`
      (bloccati dal classifier di Claude Code)
- [ ] `gh release create v1.5.0-n8n-final` (idem)

## 4. Acceptance Criteria

- [x] `git tag -l` mostra `v1.5.0-n8n-final`
- [x] `git ls-files knowledge/internal` è vuoto
- [x] `git log legacy/n8n -1` punta allo stesso commit del tag
- [ ] `gh release view v1.5.0-n8n-final` restituisce la release

## 5. Scoperte rilevanti per le fasi successive

1. **Il bug del flusso QR (§4.4 del piano) nel live non esiste**: `CreateSession` fa già
   `WHERE ep.id::text = $1 OR ep.slug = $1`.
2. **I QR in uso hanno la forma `/q/<slug>`** su dominio `kyros.neuroforge.club`, hardcoded
   nell'SQL di `API_Admin_EntryPoints`. Risponde al punto 🙋 4 del piano.
3. **Nessun leak multi-tenant sulle marketing card**: il live filtra già per `tenant_id`.
4. **`TEMP_DB_Utils`** è un endpoint di esecuzione SQL arbitraria, inattivo. Da cancellare
   dall'istanza n8n al momento dello spegnimento, non da portare.
5. **La chiave OpenRouter non è nei workflow**: sta in una credenziale n8n cifrata.
   Va estratta prima di spegnere lo stack (punto 🙋 1 del piano).
