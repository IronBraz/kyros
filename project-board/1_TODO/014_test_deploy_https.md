---
ID: 014
TASK: Test Deploy HTTPS e SPA Routing
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Verificare che PWA deployed funzionino correttamente via HTTPS con routing SPA

**PERCHÉ:** Validazione finale deploy: HTTPS attivo, SPA routing corretto, no 404 su refresh

**COME:**

**TEST COMPLETO (CLI + Browser)**:

**1. Test CLI - Client PWA**:
```bash
# Root
curl -sI https://your-domain.example.com/ | grep "HTTP/2 200"

# SPA routes
curl -sI https://your-domain.example.com/waiting-room | grep "HTTP/2 200"
curl -sI https://your-domain.example.com/your-turn | grep "HTTP/2 200"

# Assets
curl -sI https://your-domain.example.com/assets/index-*.js | grep "HTTP/2 200"
```

**2. Test CLI - Admin PWA**:
```bash
# Root
curl -sI https://your-domain.example.com/control-room/ | grep "HTTP/2 200"

# SPA routes
curl -sI https://your-domain.example.com/control-room/queue | grep "HTTP/2 200"
curl -sI https://your-domain.example.com/control-room/settings | grep "HTTP/2 200"

# Assets
curl -sI https://your-domain.example.com/control-room/assets/index-*.js | grep "HTTP/2 200"
```

**3. Test Browser - Client PWA**:
1. Apri `https://your-domain.example.com/`
2. Verifica: Landing page visibile (mock data ancora)
3. Click link interno (es: "Entra in coda")
4. Refresh F5 → NO 404 error
5. DevTools Console → NO errori (eccetto API mock warnings, OK)
6. DevTools Network → Assets caricati con hash (es: `index-a1b2c3d4.js`)

**4. Test Browser - Admin PWA**:
1. Apri `https://your-domain.example.com/control-room/`
2. Verifica: Login screen visibile
3. Inserisci PIN fake (UI funziona anche se API mock)
4. Naviga a route interne (es: /control-room/queue)
5. Refresh F5 → NO 404
6. DevTools Console → NO errori critici

**5. Test HTTPS Security**:
```bash
# Verifica certificato Cloudflare
curl -vI https://your-domain.example.com/ 2>&1 | grep "SSL certificate verify ok"

# Headers sicurezza
curl -I https://your-domain.example.com/ | grep "X-Content-Type-Options"
curl -I https://your-domain.example.com/ | grep "X-Frame-Options"
```

**6. Test Mobile (opzionale ma raccomandato)**:
- Apri da smartphone: `https://your-domain.example.com/`
- Verifica: Layout responsive, touch targets OK
- Aggiungi a Home Screen (PWA install prompt)

**Acceptance Criteria:**
- [ ] Tutti i curl ritornano HTTP/2 200 (no 404, no 500)
- [ ] Browser Client: landing page caricata, no errori critici
- [ ] Browser Admin: login screen caricato, no errori critici
- [ ] SPA routing: F5 refresh su route interne → serve index.html corretto
- [ ] Assets JS/CSS caricati con hash nell'URL
- [ ] DevTools Network: NO 404 errors
- [ ] Security headers presenti (X-Content-Type-Options, X-Frame-Options)
- [ ] (Opzionale) Mobile: layout responsive OK

**SE FALLISCE:**
- **404 su route interne**: `try_files {path} /index.html` mancante in Caddyfile
- **Assets 404**: Path base errato → vite.config.ts
- **Mixed content error**: Qualche risorsa usa HTTP invece HTTPS → verifica codice
- **Cloudflare 522 timeout**: Tunnel disconnesso → `cloudflared tunnel run`

**Tempo Stimato:** 30 min

**Dipendenze:** Task 013 (PWA deployed)

**Riferimenti - CROSS CHECK:**
- **Test checklist**: Piano FASE 3 § 3.6 (test deploy completo)
- **Caddyfile routing**: Verificare `try_files` configurato corretto

**Note & Log:**
