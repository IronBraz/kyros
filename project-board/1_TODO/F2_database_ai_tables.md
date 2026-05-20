---
ID: F2
TASK: Database — AI Pilot tables migration
OWNER: Claude (next session)
STATUS: TODO
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
  status VARCHAR(20) DEFAULT 'pending',  -- pending|ready|error
  generated_at TIMESTAMPTZ
)
```

### Modifica a `sessions`

```sql
ALTER TABLE sessions ADD COLUMN ai_conversation_id UUID REFERENCES ai_conversations(id);
```

### Indici

```sql
CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, created_at);
CREATE INDEX idx_ai_summaries_status ON ai_summaries(status) WHERE status = 'pending';
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
- [ ] Le 3 tabelle si creano senza errori su un DB vuoto
- [ ] FK verificate (`\d ai_conversations` mostra reference a `sessions`)
- [ ] Indici creati
- [ ] Sezione "AI Pilot Tables" aggiunta a `specs/04_Database.md`
- [ ] (Opzionale) Smoke test: `INSERT` di una row su ogni tabella + `SELECT` con JOIN

## Note per la prossima sessione

- F2 è completamente indipendente: si può fare prima, durante, o dopo F1.
- Una volta DONE, F3 (chat backend) può partire.
