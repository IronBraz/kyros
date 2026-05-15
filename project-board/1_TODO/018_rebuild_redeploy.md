---
ID: 018
TASK: Rebuild e Redeploy PWA con API Reali
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Rebuild production di entrambe le PWA dopo integrazione API + redeploy su Caddy

**PERCHÉ:** Modifiche task 015-017 sono in codice sorgente. Serve nuovo build production e deploy

**COME:**

**STEP 1 - Rebuild Client PWA**:
```bash
cd "C:/Users/ironb/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/FRONT/Kyros"

# Clean old build (opzionale ma raccomandato)
rm -rf dist/

# Rebuild
npm run build

# Verifica no errori
echo $?
# Atteso: 0 (success)
```

**STEP 2 - Rebuild Admin PWA**:
```bash
cd "C:/Users/ironb/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/BACK/Kyros---Admin"

rm -rf dist/
npm run build

echo $?
# Atteso: 0
```

**STEP 3 - Redeploy su Caddy**:
```bash
cd C:/NeuroForge/config/caddy

# Backup vecchio deploy (opzionale)
mv kyros kyros.backup.$(date +%Y%m%d_%H%M%S)

# Redeploy Client (root)
mkdir -p kyros
cp -r "C:/Users/ironb/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/FRONT/Kyros/dist/"* kyros/

# Redeploy Admin (subdirectory)
mkdir -p kyros/control-room
cp -r "C:/Users/ironb/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/BACK/Kyros---Admin/dist/"* kyros/control-room/

# Verifica file count (deve essere > 0)
ls -1 kyros/ | wc -l
ls -1 kyros/control-room/ | wc -l
```

**STEP 4 - Hard Refresh Browser** (clear cache):
```bash
# Opzionale: Purge Cloudflare cache (se disponibile)
# Cloudflare Dashboard → Caching → Purge Everything
```

Poi in browser:
- Apri `https://kyros.neuroforge.club/`
- CTRL+SHIFT+R (hard refresh, clear cache)
- Apri DevTools → Application → Clear Storage → Clear site data
- Reload

**STEP 5 - Verifica Build Hash**:
Vecchio deploy aveva hash tipo: `index-abc123.js`
Nuovo deploy deve avere hash diverso: `index-def456.js`

```bash
ls kyros/assets/*.js
# Confronta hash con backup
ls kyros.backup.*/assets/*.js
# Hash DEVONO essere diversi
```

**Acceptance Criteria:**
- [ ] Client build completa senza errori (exit code 0)
- [ ] Admin build completa senza errori
- [ ] Directory `kyros/` aggiornata con nuovo build
- [ ] Directory `kyros/control-room/` aggiornata
- [ ] Hash assets JS/CSS cambiati rispetto a deploy precedente
- [ ] Browser hard refresh mostra nuova versione (verifica console.log se aggiunto)
- [ ] DevTools Network: richieste API reali (no mock setTimeout)

**SE FALLISCE:**
- **Build error TypeScript**: Fix errori codice → riprova build
- **Browser mostra vecchia versione**: Clear cache + CTRL+SHIFT+R
- **Assets hash identici**: Build non eseguito correttamente → rm -rf dist + rebuild
- **Cloudflare cache**: Purge cache dal dashboard

**Tempo Stimato:** 15-20 min

**Dipendenze:** Task 015-017 (API integration completata)

**Riferimenti - CROSS CHECK:**
- **Build config**: vite.config.ts (hash automatico su build)
- **Deploy steps**: Piano FASE 4 § 4.4, 4.6

**Note & Log:**
