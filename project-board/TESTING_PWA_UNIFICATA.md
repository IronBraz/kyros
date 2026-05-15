# Testing Guide - PWA Unificata Kyros

**Data creazione**: 2026-02-17
**Versione**: 1.0
**Location**: `OUTPUT/pwa/UNIFIED/`

---

## 📋 Prerequisiti

Prima di iniziare il testing, assicurati che siano soddisfatti questi requisiti:

### Backend Requirements
- ✅ **n8n workflows** attivi e funzionanti
- ✅ **PostgreSQL** database con schema Kyros caricato
- ✅ **Caddy** (o altro reverse proxy) configurato per SPA fallback
- ✅ **API Base URL** configurato (es. `https://api.your-domain.example.com`)

### Frontend Setup
```bash
cd OUTPUT/pwa/UNIFIED
npm install  # Se non già fatto
```

### Environment Variables
Creare file `.env` nella cartella `OUTPUT/pwa/UNIFIED/`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🚀 Avvio Dev Server

```bash
cd OUTPUT/pwa/UNIFIED
npm run dev
```

Il server sarà disponibile su: **http://localhost:5173/**

**Nota**: Se la porta 5173 è occupata, Vite userà automaticamente la successiva disponibile (5174, 5175, etc.)

---

## ✅ Checklist di Testing

### PARTE 1: Client Interface (Interfaccia Pubblica)

#### Test 1.1: Landing Page
**URL**: `http://localhost:5173/`

