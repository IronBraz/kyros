-- ============================================================
-- Kyros Pilot AI Tables Migration
-- File: database/migrations/2026_05_pilot_ai.sql
-- Apply: psql -U <user> -d kyros_db -f database/migrations/2026_05_pilot_ai.sql
-- Phase: Pilot (AI Chat Concierge)
-- ============================================================

-- 1. AI Conversations (one per queue session that uses AI chat)
CREATE TABLE ai_conversations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v7(),
    session_id      UUID        UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    wiki_version    VARCHAR(20),
    message_count   INT         DEFAULT 0,
    last_message_at TIMESTAMPTZ
);

-- 2. AI Messages (individual turns in a conversation)
CREATE TABLE ai_messages (
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

-- 3. AI Summaries (async sentiment + handover note, generated when ticket is called)
CREATE TABLE ai_summaries (
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

-- 4. AI Usage Monthly (running budget counter — hard €3/mo kill-switch)
CREATE TABLE ai_usage_monthly (
    id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v7(),
    year_month           CHAR(7)      NOT NULL UNIQUE,   -- e.g. '2026-05'
    total_input_tokens   BIGINT       NOT NULL DEFAULT 0,
    total_output_tokens  BIGINT       NOT NULL DEFAULT 0,
    total_cost_eur       NUMERIC(8,4) NOT NULL DEFAULT 0,
    last_updated         TIMESTAMPTZ  DEFAULT NOW()
);

-- 5. Add ai_conversation_id to sessions (bidirectional 1:1 link)
ALTER TABLE sessions
    ADD COLUMN ai_conversation_id UUID UNIQUE REFERENCES ai_conversations(id);

-- 6. Indices
CREATE INDEX idx_ai_messages_conv
    ON ai_messages(conversation_id, created_at);

CREATE INDEX idx_ai_summaries_status
    ON ai_summaries(status)
    WHERE status IN ('pending', 'generating');

-- 7. Seed: initialise the current month's budget row
INSERT INTO ai_usage_monthly (year_month)
VALUES (TO_CHAR(NOW(), 'YYYY-MM'))
ON CONFLICT (year_month) DO NOTHING;
