-- ==========================================
-- Kyros MVP Schema - Fase 1
-- Allineato a SPECS/04_Database.md (v2025-12-22)
--
-- Requisito reale: PostgreSQL >= 12. Misurato, non dedotto.
-- L'intestazione diceva "Optimized for Postgres 18.1" ma nulla qui richiede PG18:
-- uuid_generate_v7() e una funzione plpgsql scritta a mano (non usa la uuidv7() nativa
-- di PG18), le colonne generate sono PG12+, FOR UPDATE SKIP LOCKED e PG9.5+, e pgcrypto
-- e disponibile su Neon. Questo DDL si applica su Neon senza modifiche.
--
-- ATTENZIONE FUSO ORARIO: Neon gira in UTC, il Postgres locale girava su Europe/Rome.
-- Ogni "data di oggi" qui dentro va calcolata nel fuso dello store, mai con CURRENT_DATE.
-- ==========================================

-- 0. EXTENSIONS & UTILITIES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- UUID v7 FUNCTION (Time-sortable for high performance)
CREATE OR REPLACE FUNCTION uuid_generate_v7() 
RETURNS uuid 
AS $$
BEGIN
  RETURN encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3) from 1 for 6),
        52, 1
      ),
      53, 1
    ),
    'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- 1. TENANCY HIERARCHY
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(255) NOT NULL, -- Es. "Brand X"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Es. "Milano Centro"
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'Europe/Rome',
    settings JSONB DEFAULT '{}', -- Flexible config (timeouts, features)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. STAFF & OPERATORS
-- REMOVED: operators table (Simplified for MVP - No individual staff tracking)

-- 3. INFRASTRUCTURE (Points)
CREATE TABLE IF NOT EXISTS entry_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, 
    slug VARCHAR(100) UNIQUE NOT NULL, 
    metadata JSONB DEFAULT '{}', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Es. "Cassa 1"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. QUEUE LOGIC (Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    entry_point_id UUID REFERENCES entry_points(id),
    service_point_id UUID REFERENCES service_points(id), 
    
    -- CHECK aggiunto nella migrazione a Neon: prima era una VARCHAR libera, quindi un typo
    -- in un workflow scriveva uno stato inesistente e la sessione spariva dalla board
    -- senza che niente segnalasse l'errore.
    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'called', 'serving', 'finished', 'missed', 'cancelled', 'abandoned')),

    -- NON esiste nessun trigger che lo popola, contrariamente a quanto dicono CLAUDE.md e
    -- database/README.md. Il chiamante deve invocare generate_ticket_code(store_id).
    ticket_code VARCHAR(10) NOT NULL, -- Es. "A-042"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    waiting_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP WITH TIME ZONE, 
    served_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE, 
    missed_at TIMESTAMP WITH TIME ZONE, 
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    device_info JSONB DEFAULT '{}', 
    ai_context JSONB DEFAULT '{}', 
    sentiment_score INT DEFAULT 0, -- 1: Positivo, 0: Neutro, -1: Negativo
    language VARCHAR(5) DEFAULT 'it',
    
    -- Generated column for easy analytics
    client_browser VARCHAR(50) GENERATED ALWAYS AS (device_info ->> 'browser') STORED
);

-- 5. MARKETING & CONCIERGE FEED
CREATE TABLE IF NOT EXISTS marketing_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- Obbligatorio (Proprietario brand)
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,   -- NULLABLE: Se NULL, è GLOBAL (tutto il brand)
    scope VARCHAR(20) DEFAULT 'LOCAL', -- 'GLOBAL' o 'LOCAL'
    
    type VARCHAR(20) NOT NULL, -- 'PROMO', 'TRIVIA', 'BRAND', 'INFO'
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL, 
    
    -- Optimized: No external images
    theme_color VARCHAR(20) DEFAULT 'blue', 
    icon_name VARCHAR(50) DEFAULT 'info',
    
    action_url TEXT, 
    priority INT DEFAULT 0, 
    is_active BOOLEAN DEFAULT true,
    
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- L'API PATCH /admin/marketing-cards scriveva gia questa colonna, che pero non esisteva.
    -- Bug noto dal CHANGELOG 1.2.0, chiuso qui.
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5B. TICKET CODE SEQUENCE (Daily Reset)
-- Sequence per generare numeri progressivi giornalieri per store
CREATE TABLE IF NOT EXISTS ticket_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    prefix CHAR(1) NOT NULL DEFAULT 'A', -- Prefisso alfabetico
    current_number INT NOT NULL DEFAULT 0,
    last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(store_id)
);

