-- ============================================================
-- COSTRA — PostgreSQL Schema (v1)
-- ============================================================

-- ---- Extensions -------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---- Users ------------------------------------------------
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- API Keys ---------------------------------------------
-- Keys are stored as SHA-256 hashes — never plaintext.
-- The plaintext is shown ONCE at creation and never stored.
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL UNIQUE,   -- SHA-256 hex
  label       TEXT,
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Providers --------------------------------------------
CREATE TABLE providers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,   -- e.g. 'openai', 'defillama'
  category    TEXT NOT NULL,          -- 'inference' | 'api' | 'chain' | 'storage'
  unit_price  NUMERIC(18, 8),
  currency    TEXT NOT NULL DEFAULT 'USDC',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Agents -----------------------------------------------
CREATE TABLE agents (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'idle'
                     CHECK (status IN ('active','idle','paused','error')),
  spending_mode      TEXT NOT NULL DEFAULT 'observe'
                     CHECK (spending_mode IN ('observe','guarded')),
  budget_limit       NUMERIC(18, 6) NOT NULL DEFAULT 50,
  planning_accuracy  NUMERIC(5, 2),    -- 0..100
  total_spend        NUMERIC(18, 6) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Budget Policies --------------------------------------
CREATE TABLE budget_policies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('per_task','per_transaction','daily','agent','service')),
  limit_amt  NUMERIC(18, 6) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'USDC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Cost Plans -------------------------------------------
CREATE TABLE cost_plans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id           UUID NOT NULL REFERENCES agents(id),
  task_description   TEXT NOT NULL,
  network            TEXT NOT NULL DEFAULT 'arc-testnet',
  currency           TEXT NOT NULL DEFAULT 'USDC',
  max_budget         NUMERIC(18, 6) NOT NULL,
  estimated_cost     NUMERIC(18, 6),
  safety_buffer      NUMERIC(18, 6),
  recommended_budget NUMERIC(18, 6),
  confidence         NUMERIC(5, 4),    -- 0..1
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','approved','executing','completed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Cost Items -------------------------------------------
CREATE TABLE cost_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id      UUID NOT NULL REFERENCES cost_plans(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  label        TEXT NOT NULL,
  provider_id  UUID REFERENCES providers(id),
  unit_price   NUMERIC(18, 8) NOT NULL,
  quantity     NUMERIC(18, 4) NOT NULL,
  estimated    NUMERIC(18, 6) NOT NULL,
  confidence   NUMERIC(5, 4),
  source       TEXT NOT NULL DEFAULT 'estimation'
               CHECK (source IN ('static','historical','dynamic','estimation')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Services ---------------------------------------------
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  provider_id UUID REFERENCES providers(id),
  unit_price  NUMERIC(18, 8),
  currency    TEXT NOT NULL DEFAULT 'USDC',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Tasks ------------------------------------------------
CREATE TABLE tasks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id       UUID NOT NULL REFERENCES agents(id),
  plan_id        UUID REFERENCES cost_plans(id),
  description    TEXT NOT NULL,
  network        TEXT NOT NULL DEFAULT 'arc-testnet',
  currency       TEXT NOT NULL DEFAULT 'USDC',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','executing','completed','failed','blocked')),
  budget         NUMERIC(18, 6) NOT NULL,
  estimated      NUMERIC(18, 6),
  current_spend  NUMERIC(18, 6) NOT NULL DEFAULT 0,
  spending_mode  TEXT NOT NULL DEFAULT 'observe'
                 CHECK (spending_mode IN ('observe','guarded')),
  idempotency_key TEXT UNIQUE,  -- replay protection
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Execution Events -------------------------------------
CREATE TABLE execution_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cost          NUMERIC(18, 6),
  currency      TEXT NOT NULL DEFAULT 'USDC',
  description   TEXT,
  provider      TEXT,
  tx_hash       TEXT,
  metadata      JSONB,
  idempotency_key TEXT UNIQUE  -- replay protection
);

-- ---- Transactions (on-chain records) ----------------------
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID REFERENCES tasks(id),
  tx_hash     TEXT NOT NULL UNIQUE,
  network     TEXT NOT NULL,
  from_addr   TEXT,
  to_addr     TEXT,
  value       NUMERIC(18, 6),
  currency    TEXT NOT NULL DEFAULT 'USDC',
  gas_usdc    NUMERIC(18, 8),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','success','failed')),
  block_number BIGINT,
  confirmed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Reconciliations --------------------------------------
CREATE TABLE reconciliations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL UNIQUE REFERENCES tasks(id),
  estimated_cost  NUMERIC(18, 6) NOT NULL,
  budget          NUMERIC(18, 6) NOT NULL,
  actual_cost     NUMERIC(18, 6) NOT NULL,
  variance        NUMERIC(18, 6),
  variance_pct    NUMERIC(8, 4),
  items           JSONB,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Indexes ----------------------------------------------
CREATE INDEX idx_tasks_agent       ON tasks(agent_id);
CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_events_task       ON execution_events(task_id);
CREATE INDEX idx_events_timestamp  ON execution_events(timestamp DESC);
CREATE INDEX idx_transactions_task ON transactions(task_id);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX idx_plans_agent       ON cost_plans(agent_id);
CREATE INDEX idx_api_keys_hash     ON api_keys(key_hash);

-- ---- Updated_at trigger -----------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agents_updated     BEFORE UPDATE ON agents     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated      BEFORE UPDATE ON tasks      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cost_plans_updated BEFORE UPDATE ON cost_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