- [ ] Header "KYROS Virtual Queue" visibile e centrato
- [ ] Sottotitolo "The Concierge Service" presente
- [ ] Design parchment (#F3EBDD) e teal (#2DD4BF) applicato correttamente
- [ ] Due bottoni presenti:
  - [ ] "Scan QR" con icona Camera
  - [ ] "Tap NFC" con icona Radio (placeholder - non funzionante in MVP)
- [ ] Footer con info queue: "5 people • ~8 min" (valori placeholder)

**Screenshot consigliato**: Landing page completa

---

#### Test 1.2: QR Scanner
**URL**: `http://localhost:5173/` → Click "Scan QR"

- [ ] Overlay fullscreen nero si apre
- [ ] Richiesta permessi camera del browser
- [ ] Scanner HTML5-QRCode visualizzato
- [ ] Bottone "X" per chiudere scanner funzionante
- [ ] Scansione QR code funzionante (se hai QR di test):
  - [ ] Messaggio "QR Code Found!" appare (verde, bounce)
  - [ ] Auto-join queue e redirect a `/waiting`

**Test alternativo senza camera**:
- Apri direttamente: `http://localhost:5173/?ep=main-entrance`
- Dovrebbe auto-joinare se entry point esiste nel DB

**Possibili errori da verificare**:
- [ ] "Invalid QR code format" se QR non valido
- [ ] "Queue is currently closed" se store.settings.accepting_tickets = false
- [ ] "Network error" se API non risponde

---

#### Test 1.3: Waiting Room (Protected Route)
**URL**: `http://localhost:5173/waiting` (dopo join queue)

**UI Elements**:
- [ ] Header con logo/nome store caricato da API
- [ ] Ticket code prominente (es. "A-001") in font serif grande
- [ ] Badge stato "IN QUEUE" (teal)
- [ ] Position counter con animazione (es. "Position #3")
- [ ] Estimated wait time (es. "~6 minutes")
- [ ] Marketing cards feed:
  - [ ] Cards caricate da API (se presenti in DB)
  - [ ] Tipi diversi: PROMO (purple), TRIVIA (orange), INFO (blue), BRAND (green)
  - [ ] Icone Lucide corrette (Gift, Coffee, Info, Star)
  - [ ] Empty state elegante se nessuna card
- [ ] Bottone "Leave Queue" in basso

**Console Checks** (F12 → Console):
- [ ] Heartbeat ogni 60 secondi: `POST /api/v1/client/sessions/:id/heartbeat`
- [ ] Nessun errore JavaScript
- [ ] Nessun errore di rete (tranne se API offline - allora messaggio graceful)

**Interazioni**:
- [ ] Click "Leave Queue" → Conferma → Redirect a `/thank-you`
- [ ] Refresh pagina (F5) → Stato preservato (sessionId in localStorage)
- [ ] Simula chiamata da admin → Auto-redirect a `/your-turn`

**Test Protected Route**:
- [ ] Apri `/waiting` in incognito (senza session) → Redirect a `/`

---

#### Test 1.4: Your Turn (Chiamata)
**URL**: `http://localhost:5173/your-turn` (dopo chiamata da admin)

- [ ] Header "IT'S YOUR TURN!"
- [ ] Ticket code grande e prominente
- [ ] Icona animata (es. campana o freccia)
- [ ] Messaggio: "Please proceed to the counter"
- [ ] Audio notification suonato (se audioManager abilitato)
- [ ] Bottone "I'm here" → Marca come "serving"

**Console Check**:
- [ ] Evento Socket.io ricevuto: `TICKET_CALLED`

---

#### Test 1.5: Thank You Page
**URL**: `http://localhost:5173/thank-you`

- [ ] Messaggio "Thank you for visiting!"
- [ ] CTA: "Visit us again"
- [ ] Design elegante e pulito
- [ ] Nessun errore console

**Test**:
- [ ] Accesso diretto senza session → Pagina carica normalmente (pubblico)

---

### PARTE 2: Admin Interface (Control Room)

#### Test 2.1: Login Gate
**URL**: `http://localhost:5173/control-room/login`

**UI Elements**:
- [ ] Header "Kyros Control Room"
- [ ] Dropdown "Select Store" popolato:
  - [ ] API: `GET /api/v1/admin/auth/stores`
  - [ ] Lista stores caricata correttamente
  - [ ] Se errore API → messaggio "Unable to load stores"
- [ ] Input PIN (4-6 digits)
- [ ] Bottone "Access Control Room"

**Interazioni**:
- [ ] Inserisci PIN valido (es. `123456` per test) → Submit
  - [ ] API: `POST /api/v1/admin/auth/verify`
  - [ ] Risposta success → localStorage `kyros_admin_session` salvato
  - [ ] Redirect a `/control-room/counter`
- [ ] Inserisci PIN invalido → Messaggio errore chiaro
  - [ ] "Invalid PIN" o simile
  - [ ] No redirect

**Console Check**:
- [ ] Request/response API visibili in Network tab
- [ ] localStorage `kyros_admin_session` contiene:
  - `store_id`, `store_name`, `session_token`, `expires_at`

---

#### Test 2.2: Counter Mode (Default View)
**URL**: `http://localhost:5173/control-room/counter` (dopo login)

**Layout**:
- [ ] Sidebar sinistra con 5 icone navigation:
  - [ ] Counter (LayoutGrid) - attivo
  - [ ] Analytics (BarChart3)
  - [ ] Zones (MapPin)
  - [ ] Content (FileText)
  - [ ] Settings (Settings)
- [ ] Header top: Store name, stats KPI, logout button
- [ ] Main area: 3 colonne queue

**KPI Header** (Auto-aggiornati ogni 5s):
- [ ] In Queue: numero clienti waiting
- [ ] Called: numero clienti chiamati
- [ ] Avg Wait: minuti stimati

**3 Colonne Queue**:
1. **Waiting Queue** (sinistra):
   - [ ] Lista ordinata per position (FIFO)
   - [ ] Ogni card mostra: ticket code, position, entry point, tempo attesa
   - [ ] Empty state: "No customers waiting"

2. **Called/Serving** (centro):
   - [ ] Lista clienti chiamati
   - [ ] Ogni card mostra: ticket code, entry point, bottoni azione
   - [ ] Bottoni: "Mark Served" (check), "Mark Missed" (X)
   - [ ] Empty state: "No active calls"

3. **Missed** (destra):
   - [ ] Lista clienti missed (no-show)
   - [ ] Ogni card: ticket code, entry point, timestamp
   - [ ] Empty state: "No missed calls"

**Azioni Critiche**:
- [ ] **Bottone "Call Next"** (grande, teal, in alto):
  - [ ] Click → API: `POST /api/v1/admin/queue/call-next`
  - [ ] Primo cliente in waiting → spostato in called
  - [ ] Posizioni clienti restanti aggiornate
  - [ ] Socket.io evento `TICKET_CALLED` emesso
- [ ] **Spacebar shortcut**:
  - [ ] Premi SPAZIO → stessa azione di "Call Next"
  - [ ] Funziona solo se focus non su input/textarea
- [ ] **Mark Served**: Cliente called → status finished → scompare da UI
- [ ] **Mark Missed**: Cliente called → status missed → spostato in colonna Missed

**Polling**:
- [ ] Queue si aggiorna automaticamente ogni 5 secondi
- [ ] Check Network tab: `GET /api/v1/admin/queue/current` ogni 5s

---

#### Test 2.3: Analytics Mode
**URL**: `http://localhost:5173/control-room/analytics`

**Time Range Filters**:
- [ ] 4 bottoni: Last Hour, Today, This Week, This Month
- [ ] Click cambia filtro (attivo = teal)
- [ ] Export CSV bottone presente (disabilitato in MVP)

**4 KPI Cards**:
- [ ] **In Queue**: numero waiting (icona Users)
- [ ] **Avg Wait**: minuti medi (icona Clock)
- [ ] **Served**: numero served + completion % (icona BarChart3)
- [ ] **Missed**: numero missed (icona UserX)

**Charts** (2 charts affiancati):
1. **Bar Chart - Queue Status Breakdown**:
   - [ ] 4 barre: Waiting (teal), Called (gold), Served (teal light), Missed (red)
   - [ ] Colori palette Kyros corretti
   - [ ] Tooltip funzionante
   - [ ] Empty state: icona + "No data yet"

2. **Pie Chart - Completion Rate**:
   - [ ] 2 slices: Served vs Missed
   - [ ] Percentuale centrale grande (es. "87%")
   - [ ] Legend sotto chart
   - [ ] Empty state: "No completed sessions yet"

**Verifica Dati Reali**:
- [ ] Numeri corrispondono a DB (cross-check con Counter mode)
- [ ] Charts aggiornati con dati reali (non mock)

---

#### Test 2.4: Zones Mode (Entry Points)
**URL**: `http://localhost:5173/control-room/zones`

**UI Elements**:
- [ ] Header "Entry Points"
- [ ] Bottone "New Zone" (teal, top-right)
- [ ] Lista entry points caricata:
  - [ ] API: `GET /api/v1/admin/entry-points?store_id=...`
  - [ ] Ogni card mostra:
    - [ ] Nome (es. "Main Entrance")
    - [ ] Slug (es. "main-entrance")
    - [ ] QR code generato (libreria `qrcode`)
    - [ ] URL completo (es. `https://app.kyros.com/q/main-entrance`)
    - [ ] Bottone "Delete" (icona Trash)

**Azioni**:
- [ ] **New Zone**:
  - [ ] Click → Form modale/inline apre
  - [ ] Input: Nome, Slug
  - [ ] Submit → API: `POST /api/v1/admin/entry-points`
  - [ ] Success → nuovo entry point in lista con QR generato
- [ ] **Delete**:
  - [ ] Click Trash → Conferma
  - [ ] API: `DELETE /api/v1/admin/entry-points/:id`
  - [ ] Success → entry point rimosso da lista

**Empty State**:
- [ ] Se nessun entry point: "No entry points yet. Create one to start."

---

#### Test 2.5: Content Mode (Marketing Cards)
**URL**: `http://localhost:5173/control-room/content`

**Layout** (3 colonne):
1. **Colonna Sinistra - Lista Cards** (1/3 larghezza):
   - [ ] Lista compact di tutte le marketing cards
   - [ ] Ogni item mostra: icona, titolo, tipo (badge), priority, preview content
   - [ ] Card selezionata evidenziata (border teal)
   - [ ] Click card → carica in editor centrale

2. **Colonna Centro - Editor** (1/3 larghezza):
   - [ ] Header: "Edit Card" o "New Card"
   - [ ] Form campi:
     - [ ] Title (text input)
     - [ ] Content (textarea multi-line)
     - [ ] Type (select): PROMO, TRIVIA, INFO, BRAND
     - [ ] Priority (number input)
     - [ ] Note: "Color determines card style automatically"
   - [ ] Bottoni:
     - [ ] "Save" (teal) - salva modifiche
     - [ ] "Delete" (red border) - elimina card (solo se editing esistente)

3. **Colonna Destra - Live Preview** (1/3 larghezza, visibile solo su schermi larghi XL):
   - [ ] Mockup iPhone con card preview
   - [ ] Card renderizzata in real-time mentre editi
   - [ ] Colori theme applicati correttamente (purple/orange/blue/green)
   - [ ] Icona grande watermark in background

**Azioni**:
- [ ] **New Card**:
  - [ ] Click bottone "New Card" (top-right)
  - [ ] Editor mostra form vuoto
  - [ ] Compila campi → Click "Create"
  - [ ] API: `POST /api/v1/admin/marketing-cards`
  - [ ] Success → card aggiunta a lista
- [ ] **Edit Card**:
  - [ ] Seleziona card da lista
  - [ ] Modifica campi
  - [ ] Click "Save" → API: `PATCH /api/v1/admin/marketing-cards/:id`
  - [ ] Success → lista aggiornata
- [ ] **Delete Card**:
  - [ ] Click "Delete" → Conferma
  - [ ] API: `DELETE /api/v1/admin/marketing-cards/:id`
  - [ ] Success → card rimossa

**Empty State**:
- [ ] Se nessuna card: "No cards yet. Click 'New Card' to create one."

**Verifica Type Colors**:
- [ ] PROMO → Purple (#4A2F55)
- [ ] TRIVIA → Orange (#593E2B)
- [ ] INFO → Blue (#2C3E50)
- [ ] BRAND → Teal/Green (#2F5D50)

---

#### Test 2.6: Settings Mode
**URL**: `http://localhost:5173/control-room/settings`

**UI Elements**:
- [ ] Header "Store Settings"
- [ ] Form con tutti i campi editabili
- [ ] Bottone "Save Settings" in basso (teal)

**Campi Settings** (verifica caricamento da DB):
- [ ] **Queue Settings**:
  - [ ] Accepting Tickets (toggle ON/OFF)
  - [ ] Closed Message (textarea)
  - [ ] Avg Service Time (number, minuti)
  - [ ] Ghost Timeout (number, minuti - per janitor job)
  - [ ] Called Timeout (number, minuti - per miss automatico)
- [ ] **Display Settings**:
  - [ ] Welcome Message (text input)
  - [ ] Language (select: it/en)
- [ ] **Notifications**:
  - [ ] Call Sound (select: ding-dong/beep/chime)

**Azioni**:
- [ ] Modifica campi
- [ ] Click "Save Settings"
  - [ ] API: `PATCH /api/v1/admin/stores/:id/settings`
  - [ ] Body: JSONB nested structure (queue, display, notifications)
  - [ ] Success → Alert "Settings saved successfully!"
  - [ ] Errore → Alert con messaggio errore
- [ ] Refresh pagina → Settings persistiti correttamente

**Test Critico - Queue Toggle**:
- [ ] Disattiva "Accepting Tickets"
- [ ] Salva settings
- [ ] Apri client in altra finestra: `http://localhost:5173/?ep=main-entrance`
- [ ] Dovrebbe mostrare: "Queue is currently closed. Please speak to our staff."
- [ ] Riattiva toggle → Client può joinare di nuovo

---

#### Test 2.7: Navigation & Routing

**Sidebar Navigation**:
- [ ] Click ogni icona sidebar:
  - [ ] Counter → `/control-room/counter`
  - [ ] Analytics → `/control-room/analytics`
  - [ ] Zones → `/control-room/zones`
  - [ ] Content → `/control-room/content`
  - [ ] Settings → `/control-room/settings`
- [ ] URL cambia correttamente (BrowserRouter)
- [ ] Icona attiva evidenziata (teal background)

**Browser Navigation**:
- [ ] Back button browser → torna a vista precedente
- [ ] Forward button → avanza
- [ ] Refresh (F5) → rimane sulla stessa route (no redirect a home)

**Protected Routes**:
- [ ] Logout → localStorage cleared → redirect a `/control-room/login`
- [ ] Apri `/control-room/counter` in incognito → redirect a login
- [ ] Session expiry (8 ore) → auto-logout

**Logout**:
- [ ] Click bottone Logout (header)
- [ ] localStorage `kyros_admin_session` cancellato
- [ ] Redirect a `/control-room/login`

---

### PARTE 3: Funzionalità Cross-Interfaccia

#### Test 3.1: localStorage Persistence

**Client**:
```javascript
// Apri Console (F12) su http://localhost:5173/waiting
localStorage.getItem('kyros_session')
// Dovrebbe mostrare: {"sessionId":"...","ticketCode":"A-001",...}
```
- [ ] Dati presenti e validi
- [ ] Refresh pagina → stato preservato
- [ ] Chiudi tab e riapri → sessione ancora valida

**Admin**:
```javascript
// Console su http://localhost:5173/control-room/counter
localStorage.getItem('kyros_admin_session')
// Dovrebbe mostrare: {"store_id":"...","session_token":"...","expires_at":"..."}
```
- [ ] Session token presente
- [ ] Expiry timestamp corretto (8 ore da login)

---

#### Test 3.2: Routing Unificato

**Navigazione Mista**:
- [ ] Da client (`/waiting`) → apri nuovo tab admin (`/control-room/login`)
- [ ] Login admin → Vai a counter
- [ ] Torna a tab client → Nessun conflitto, entrambi funzionano
- [ ] Nessun errore console su route changes

**URL Diretti**:
- [ ] `http://localhost:5173/` → Landing
- [ ] `http://localhost:5173/waiting` → Waiting (o redirect se no session)
- [ ] `http://localhost:5173/control-room/counter` → Counter (o redirect se no auth)
- [ ] `http://localhost:5173/invalid-route` → Redirect a `/` (fallback)

---

#### Test 3.3: API Integration

**DevTools Network Tab** (F12 → Network):

**Client APIs**:
- [ ] `POST /api/v1/client/sessions` (join queue)
- [ ] `GET /api/v1/client/sessions/:id` (session recovery)
- [ ] `POST /api/v1/client/sessions/:id/heartbeat` (ogni 60s)
- [ ] `POST /api/v1/client/sessions/:id/abandon` (leave queue)

**Admin APIs**:
- [ ] `GET /api/v1/admin/auth/stores` (lista stores pubblico)
- [ ] `POST /api/v1/admin/auth/verify` (PIN login)
- [ ] `GET /api/v1/admin/queue/current` (queue status, polling 5s)
- [ ] `POST /api/v1/admin/queue/call-next` (chiama prossimo)
- [ ] `GET /api/v1/admin/entry-points` (lista zones)
- [ ] `POST /api/v1/admin/entry-points` (crea zone)
- [ ] `DELETE /api/v1/admin/entry-points/:id` (elimina zone)
- [ ] `GET /api/v1/admin/marketing-cards` (lista cards)
- [ ] `POST /api/v1/admin/marketing-cards` (crea card)
- [ ] `PATCH /api/v1/admin/marketing-cards/:id` (update card)
- [ ] `DELETE /api/v1/admin/marketing-cards/:id` (elimina card)
- [ ] `GET /api/v1/admin/stores/:id/settings` (get settings)
- [ ] `PATCH /api/v1/admin/stores/:id/settings` (update settings)

**Response Format Verification**:
Ogni response deve avere:
```json
{
  "success": true/false,
  "data": {...},
  "error": {"code": "...", "message": "..."},
  "meta": {"timestamp": "...", "request_id": "..."}
}
```

**Error Handling**:
- [ ] API offline → Messaggi user-friendly (non crash)
- [ ] 404 → "Resource not found"
- [ ] 401 → Redirect a login
- [ ] 500 → "Server error. Please try again."
- [ ] CORS errors → Controllare Caddy config

---

### PARTE 4: Error Handling & Edge Cases

#### Test 4.1: Network Errors

**Simula API Offline**:
- [ ] Stop n8n workflows
- [ ] Ricarica client → "Network error. Please try again."
- [ ] Ricarica admin → "Unable to load data"
- [ ] No crash, graceful degradation

---

#### Test 4.2: Invalid Data

**Client**:
- [ ] Scan QR invalido → "Invalid QR code format"
- [ ] Join queue chiusa → "Queue is currently closed"
- [ ] Entry point inesistente → "Invalid QR code"

**Admin**:
- [ ] PIN sbagliato → "Invalid PIN. Please try again."
- [ ] Delete entry point in uso → Messaggio errore (se backend valida)
- [ ] Create card con campi vuoti → Validazione frontend o backend error

---

#### Test 4.3: Race Conditions

**Concurrent Actions**:
- [ ] Due admin chiamano "Call Next" simultaneamente:
  - [ ] Solo uno succeed (DB lock `FOR UPDATE SKIP LOCKED`)
  - [ ] Altro riceve errore graceful o nessun cliente disponibile
- [ ] Cliente abbandona mentre admin sta chiamando:
  - [ ] Status aggiornato correttamente
  - [ ] No inconsistenze UI

---

#### Test 4.4: Session Expiry

**Client**:
- [ ] Heartbeat interrotto (chiudi tab per >15 min)
- [ ] Janitor job marca come "ghost"
- [ ] Riapri tab → Session non più valida → Redirect a landing

**Admin**:
- [ ] Attendi 8 ore (o modifica manualmente expires_at in localStorage)
- [ ] Ricarica pagina → Auto-logout → Redirect a login

---

### PARTE 5: Performance & Build

#### Test 5.1: Bundle Size

```bash
cd OUTPUT/pwa/UNIFIED
npm run build
```

**Verifica Output**:
- [ ] Build success senza errori TypeScript
- [ ] `dist/` folder creato
- [ ] Check bundle sizes in output:
  ```
  dist/index.html                   0.XX kB
  dist/assets/index-XXXXX.css       XX kB │ gzip: XX kB
  dist/assets/index-XXXXX.js        XXX kB │ gzip: ~316 kB
  dist/assets/vendor-react-XXX.js   XXX kB
  dist/assets/vendor-charts-XXX.js  XXX kB
  dist/assets/vendor-qr-XXX.js      XXX kB
  ...
  ```
- [ ] **Target**: Bundle totale < 1070 KB (~316 KB gzipped)
- [ ] Code splitting funzionante (6 vendor chunks separati)

---

#### Test 5.2: Dev Performance

**Chrome DevTools Performance**:
- [ ] Apri DevTools → Performance tab
- [ ] Record interaction (es. navigation Counter → Analytics)
- [ ] Nessun blocking tasks > 50ms
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s

**Console**:
- [ ] Nessun warning React deprecations
- [ ] Nessun memory leak (tab aperto per 10+ min)

---

### PARTE 6: Deployment Verification

#### Test 6.1: Production Build Locale

```bash
cd OUTPUT/pwa/UNIFIED
npm run build
npx serve dist -p 3000
```

Apri `http://localhost:3000`:
- [ ] App funziona identica a dev mode
- [ ] No console errors
- [ ] Routing funziona (refresh su route interne)
- [ ] Assets caricati correttamente

---

#### Test 6.2: Caddy SPA Fallback (se applicabile)

**Configurazione Caddy** (come da README.md):
```caddyfile
handle /api/* {
  reverse_proxy localhost:5678
}

handle {
  root * /path/to/OUTPUT/pwa/UNIFIED/dist
  try_files {path} /index.html
  file_server
}
```

**Test**:
- [ ] `/` → index.html servito
- [ ] `/control-room/counter` → index.html servito (non 404)
- [ ] `/api/v1/admin/auth/stores` → proxy a n8n
- [ ] Refresh su route interne → funziona (SPA fallback attivo)

---

## 🐛 Troubleshooting

### Problema: "Cannot find module '@/...'"
**Soluzione**: Verifica che `tsconfig.app.json` contenga:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### Problema: Build fallisce con type errors
**Soluzione**:
```bash
cd OUTPUT/pwa/UNIFIED
npm install --save-dev @types/qrcode
```

---

### Problema: CORS errors su API calls
**Soluzione**: Verifica Caddy (o reverse proxy):
- API base deve essere su stesso dominio o CORS headers configurati
- `Access-Control-Allow-Origin: *` su n8n workflows

---

### Problema: QR Scanner non funziona
**Cause**:
- Permessi camera negati → Check browser permissions
- HTTPS richiesto per camera API → Usa localhost o HTTPS in prod
- Libreria html5-qrcode: `npm install html5-qrcode`

---

### Problema: Spacebar non chiama next
**Check**:
- Focus non su input/textarea (click fuori da campi prima)
- Listener attivo solo su Counter mode
- Console check: nessun errore JS

---

## 📊 Metriche di Successo

### Functional
- [ ] 100% route navigabili senza errori
- [ ] Client flow completo: Landing → Join → Waiting → Called → Thank You
- [ ] Admin flow completo: Login → Queue Management → Settings → Content → Analytics
- [ ] Tutte le API call successful (o error handling graceful)

### Performance
- [ ] Bundle < 1070 KB (~316 KB gzipped)
- [ ] First paint < 1.5s
- [ ] No console errors
- [ ] No memory leaks

### UX
- [ ] Mobile responsive (client e admin)
- [ ] Stessi stili dei progetti separati
- [ ] Empty states eleganti
- [ ] Loading states chiari

---

## 📝 Note Post-Testing

**Registra qui eventuali bug o miglioramenti identificati**:

1. [ ] Bug: ...
2. [ ] Miglioramento: ...
3. [ ] Performance issue: ...

---

## ✅ Sign-Off

**Tester**: _________________
**Data**: _________________
**Build Version**: _________________
**Ambiente**: Dev / Staging / Production

**Status**: [ ] PASS  [ ] FAIL  [ ] PASS con note

**Note finali**:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

**END OF TESTING GUIDE**