-- Funzione per generare il prossimo ticket code
--
-- Due correzioni rispetto alla versione girata su n8n/Postgres locale:
--
-- 1. FUSO ORARIO. Prima usava CURRENT_DATE, cioe la data del server. Andava bene finche il
--    server girava su Europe/Rome. Neon gira in UTC, quindi in ora legale italiana la
--    "mezzanotte" del server cade alle 02:00 italiane: senza questa correzione i ticket
--    delle 00:00-02:00 continuerebbero la numerazione del giorno prima.
--    Ora la data e calcolata nel fuso dello store.
--
-- 2. ROLLOVER. Il commento prometteva "A-999 poi B-001" da sempre, ma il codice faceva
--    solo current_number + 1: il ticket dopo A-999 era "A-1000", 6 caratteri, fuori dal
--    formato atteso dalla UI.
CREATE OR REPLACE FUNCTION generate_ticket_code(p_store_id UUID)
RETURNS VARCHAR(10) AS $$
DECLARE
    v_prefix CHAR(1);
    v_number INT;
    v_today  DATE;
BEGIN
    -- Data di oggi nel fuso dello store, non in quello del server.
    -- COALESCE: se lo store non esiste o non ha timezone, non vogliamo un NULL silenzioso
    -- che farebbe fallire ogni confronto piu sotto.
    SELECT (NOW() AT TIME ZONE COALESCE(s.timezone, 'Europe/Rome'))::date
      INTO v_today
      FROM stores s
     WHERE s.id = p_store_id;

    IF v_today IS NULL THEN
        RAISE EXCEPTION 'generate_ticket_code: store % not found', p_store_id;
    END IF;

    INSERT INTO ticket_sequences (store_id, prefix, current_number, last_reset_date)
    VALUES (p_store_id, 'A', 1, v_today)
    ON CONFLICT (store_id) DO UPDATE SET
        current_number = CASE
            -- Giorno nuovo: riparte da 1
            WHEN ticket_sequences.last_reset_date < v_today THEN 1
            -- Stesso giorno ma sequenza esaurita: riparte da 1 con il prefisso successivo
            WHEN ticket_sequences.current_number >= 999 THEN 1
            ELSE ticket_sequences.current_number + 1
        END,
        prefix = CASE
            WHEN ticket_sequences.last_reset_date < v_today THEN 'A'
            -- Z e l'ultimo: si torna ad A. Servirebbero 25.974 ticket in un solo giorno
            -- nello stesso store per arrivarci; a quel punto si avrebbero codici duplicati,
            -- ma e comunque meglio di un carattere non alfabetico nella UI.
            WHEN ticket_sequences.current_number >= 999 THEN
                CASE WHEN ticket_sequences.prefix = 'Z' THEN 'A'
                     ELSE chr(ascii(ticket_sequences.prefix) + 1) END
            ELSE ticket_sequences.prefix
        END,
        last_reset_date = v_today
    RETURNING prefix, current_number INTO v_prefix, v_number;

    -- Formato: A-001, A-002, ... A-999, poi B-001, ...
    RETURN v_prefix || '-' || LPAD(v_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Data di oggi nel fuso di uno store. Serve a tutte le query "di oggi" (conteggi serviti,
-- persi, reset delle sequenze) che sotto n8n usavano CURRENT_DATE o DATE(created_at) e che
-- su Neon slitterebbero di 1-2 ore.
CREATE OR REPLACE FUNCTION store_today(p_store_id UUID)
RETURNS DATE AS $$
    SELECT (NOW() AT TIME ZONE COALESCE(s.timezone, 'Europe/Rome'))::date
      FROM stores s
     WHERE s.id = p_store_id;
$$ LANGUAGE sql STABLE;

-- 5C. ADMIN ACCESS (Simple Gate Code Authentication)
CREATE TABLE IF NOT EXISTS admin_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    -- Era `access_code VARCHAR(20)`, cioe il PIN in chiaro nel database.
    -- Ora contiene solo l'hash, nel formato scrypt$<salt-hex>$<hash-hex> (server/lib/pin.ts).
    -- Conseguenza sul login: non si puo piu fare il lookup in SQL con WHERE access_code = $2.
    -- Si selezionano le righe attive dello store e si verifica in JS, una per una.
    access_code_hash TEXT NOT NULL,
    label VARCHAR(50) DEFAULT 'Default', -- Es. "Codice Manager", "Codice Cassa"
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: un solo codice attivo per label per store
    UNIQUE(store_id, label)
);

-- Indice per lookup veloce durante login
CREATE INDEX IF NOT EXISTS idx_admin_access_store ON admin_access(store_id, is_active) WHERE is_active = true;

-- 6. INDEXES & OPTIMIZATIONS

