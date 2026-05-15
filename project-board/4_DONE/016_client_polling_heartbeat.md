---
ID: 016
TASK: Client PWA - Polling Status + Heartbeat
OWNER: Unassigned
STATUS: TODO
---

**COSA:** Implementare polling ogni 3 sec per rilevare cambio status + timer heartbeat ogni 60 sec

**PERCHÉ:** Client deve rilevare quando Admin lo chiama (status waiting → called) + inviare heartbeat per non essere marcato abandoned

**COME:**

**STEP 1 - Implementare Polling in WaitingRoom**:
File: `pages/WaitingRoom.tsx`

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSessionStore } from '../store/useSessionStore';

function WaitingRoom() {
  const navigate = useNavigate();
  const { sessionId, setStatus, setPosition } = useSessionStore();

  // POLLING STATUS ogni 3 secondi
  useEffect(() => {
    if (!sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const session = await api.getSession(sessionId);

        // Rileva cambio status
        if (session.status === 'called') {
          setStatus('called');
          navigate('/your-turn'); // Redirect a schermata "È il tuo turno!"
        } else if (session.status === 'abandoned' || session.status === 'missed') {
          setStatus('finished');
          navigate('/thank-you');
        } else {
          // Update position se cambiata
          if (session.position !== undefined) {
            setPosition(session.position);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // 3 secondi

    return () => clearInterval(pollInterval);
  }, [sessionId, navigate, setStatus, setPosition]);

  // ... rest of component
}
```

**STEP 2 - Implementare Heartbeat Timer**:
Stesso file `WaitingRoom.tsx`:

```typescript
// HEARTBEAT ogni 60 secondi
useEffect(() => {
  if (!sessionId || status !== 'waiting') return;

  const heartbeatInterval = setInterval(async () => {
    try {
      const success = await api.sendHeartbeat(sessionId);
      if (!success) {
        console.warn('Heartbeat failed');
      }
    } catch (err) {
      console.error('Heartbeat error:', err);
    }
  }, 60000); // 60 secondi

  return () => clearInterval(heartbeatInterval);
}, [sessionId, status]);
```

**Acceptance Criteria:**
- [ ] WaitingRoom contiene polling interval 3 sec
- [ ] Polling chiama api.getSession(sessionId) ogni 3 sec
- [ ] Se status === 'called' → navigate('/your-turn')
- [ ] Heartbeat interval separato ogni 60 sec
- [ ] TypeScript compila: npm run build OK
- [ ] DevTools Network: richieste GET ogni 3 sec visibili
- [ ] DB: last_seen_at aggiornato ogni minuto
- [ ] Test cambio status: latenza massima 3 sec (accettabile)

**SE FALLISCE:**
- **Polling loop infinito**: Verifica clearInterval in cleanup effect
- **Heartbeat non parte**: Controlla condition status === 'waiting'
- **Navigate non funziona**: Import useNavigate da react-router-dom
- **API 404**: Workflow 008 (GET /sessions/:id) non implementato

**Tempo Stimato:** 30-45 min

**Dipendenze:** Task 015 (api.ts), Task 008 (GET /sessions/:id endpoint)

**Riferimenti - CROSS CHECK:**
- **Polling pattern**: Standard React useEffect cleanup
- **Heartbeat spec**: SPECS/05_Infra_Architecture.md § "Client Heartbeat"

**Note & Log:**
