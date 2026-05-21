---
ID: F2
TASK: Database — AI Pilot tables migration
OWNER: Claude
STATUS: DONE
PHASE: Pilot
DEPENDS_ON: (none — can run in parallel with F1)
ESTIMATE: 2-3 hours
---

## 1. Contesto e Obiettivo

Creare le 3 tabelle necessarie per persistere le conversazioni AI e i loro riassunti/sentiment.

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F2
- **Memoria progetto:** `project-pilot-approach-decision`
- **Obiettivo:** Avere tabelle `ai_conversations`, `ai_messages`, `ai_summaries` con indici e FK pronte, senza toccare lo schema MVP esistente.

## 2. Specifiche Tecniche

### Nuovo file di migration

`database/migrations/2026_05_pilot_ai.sql` (creare la sottocartella `migrations/`).

**NON modificare** `database/kyros_schema.sql` che è lo snapshot iniziale dell'MVP — le migration sono additive.

### Tabelle

```sql
ai_conversations (
  id UUID PK uuid_generate_v7(),
  session_id UUID UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  wiki_version VARCHAR(20),
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ
)

ai_messages (
  id UUID PK uuid_generate_v7(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) CHECK (role IN ('user','assistant','system')),
  content TEXT,
  tokens_in INT,
  tokens_out INT,
  model VARCHAR(40),
  latency_ms INT,
  flags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)

ai_summaries (
  id UUID PK uuid_generate_v7(),
  conversation_id UUID UNIQUE REFERENCES ai_conversations(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment SMALLINT CHECK (sentiment IN (-1, 0, 1)),
  flags JSONB DEFAULT '[]',
  model VARCHAR(40),
  status VARCHAR(20) DEFAULT 'pending',  -- pending|generating|ready|error
  generated_at TIMESTAMPTZ
)

ai_usage_monthly (
  id UUID PK uuid_generate_v7(),
  year_month CHAR(7) NOT NULL UNIQUE,    -- '2026-05'
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_eur NUMERIC(8,4) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
)
```

> **Nota su `ai_usage_monthly`** (aggiunta 2026-05-21 dal piano audit, decision D3): tabella di running total per il **budget cap €3/mese** con hard kill-switch in n8n. Workflow F3 leggono questa row per il mese corrente prima di chiamare Anthropic; se `total_cost_eur >= 3.00`, ritornano canned response senza chiamare l'API. UPDATE eseguito dopo ogni chiamata Anthropic riuscita (chat + summary).

### Modifica a `sessions`

```sql
ALTER TABLE sessions ADD COLUMN ai_conversation_id UUID UNIQUE REFERENCES ai_conversations(id);
```

> **Nota su `UNIQUE`** (aggiunta 2026-05-21 dal piano audit, B5): senza UNIQUE due session potrebbero erroneamente linkare alla stessa conversation. La FK lato `ai_conversations.session_id` è già UNIQUE, qui chiudiamo la simmetria.

### Indici

```sql
CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, created_at);
CREATE INDEX idx_ai_summaries_status ON ai_summaries(status) WHERE status IN ('pending', 'generating');
```

### Seed iniziale

```sql
-- Inizializza row del mese corrente per il budget counter
INSERT INTO ai_usage_monthly (year_month) VALUES (TO_CHAR(NOW(), 'YYYY-MM'))
ON CONFLICT (year_month) DO NOTHING;
```

### File Coinvolti

- `database/migrations/2026_05_pilot_ai.sql` — Nuovo
- `specs/04_Database.md` — Modifica (aggiungere sezione "AI Pilot Tables")

## 3. Vincoli e Convenzioni

- UUIDv7 via `uuid_generate_v7()` (già definita nello schema MVP)
- FK ON DELETE CASCADE per propagare cleanup
- Migration applicabile via `psql -U <user> -d kyros_db -f database/migrations/2026_05_pilot_ai.sql`

## 4. Definition of Done

- [ ] File `database/migrations/2026_05_pilot_ai.sql` creato
- [ ] Le **4 tabelle** (ai_conversations, ai_messages, ai_summaries, ai_usage_monthly) si creano senza errori su un DB vuoto
- [ ] FK verificate (`\d ai_conversations` mostra reference a `sessions`)
- [ ] `\d sessions` mostra `ai_conversation_id UUID UNIQUE`
- [ ] `ai_summaries.status` CHECK constraint accetta `pending|generating|ready|error`
- [ ] Indici creati (incluso index parziale su `pending|generating`)
- [ ] Seed iniziale di `ai_usage_monthly` per il mese corrente eseguito
- [ ] Sezione "AI Pilot Tables" aggiunta a `specs/04_Database.md` (includere `ai_usage_monthly`)
- [ ] (Opzionale) Smoke test: `INSERT` di una row su ogni tabella + `SELECT` con JOIN

## Note per la prossima sessione

- F2 è completamente indipendente: si può fare prima, durante, o dopo F1.
- Una volta DONE, F3 (chat backend) può partire.
