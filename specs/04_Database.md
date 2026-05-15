# Kyros - Database & Data Architecture (Fase 1)

**Ambito:** Schema SQL, Relazioni, Integrità dei dati e Multi-tenancy.
**Riferimenti:** Supporta le logiche definite in `01_Vision_e_Business.md` e `06_Frontend_PWA.md`.

---

## 1. Strategia di Multi-tenancy
Kyros utilizza un approccio **Shared Database, Shared Schema**. 
*   Ogni tabella critica contiene una colonna `company_id` o `store_id`.
*   L'isolamento dei dati è garantito a livello applicativo (n8n/Backend).

---

## 2. Schema SQL (Entità Core)

### A. Gerarchia Retail (Multi-Tenant)
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(255) NOT NULL, -- Es. "Brand X"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Es. "Milano Centro"
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'Europe/Rome',
    settings JSONB DEFAULT '{}', -- Flexible config (timeouts, features)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Struttura JSONB `stores.settings`

Il campo `settings` contiene la configurazione operativa dello store:

```json
{
  "queue": {
    "avg_service_time_minutes": 5,
    "ghost_timeout_minutes": 15,
    "max_active_tickets": 100,
    "accepting_tickets": true,
    "closed_message": "We're not accepting new customers at the moment. Please speak to our staff."
  },
  "display": {
    "welcome_message": "Benvenuto nel nostro store!",
    "call_sound": "ding-dong",
    "language": "it"
  },
  "notifications": {
    "low_queue_threshold": 3,
    "high_wait_alert_minutes": 20
  }
}
```

| Campo | Tipo | Default | Descrizione |
|-------|------|---------|-------------|
| `queue.avg_service_time_minutes` | INT | 5 | Tempo medio per cliente (per stima attesa) |
| `queue.ghost_timeout_minutes` | INT | 15 | Minuti di inattività prima che Janitor marchi "abandoned" |
| `queue.max_active_tickets` | INT | 100 | Limite ticket attivi contemporanei |
| `queue.accepting_tickets` | BOOL | true | Se false, blocca nuovi ingressi |
| `queue.closed_message` | STRING | (vedi sopra) | Messaggio mostrato quando `accepting_tickets = false` |
| `display.welcome_message` | STRING | - | Messaggio personalizzato landing page |
| `display.call_sound` | STRING | "ding-dong" | Suono notifica chiamata |
| `display.language` | STRING | "it" | Lingua default interfacce |
| `notifications.low_queue_threshold` | INT | 3 | Alert manager se coda scende sotto N |
| `notifications.high_wait_alert_minutes` | INT | 20 | Alert se attesa media supera N minuti |

### B. Infrastruttura Negozio (Physical Layout)
```sql
-- Punti di ingresso (QR/NFC)
CREATE TABLE entry_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, 
    slug VARCHAR(100) UNIQUE NOT NULL, 
    metadata JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Postazioni di servizio (Casse/Sportelli)
CREATE TABLE service_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Es. "Cassa 1"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### C. Logica della Coda (Sessions)
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    entry_point_id UUID REFERENCES entry_points(id),
    service_point_id UUID REFERENCES service_points(id), -- WHICH DESK served it
    
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'called', 'serving', 'finished', 'missed', 'cancelled', 'abandoned'
    ticket_code VARCHAR(10) NOT NULL, -- Es. "A-042"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Entry in system
    waiting_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Start waiting
    called_at TIMESTAMP WITH TIME ZONE, -- Buzzed by operator
    served_at TIMESTAMP WITH TIME ZONE, -- Actual start of service
    finished_at TIMESTAMP WITH TIME ZONE, -- End of service
    missed_at TIMESTAMP WITH TIME ZONE, -- Marked as missed
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Heartbeat
    
    device_info JSONB DEFAULT '{}', -- {browser, os, screen_res}
    ai_context JSONB DEFAULT '{}', -- Dynamic data for AI recommendations
    sentiment_score INT DEFAULT 0, -- 1: Positivo, 0: Neutro, -1: Negativo
    language VARCHAR(5) DEFAULT 'it'
);
```

### C.1 Generazione Ticket Code

Il sistema genera automaticamente codici ticket human-readable nel formato `{PREFISSO}-{NUMERO}`:

*   **Formato**: `A-001`, `A-002`, ... `A-999`, poi `B-001`, etc.
*   **Reset**: Il contatore si azzera ogni giorno a mezzanotte (timezone dello store).
*   **Unicità**: Garantita per combinazione `store_id + data + numero`.
*   **Generazione**: Funzione PostgreSQL `generate_ticket_code(store_id)` chiamata all'inserimento sessione.

### D. Marketing & Concierge Feed
```sql
CREATE TABLE marketing_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- NULLABLE for GLOBAL
    scope VARCHAR(20) DEFAULT 'LOCAL', -- 'GLOBAL' o 'LOCAL'
    
    type VARCHAR(20) NOT NULL, -- 'PROMO', 'TRIVIA', 'BRAND', 'INFO'
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL, 
    
    -- Optimized: No external images. Use CSS colors & Icons.
    theme_color VARCHAR(20) DEFAULT 'blue', -- CSS theme class
    icon_name VARCHAR(50) DEFAULT 'info',   -- Lucide icon name
    action_url TEXT, 
    
    priority INT DEFAULT 0, 
    is_active BOOLEAN DEFAULT true,
    
    -- Scheduling
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Indici per Performance

Gli indici sono progettati per ottimizzare le query più frequenti:

### Query Operative (Real-time)
*   `idx_sessions_store_status`: Lookup veloce sessioni per stato.
*   `idx_sessions_store_waiting`: Partial index solo su `waiting` per FIFO call.
*   `idx_sessions_cleanup`: Per job Janitor (identifica ghost sessions tramite `last_seen_at`).

### Query Analitiche
*   `idx_sessions_store_created`: Report cronologici per store.
*   `idx_sessions_service_point`: Performance per singola cassa.

### Lookup Veloci
*   `idx_entry_points_slug`: Risoluzione QR code → Entry Point.
*   `idx_entry_points_store`: Lista zone per store.
*   `idx_marketing_active`: Feed attivo ordinato per priorità.
*   `idx_marketing_global`: Card globali del brand.
*   `idx_ticket_seq_store`: Generazione ticket code.

### Note sulle Performance
*   **Partial Indexes**: Usati dove possibile per ridurre dimensione indice.
*   **GIN Index**: Su `ai_context` JSONB per future query semantiche.
