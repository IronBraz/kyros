# Kyros - Frontend Applications (Fase 1)

**Ambito:** UI Admin (Control Room) e PWA Cliente (Concierge).
**Filosofia:** Extreme MVP - Branding testuale, Icone Lucide, CSS moderno (niente immagini).

---

## 1. Architettura: Single PWA Monolith

Per massimizzare la velocità di sviluppo durante l'MVP, Kyros utilizza un'unica codebase React ("Monolith Frontend") che serve sia l'Admin che il Cliente.

### Stack Tecnologico Finale
| Categoria | Tecnologia | Motivazione |
|-----------|------------|-------------|
| **Framework** | React 18.x (TS) | Standard, performance, ecosistema. |
| **Build Tool** | Vite 5.x | HMR istantaneo, build ottimizzata. |
| **Styling** | Tailwind CSS 3.x | Design system rapido e coerente. |
| **State** | Zustand | Leggero e semplice per la gestione real-time. |
| **Icons** | Lucide React | Icone vettoriali pulite e "lucide". |
| **Real-time** | Socket.io Client | Gestione eventi bidirezionali. |
| **HTTP** | Ky | Fetch wrapper moderno con retry. |

---

## 2. Design System Lite

### Palette Colori
*   **Deep Space (Background)**: `#0F172A` (Slate 900)
*   **Electric Teal (Primary)**: `#2DD4BF` (Teal 400)
*   **Soft Ghost (Text)**: `#F8FAFC` (Slate 50)
*   **Alert Red**: `#EF4444` (Red 500)

### Componenti Core
*   **Glass Card**: Sfondo semi-trasparente con blur per il feed marketing.
*   **Dynamic Button**: Feedback aptico (su mobile) e stati di loading integrati.

---

## 2.1 Empty States & Edge Cases

Ogni schermata gestisce elegantemente gli stati "vuoti":
*   **Coda Vuota (Cliente)**: "🎉 Sei il primo! Sarai servito a breve."
*   **Store Chiuso**: "⏸️ Al momento non accettiamo nuovi ticket."
*   **Nessun Cliente (Admin)**: Illustrazione zen + "Nessun cliente in attesa. ☕"

---

## 2.2 Accessibility Requirements (WCAG 2.1 AA)
*   **Contrasto**: Ratio minimo 4.5:1 per il testo.
*   **Touch Targets**: Minimo 44x44px per pulsanti mobile.
*   **Aria-Live**: Notifiche "polite" per aggiornamenti posizione in coda.

---

## 4. Admin Mode (Route `/control-room`)

### 4.0 Login Gate (Route `/control-room`)

Prima di accedere alla Control Room, l'utente deve superare il gate di autenticazione.

#### Flow di Accesso

```
[Utente visita /control-room]
         ↓
[Check localStorage.kyros_admin_session]
         ↓
┌─ Sessione valida? ────────────────────────┐
│                                            │
│ NO                          SÌ             │
│ ↓                           ↓              │
│ Mostra Login Gate           Verifica scadenza
│                             ↓              │
│                     ┌─ Scaduta? ──────┐   │
│                     │ SÌ      NO      │   │
│                     │ ↓       ↓       │   │
│                     │ Login   Dashboard   │
│                     │ Gate              │   │
└────────────────────────────────────────────┘
```

#### UI Login Gate

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌──────────────────┐                     │
│                    │    KYROS LOGO    │                     │
│                    └──────────────────┘                     │
│                                                             │
│                      CONTROL ROOM                           │
│                                                             │
│         ┌─────────────────────────────────────┐             │
│         │  Seleziona Store                 ▼  │             │
│         └─────────────────────────────────────┘             │
│                                                             │
│                  Inserisci codice accesso                   │
│                                                             │
│              ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐           │
│              │ ● │ │ ● │ │ ● │ │ ● │ │   │ │   │           │
│              └───┘ └───┘ └───┘ └───┘ └───┘ └───┘           │
│                                                             │
│              ┌─────┐ ┌─────┐ ┌─────┐                        │
│              │  1  │ │  2  │ │  3  │                        │
│              └─────┘ └─────┘ └─────┘                        │
│              ┌─────┐ ┌─────┐ ┌─────┐                        │
│              │  4  │ │  5  │ │  6  │                        │
│              └─────┘ └─────┘ └─────┘                        │
│              ┌─────┐ ┌─────┐ ┌─────┐                        │
│              │  7  │ │  8  │ │  9  │                        │
│              └─────┘ └─────┘ └─────┘                        │
│              ┌─────┐ ┌─────┐ ┌─────┐                        │
│              │  ⌫  │ │  0  │ │  →  │                        │
│              └─────┘ └─────┘ └─────┘                        │
│                                                             │
│                    ┌─────────────────┐                      │
│                    │  Codice errato  │  ← Toast errore      │
│                    └─────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Specifiche UI:**
- **PIN Pad**: Numeri grandi (touch-friendly, min 56x56px)
- **Input mascherato**: Mostra pallini (●) non numeri
- **Lunghezza PIN**: 4-6 caratteri (configurabile)
- **Feedback errore**: Shake animation + toast rosso
- **Feedback successo**: Breve flash verde → redirect a dashboard

