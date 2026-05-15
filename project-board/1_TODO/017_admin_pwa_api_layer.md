---
ID: 017
TASK: Admin PWA - Creare API Client Layer
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Sostituire mock data Admin con chiamate API reali (auth, call-next, queue, settings)

**PERCHÉ:** Admin Control Room usa `constants.ts` con dati fake. Deve chiamare n8n workflows per funzionare

**COME:**

**STEP 1 - Creare lib/api.ts**:
File: `OUTPUT/pwa/BACK/Kyros---Admin/lib/api.ts`

Contenuto:
```typescript
const API_BASE = 'https://your-domain.example.com/api/v1/admin';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export const adminApi = {
  async getStores() {
    const res = await fetch(`${API_BASE}/auth/stores`);
    const json: ApiResponse<{stores: any[]}> = await res.json();
    return json.data?.stores || [];
  },

  async verifyPin(storeId: string, accessCode: string) {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: storeId, access_code: accessCode })
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Invalid PIN');

    // Store session in localStorage
    localStorage.setItem('kyros_admin_session', JSON.stringify({
      session_token: json.data.session_token,
      store_id: storeId,
      store_name: json.data.store_name,
      expires_at: json.data.expires_at
    }));

    return json.data;
  },

  async callNext(storeId: string, servicePointId: string) {
    const res = await fetch(`${API_BASE}/queue/call-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: storeId, service_point_id: servicePointId })
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success) {
      if (json.error?.code === 'NO_CUSTOMERS_WAITING') {
        throw new Error('Nessun cliente in attesa');
      }
      throw new Error(json.error?.message || 'Call next failed');
    }
    return json.data;
  },

  async getCurrentQueue(storeId: string) {
    const res = await fetch(`${API_BASE}/queue/current?store_id=${storeId}`);
    const json: ApiResponse<{queue: any[]}> = await res.json();
    return json.data?.queue || [];
  },

  async updateStoreSettings(storeId: string, settings: any) {
    const res = await fetch(`${API_BASE}/stores/${storeId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const json: ApiResponse<any> = await res.json();
    return json.data;
  },

  async getQueueStatus(storeId: string) {
    const res = await fetch(`${API_BASE}/stores/${storeId}/queue/status`);
    const json: ApiResponse<any> = await res.json();
    return json.data;
  }
};
```

**STEP 2 - Sostituire Mock nei Componenti**:

Files da modificare:
- `components/LoginGate.tsx` → usa `adminApi.getStores()` e `adminApi.verifyPin()`
- `components/CounterMode.tsx` → usa `adminApi.callNext()` e `adminApi.getCurrentQueue()`
- `components/SettingsMode.tsx` → usa `adminApi.updateStoreSettings()`

Rimuovi import `constants.ts` dove non più necessario.

**STEP 3 - Session Management**:
Aggiungere check expiry in `App.tsx`:
```typescript
useEffect(() => {
  const session = localStorage.getItem('kyros_admin_session');
  if (session) {
    const { expires_at } = JSON.parse(session);
    if (new Date(expires_at) < new Date()) {
      localStorage.removeItem('kyros_admin_session');
      // redirect to login
    }
  }
}, []);
```

**Acceptance Criteria:**
- [ ] File `lib/api.ts` creato con 6 metodi
- [ ] LoginGate usa `adminApi.verifyPin()` (no PIN hardcoded)
- [ ] CounterMode usa `adminApi.callNext()` per "Chiama Prossimo"
- [ ] TypeScript compila: `npm run build` OK
- [ ] Test dev: Login con PIN reale → session_token salvato in localStorage
- [ ] Test dev: Click "Chiama Prossimo" → API chiamata visibile in Network tab
- [ ] Error handling: PIN errato → mostra messaggio errore

**SE FALLISCE:**
- **CORS error**: n8n webhook CORS disabled → abilita in settings
- **PIN hardcoded ancora**: Rimuovi `if (code === '1234')` logic
- **Session expiry non funziona**: Controlla formato ISO `expires_at`

**Tempo Stimato:** 45 min - 1 ora

**Dipendenze:** Task 009-011 (Admin API workflows)

**Riferimenti - CROSS CHECK:**
- **API spec**: SPECS/05_Infra_Architecture.md § "Admin API"
- **Code esempio**: Piano FASE 4 § 4.5
- **HANDOFF**: § 4.5 Admin API Client

**Note & Log:**
