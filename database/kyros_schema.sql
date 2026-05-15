-- ==========================================
-- Kyros MVP Schema - Fase 1
-- Allineato a SPECS/04_Database.md (v2025-12-22)
-- Optimized for Postgres 18.1 (UUID v7 & JSONB)
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
    
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'called', 'serving', 'finished', 'missed', 'cancelled', 'abandoned'
    ticket_code VARCHAR(10) NOT NULL, -- Es. "A-042" - Generato da trigger/app
    
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
CREATE OR REPLACE FUNCTION generate_ticket_code(p_store_id UUID)
RETURNS VARCHAR(10) AS $$
DECLARE
    v_prefix CHAR(1);
    v_number INT;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Inserisci o aggiorna la sequence per questo store
    INSERT INTO ticket_sequences (store_id, prefix, current_number, last_reset_date)
    VALUES (p_store_id, 'A', 1, v_today)
    ON CONFLICT (store_id) DO UPDATE SET
        current_number = CASE 
            WHEN ticket_sequences.last_reset_date < v_today THEN 1
            ELSE ticket_sequences.current_number + 1
        END,
        last_reset_date = v_today
    RETURNING prefix, current_number INTO v_prefix, v_number;
    
    -- Formato: A-001, A-002, ... A-999, poi B-001, etc.
    RETURN v_prefix || '-' || LPAD(v_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5C. ADMIN ACCESS (Simple Gate Code Authentication)
CREATE TABLE IF NOT EXISTS admin_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    access_code VARCHAR(20) NOT NULL, -- PIN o password semplice
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
CREATE INDEX IF NOT EXISTS idx_entry_points_slug ON entry_points(slug);
CREATE INDEX IF NOT EXISTS idx_entry_points_store ON entry_points(store_id);

-- Marketing Cards: Feed attivo
CREATE INDEX IF NOT EXISTS idx_marketing_active ON marketing_cards(store_id, is_active, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_marketing_global ON marketing_cards(tenant_id, scope, is_active) WHERE scope = 'GLOBAL' AND is_active = true;

-- Ticket Sequences: Lookup per store
CREATE INDEX IF NOT EXISTS idx_ticket_seq_store ON ticket_sequences(store_id);