**localStorage Schema:**
```json
{
  "kyros_admin_session": {
    "session_token": "uuid",
    "store_id": "uuid",
    "store_name": "Milano Centro",
    "expires_at": "2025-12-23T18:00:00Z",
    "authenticated_at": "2025-12-22T10:00:00Z"
  }
}
```

**Logout:**
- Icona logout in header Control Room (tutte le schermate)
- Click → conferma "Vuoi uscire?" → clear localStorage → redirect a Login Gate

### A. Kyros Concierge (Client PWA)
Interfaccia ultra-minimalista per il cliente in attesa.

#### A.1 Landing - Gestione Store Chiuso

Se il cliente scansiona QR quando `accepting_tickets = false`:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     STORE NAME                              │
│                                                             │
│                        ⏸️                                   │
│                                                             │
│           We're not accepting new                           │
│           customers at the moment.                          │
│                                                             │
│           Please speak to our staff.                        │
│                                                             │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │    Check Again    🔄    │                    │
│              └─────────────────────────┘                    │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Messaggio dal campo `closed_message` dello store
- Pulsante "Check Again" ri-chiama API ogni 30 secondi (auto-retry)
- Quando store riapre → transizione automatica a Landing normale

1.  **Landing**: Pulsante gigante "Prendi Numero" (solo se non ha già una sessione).
2.  **Waiting Room**:
    *   Header: Ticket Code (es. A-42) e Posizione.
    *   Body: Feed di card marketing/trivia.
    *   Footer: Pulsante "Abbandona Coda".

### B. Kyros Control Room (Admin/Staff)
Dashboard a 5 sezioni per la gestione dello store.
1.  **Counter**: Pulsante "Chiama Prossimo" e lista coda attuale.
2.  **Analytics**: KPI giornalieri (Ingressi, Attesa media).
3.  **Zones**: Gestione Entry Point e generazione QR.
4.  **Content**: Editor semplice per le Marketing Card.
5.  **Store Settings**: Configurazione parametri operativi (es. tempo medio servizio).

### E. Screen 5: Store Settings

*   **Tab 2: Queue Configuration**
    
    #### System Status Toggle (Hero Element)
    
    ```
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │   QUEUE STATUS                                              │
    │   ┌───────────────────────────────────────────────────────┐ │
    │   │                                                       │ │
    │   │   🟢 ACCEPTING CUSTOMERS              [━━━━━━━━━●]    │ │
    │   │                                                       │ │
    │   │   Status: Active • 5 in queue • ~10 min avg wait      │ │
    │   │                                                       │ │
    │   └───────────────────────────────────────────────────────┘ │
    │                                                             │
    │   When closed, customers will see:                          │
    │   ┌───────────────────────────────────────────────────────┐ │
    │   │ We're not accepting new customers at the moment.      │ │
    │   │ Please speak to our staff.                            │ │
    │   │ [________________________________________________] ✏️  │ │
    │   └───────────────────────────────────────────────────────┘ │
    │                                                             │
    │   ⚠️  5 customers still in queue will be served.           │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
    ```
    
    **Comportamento Toggle:**
    - **ON → OFF**: Warning "X clienti in coda verranno comunque serviti"
    - **OFF → ON**: Nessun warning, riattivazione immediata
    - **Visual Feedback**: 
      - ON: Badge verde "🟢 ACCEPTING"
      - OFF + coda > 0: Badge arancione "🟠 DRAINING" 
      - OFF + coda = 0: Badge rosso "🔴 CLOSED"