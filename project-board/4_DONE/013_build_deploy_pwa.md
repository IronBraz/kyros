---
ID: 013
TASK: Build e Deploy PWA su Caddy
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Build production di Client e Admin PWA + deploy su Caddy in struttura monolith

**PERCHÉ:** PWA devono essere accessibili via HTTPS su your-domain.example.com (Client) e /control-room (Admin)

**COME:**

**STRUTTURA TARGET**:
- `your-domain.example.com/` → Client PWA
- `your-domain.example.com/control-room/` → Admin PWA

**STEP 1 - Build Client PWA**:
```bash
cd "C:/Users/<your-username>/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/FRONT/Kyros"

# Installa dependencies (se node_modules mancante)
npm install

# Build production
npm run build

# Verifica output
ls dist/
# Atteso: index.html + assets/ con JS/CSS hashati
```

**STEP 2 - Build Admin PWA**:
```bash
cd "C:/Users/<your-username>/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/BACK/Kyros---Admin"

npm install
npm run build

ls dist/
```

**STEP 3 - Deploy su Caddy**:
```bash
cd C:/NeuroForge/config/caddy

# Crea directory deploy
mkdir -p kyros

# Copia Client (root)
cp -r "C:/Users/<your-username>/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/FRONT/Kyros/dist/"* kyros/

# Copia Admin (subdirectory)
mkdir -p kyros/control-room
cp -r "C:/Users/<your-username>/OneDrive/Documenti/Progetti/Kyros_ConciergeManager/OUTPUT/pwa/BACK/Kyros---Admin/dist/"* kyros/control-room/

# Verifica struttura
ls -R kyros/
# Atteso:
# kyros/index.html, kyros/assets/
# kyros/control-room/index.html, kyros/control-room/assets/
```

**STEP 4 - Configura Routing /control-room in Caddyfile**:
Apri: `C:/NeuroForge/config/caddy/Caddyfile`
Nel blocco `http://your-domain.example.com`, DOPO `handle /socket.io/*` e PRIMA `root *`, aggiungi:
```caddyfile
    handle /control-room* {
        root * /var/www/kyros/control-room
        try_files {path} /index.html
        file_server
    }
```

**STEP 5 - Reload Caddy**:
```bash
cd C:/NeuroForge
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

**STEP 6 - Test Deploy**:
```bash
# Client root
curl -I https://your-domain.example.com/
# Atteso: HTTP/2 200

# Client SPA route
curl -I https://your-domain.example.com/waiting-room
# Atteso: HTTP/2 200 (serve index.html, no 404)

# Admin root
curl -I https://your-domain.example.com/control-room/
# Atteso: HTTP/2 200

# Admin SPA route
curl -I https://your-domain.example.com/control-room/queue
# Atteso: HTTP/2 200
```

**Acceptance Criteria:**
- [ ] Client PWA: directory `dist/` con index.html + assets/
- [ ] Admin PWA: directory `dist/` con index.html + assets/
- [ ] Caddy: directory `C:/NeuroForge/config/caddy/kyros/` popolata
- [ ] Caddyfile contiene blocco `handle /control-room*`
- [ ] `curl https://your-domain.example.com/` → 200 OK
- [ ] `curl https://your-domain.example.com/control-room/` → 200 OK
- [ ] Browser: `https://your-domain.example.com/` mostra Client landing page
- [ ] Browser: `https://your-domain.example.com/control-room/` mostra Admin login
- [ ] SPA routing: refresh F5 su route interne NO 404

**SE FALLISCE:**
- **npm run build error**: Leggi errore TypeScript → fixa codice → riprova
- **404 on /control-room**: Verifica handle PRIMA di root * (ordine critico)
- **Assets 404**: Verifica base path in vite.config.ts (`base: '/'` Client, `base: '/control-room/'` Admin)
- **Cloudflare cache stale**: Purge cache Cloudflare dashboard

**Tempo Stimato:** 45 min - 1 ora

**Dipendenze:** Task 005 (Caddy configurato)

**Riferimenti - CROSS CHECK:**
- **Build config**: OUTPUT/pwa/FRONT/Kyros/vite.config.ts, OUTPUT/pwa/BACK/vite.config.ts
- **Deploy steps**: Piano FASE 3 § 3.3-3.6

**Note & Log:**