-- Sessions: Query operative real-time
CREATE INDEX IF NOT EXISTS idx_sessions_store_status ON sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_store_waiting ON sessions(store_id, created_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup ON sessions(status, last_seen_at) WHERE status IN ('waiting', 'called');

-- Sessions: Analytics e reporting
CREATE INDEX IF NOT EXISTS idx_sessions_store_created ON sessions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_service_point ON sessions(service_point_id, created_at DESC) WHERE service_point_id IS NOT NULL;

-- Sessions: AI Context (GIN per query JSONB)
CREATE INDEX IF NOT EXISTS idx_sessions_ai_context ON sessions USING GIN (ai_context);

-- Entry Points: Lookup veloce QR
-- idx_entry_points_slug rimosso: il vincolo `slug VARCHAR(100) UNIQUE` crea gia da solo un
-- indice B-tree su slug. Ne teneva due identici, con doppio costo di scrittura e zero
-- guadagno in lettura.
CREATE INDEX IF NOT EXISTS idx_entry_points_store ON entry_points(store_id);

-- Marketing Cards: Feed attivo
CREATE INDEX IF NOT EXISTS idx_marketing_active ON marketing_cards(store_id, is_active, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_marketing_global ON marketing_cards(tenant_id, scope, is_active) WHERE scope = 'GLOBAL' AND is_active = true;

-- Ticket Sequences: Lookup per store
CREATE INDEX IF NOT EXISTS idx_ticket_seq_store ON ticket_sequences(store_id);

-- 5D. AI TABLES (Pilot Phase)
-- Incorporated from database/migrations/2026_05_pilot_ai.sql on 2026-06-01

CREATE TABLE IF NOT EXISTS ai_conversations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v7(),
    session_id      UUID        UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    wiki_version    VARCHAR(20),
    message_count   INT         DEFAULT 0,
    last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v7(),
    conversation_id UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT        NOT NULL,
    tokens_in       INT,
    tokens_out      INT,
    model           VARCHAR(40),
    latency_ms      INT,
    flags           JSONB       DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_summaries (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v7(),
    conversation_id UUID        UNIQUE REFERENCES ai_conversations(id) ON DELETE CASCADE,
    summary         TEXT,
    sentiment       SMALLINT    CHECK (sentiment IN (-1, 0, 1)),
    flags           JSONB       DEFAULT '[]',
    model           VARCHAR(40),
    status          VARCHAR(20) DEFAULT 'pending'
                                CHECK (status IN ('pending', 'generating', 'ready', 'error')),
    generated_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_usage_monthly (
    id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v7(),
    year_month           CHAR(7)      NOT NULL UNIQUE,
    total_input_tokens   BIGINT       NOT NULL DEFAULT 0,
    total_output_tokens  BIGINT       NOT NULL DEFAULT 0,
    total_cost_eur       NUMERIC(8,4) NOT NULL DEFAULT 0,
    last_updated         TIMESTAMPTZ  DEFAULT NOW()
);

-- Bidirectional 1:1 link between sessions and ai_conversations
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS ai_conversation_id UUID UNIQUE REFERENCES ai_conversations(id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv
    ON ai_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_status
    ON ai_summaries(status)
    WHERE status IN ('pending', 'generating');

-- Seed current month budget row
INSERT INTO ai_usage_monthly (year_month)
VALUES (TO_CHAR(NOW(), 'YYYY-MM'))
ON CONFLICT (year_month) DO NOTHING;

-- 5E. SERVERLESS SUPPORT TABLES
-- Aggiunte con la migrazione a Vercel + Neon (2026-08). Non esistevano sotto n8n, dove
-- il janitor era un cron dedicato e non c'era alcun rate limiting.

-- Lock del janitor "lazy".
--
-- Su Vercel Hobby i cron sono al massimo 2 e solo giornalieri, quindi "*/5 * * * *" non
-- esiste. Il janitor gira invece dentro GET /admin/queue/status, che la Control Room chiama
-- ogni 2-5 secondi, e questa tabella e cio che impedisce a quelle centinaia di chiamate di
-- lanciarlo centinaia di volte.
--
-- L'acquisizione e una singola UPDATE ... WHERE last_run_at < NOW() - interval: o aggiorna
-- una riga (e il chiamante ha il lock) o zero righe (e qualcun altro l'ha appena preso).
-- Atomica senza bisogno di una transazione esplicita, quindi funziona sul driver HTTP.
--
-- Effetto netto: in demo il janitor gira ogni 60 secondi invece che ogni 5 minuti.
CREATE TABLE IF NOT EXISTS job_runs (
    job         TEXT        PRIMARY KEY,
    last_run_at TIMESTAMPTZ NOT NULL
);

-- Token bucket per il rate limiting, su Postgres invece che su Redis.
--
-- Un bucket per (azione + soggetto), es. "pin:<store_id>:<ip_hash>". L'IP e sempre hashato
-- con KYROS_SESSION_SECRET prima di finire qui: non memorizziamo IP in chiaro
-- (coerente con specs/09_Security_Privacy.md).
--
-- Il motivo principale: POST /admin/auth/verify. Un PIN a 4 cifre sono 10.000 combinazioni,
-- sotto n8n provabili senza alcun limite.
CREATE TABLE IF NOT EXISTS rate_limits (
    bucket   TEXT        PRIMARY KEY,
    tokens   INT         NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
);

-- Le righe scadute non vengono mai lette (la logica le tratta come bucket pieni), ma senza
-- questo indice la pulizia periodica dovrebbe fare un seq scan sull'intera tabella.
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);