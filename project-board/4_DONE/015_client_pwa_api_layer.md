---
ID: 015
TASK: Client PWA - Creare API Client Layer
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Sostituire mock API con layer reale che chiama endpoint n8n implementati

**PERCHÉ:** Client PWA attualmente usa `mockApi.ts` con setTimeout fake. Deve chiamare API vere per funzionare

**COME:**

**STEP 1 - Creare lib/api.ts**:
File: `OUTPUT/pwa/FRONT/Kyros/lib/api.ts`

Contenuto (TypeScript):
```typescript
const API_BASE = 'https://kyros.neuroforge.club/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: any };
  meta?: { timestamp: string; request_id: string };
}

export const api = {
  async createSession(entryPointSlug: string) {
    const res = await fetch(`${API_BASE}/client/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_point_slug: entryPointSlug })
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'API Error');
    return json.data!;
  },

  async getSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/client/sessions/${sessionId}`);
    const json: ApiResponse<any> = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Session not found');
    return json.data!;
  },

  async sendHeartbeat(sessionId: string) {
    const res = await fetch(`${API_BASE}/client/sessions/${sessionId}/heartbeat`, {
      method: 'POST'
    });
    const json = await res.json();
    return json.success;
  },

  async abandonSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/client/sessions/${sessionId}/abandon`, {
      method: 'POST'
    });
    const json = await res.json();
    return json.success;
  }
};
```

**STEP 2 - Sostituire import nei componenti**:

Cerca in tutti i file `.tsx` in `OUTPUT/pwa/FRONT/Kyros/`:
- OLD: `import { mockApi } from '../lib/mockApi'`
- NEW: `import { api } from '../lib/api'`

Files probabili da modificare:
- `pages/LandingPage.tsx`
- `pages/WaitingRoom.tsx`
- `pages/YourTurn.tsx`

**STEP 3 - Update usage**:
- OLD: `mockApi.createSession(...)`
- NEW: `api.createSession(...)`

**STEP 4 - Gestione errori**:
Aggiungere try/catch dove serve:
```typescript
try {
  const sessionData = await api.createSession(slug);
  // handle success
} catch (err) {
  console.error('API Error:', err);
  // show error to user
}
```

**Acceptance Criteria:**
- [ ] File `lib/api.ts` creato con 4 metodi
- [ ] Import `mockApi` rimossi da tutti i componenti
- [ ] Import `api` aggiunto dove necessario
- [ ] TypeScript compila senza errori: `npm run build` (no errori TS)
- [ ] Test manuale: `npm run dev` → apri browser → NO crash, API chiamate visibili in Network tab
- [ ] (Non testare funzionamento end-to-end ancora, solo che compila e chiama)

**SE FALLISCE:**
- **TS2307 Cannot find module**: Path import errato → verifica `'../lib/api'` vs `'@/lib/api'`
- **Fetch CORS error**: n8n webhook CORS non abilitato → settings webhook in n8n
- **401/403 errors**: Normale se API non implementate ancora (task 008 deve essere DONE)

**Tempo Stimato:** 30-45 min

**Dipendenze:** Task 013 (PWA deployed), Task 008 (Client API workflows) per test funzionale

**Riferimenti - CROSS CHECK:**
- **API spec**: SPECS/05_Infra_Architecture.md § "Client API"
- **Codice esempio**: Piano FASE 4 § 4.1 (api.ts completo)
- **HANDOFF**: § 4.1 Client API Layer

**Note & Log:**
