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
  password_hash TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Browser Sessions ------------------------------------
-- The opaque session cookie and session-bound CSRF token are server-validated.
CREATE TABLE browser_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  csrf_token  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_browser_sessions_user ON browser_sessions(user_id);
CREATE INDEX idx_browser_sessions_active ON browser_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

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
  wallet_address     TEXT CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  status             TEXT NOT NULL DEFAULT 'idle'
                     CHECK (status IN ('active','idle','paused','error')),
  spending_mode      TEXT NOT NULL DEFAULT 'observe'
                     CHECK (spending_mode IN ('observe','guarded')),
  budget_limit       NUMERIC(18, 6) NOT NULL DEFAULT 50 CHECK (budget_limit >= 0),
  planning_accuracy  NUMERIC(5, 2) CHECK (planning_accuracy IS NULL OR planning_accuracy BETWEEN 0 AND 100),
  total_spend        NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (total_spend >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Budget Policies --------------------------------------
CREATE TABLE budget_policies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('per_task','per_transaction','daily','agent','service')),
  limit_amt  NUMERIC(18, 6) NOT NULL CHECK (limit_amt >= 0),
  currency   TEXT NOT NULL DEFAULT 'USDC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Cost Plans -------------------------------------------
CREATE TABLE cost_plans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id           UUID NOT NULL REFERENCES agents(id),
  task_description   TEXT NOT NULL,
  network            TEXT NOT NULL DEFAULT 'arc-testnet' CHECK (network = 'arc-testnet'),
  currency           TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  max_budget         NUMERIC(18, 6) NOT NULL CHECK (max_budget >= 0),
  estimated_cost     NUMERIC(18, 6) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  safety_buffer      NUMERIC(18, 6) CHECK (safety_buffer IS NULL OR safety_buffer >= 0),
  recommended_budget NUMERIC(18, 6) CHECK (recommended_budget IS NULL OR recommended_budget >= 0),
  confidence         NUMERIC(5, 4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
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
  unit_price   NUMERIC(18, 8) NOT NULL CHECK (unit_price >= 0),
  quantity     NUMERIC(18, 4) NOT NULL CHECK (quantity >= 0),
  estimated    NUMERIC(18, 6) NOT NULL CHECK (estimated >= 0),
  confidence   NUMERIC(5, 4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  source       TEXT NOT NULL DEFAULT 'estimation'
               CHECK (source IN ('static','historical','dynamic','estimation')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Services ---------------------------------------------
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  provider_id UUID REFERENCES providers(id),
  unit_price  NUMERIC(18, 8) CHECK (unit_price IS NULL OR unit_price >= 0),
  currency    TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Tasks ------------------------------------------------
CREATE TABLE tasks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id       UUID NOT NULL REFERENCES agents(id),
  plan_id        UUID REFERENCES cost_plans(id),
  description    TEXT NOT NULL,
  network        TEXT NOT NULL DEFAULT 'arc-testnet' CHECK (network = 'arc-testnet'),
  currency       TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','executing','completed','failed','blocked')),
  lifecycle_status TEXT NOT NULL DEFAULT 'planned'
                 CHECK (lifecycle_status IN ('planned','budgeted','executing','tracked','reconciled','failed','blocked')),
  budget         NUMERIC(18, 6) NOT NULL CHECK (budget >= 0),
  estimated      NUMERIC(18, 6) CHECK (estimated IS NULL OR estimated >= 0),
  current_spend  NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (current_spend >= 0),
  reserved_spend NUMERIC(18, 6) NOT NULL DEFAULT 0
                 CHECK (reserved_spend >= 0),
  spending_mode  TEXT NOT NULL DEFAULT 'observe'
                 CHECK (spending_mode IN ('observe','guarded')),
  result         TEXT,
  idempotency_key TEXT,  -- replay protection
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Execution Events -------------------------------------
CREATE TABLE execution_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'TASK_CREATED','PLAN_GENERATED','BUDGET_APPROVED','TASK_BUDGETED',
    'TASK_EXECUTING','TASK_TRACKED','TASK_RECONCILED','API_CALL',
    'SERVICE_PAYMENT','ARC_TRANSACTION','RETRY','SPEND_BLOCKED',
    'TASK_COMPLETED','TASK_FAILED'
  )),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cost          NUMERIC(18, 6),
  currency      TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  description   TEXT,
  provider      TEXT,
  tx_hash       TEXT,
  metadata      JSONB,
  idempotency_key TEXT,  -- replay protection
  execution_mode TEXT NOT NULL DEFAULT 'simulated'
                CHECK (execution_mode IN ('simulated','observed','real'))
);

-- ---- Transactions (on-chain records) ----------------------
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID REFERENCES tasks(id),
  tx_hash     TEXT UNIQUE,
  network     TEXT NOT NULL DEFAULT 'arc-testnet'
              CHECK (network = 'arc-testnet'),
  from_addr   TEXT,
  to_addr     TEXT,
  value       NUMERIC(18, 6) CHECK (value IS NULL OR value >= 0),
  currency    TEXT NOT NULL DEFAULT 'USDC',
  gas_usdc    NUMERIC(18, 8) CHECK (gas_usdc IS NULL OR gas_usdc >= 0),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','success','failed')),
  block_number BIGINT,
  confirmed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_mode TEXT NOT NULL DEFAULT 'simulated'
                 CHECK (execution_mode IN ('simulated','observed','real')),
  idempotency_key TEXT,
  CHECK (execution_mode = 'simulated' OR tx_hash IS NOT NULL),
  UNIQUE (task_id, idempotency_key)
);

-- ---- Reconciliations --------------------------------------
CREATE TABLE reconciliations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL UNIQUE REFERENCES tasks(id),
  estimated_cost  NUMERIC(18, 6) NOT NULL CHECK (estimated_cost >= 0),
  budget          NUMERIC(18, 6) NOT NULL CHECK (budget >= 0),
  actual_cost     NUMERIC(18, 6) NOT NULL CHECK (actual_cost >= 0),
  variance        NUMERIC(18, 6),
  variance_pct    NUMERIC(8, 4),
  items           JSONB,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('pending','completed','failed'))
);

-- ---- Controlled execution requests ------------------------
CREATE TABLE execution_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  plan_id          UUID NOT NULL REFERENCES cost_plans(id) ON DELETE CASCADE,
  amount           NUMERIC(18, 6) NOT NULL CHECK (amount > 0),
  reserved_amount  NUMERIC(18, 6) NOT NULL CHECK (reserved_amount > 0),
  currency         TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  network          TEXT NOT NULL DEFAULT 'arc-testnet' CHECK (network = 'arc-testnet'),
  destination      TEXT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('guarded')),
  status           TEXT NOT NULL DEFAULT 'approved'
                   CHECK (status IN ('approved','submitted','confirmed','failed','rejected')),
  idempotency_key  TEXT NOT NULL,
  tx_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

-- ---- Distributed rate-limit buckets ----------------------
CREATE TABLE rate_limit_buckets (
  bucket_key         TEXT PRIMARY KEY,
  window_started_at  TIMESTAMPTZ NOT NULL,
  request_count      INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_budget_policies_agent_type ON budget_policies(agent_id, type);
CREATE INDEX idx_plans_agent_status_created ON cost_plans(agent_id, status, created_at DESC);
CREATE INDEX idx_tasks_agent_status_created ON tasks(agent_id, status, created_at DESC);
CREATE INDEX idx_events_task_timestamp ON execution_events(task_id, timestamp DESC);
CREATE INDEX idx_transactions_task_created ON transactions(task_id, created_at DESC);
CREATE INDEX idx_execution_requests_task ON execution_requests(task_id);
CREATE INDEX idx_execution_requests_tx_hash ON execution_requests(tx_hash);
CREATE INDEX idx_rate_limit_buckets_updated ON rate_limit_buckets(updated_at);
CREATE INDEX idx_browser_sessions_user ON browser_sessions(user_id);
CREATE INDEX idx_browser_sessions_active ON browser_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX tasks_agent_idempotency_key_unique
  ON tasks(agent_id, idempotency_key);
CREATE UNIQUE INDEX events_task_idempotency_key_unique
  ON execution_events(task_id, idempotency_key);

-- ---- Updated_at trigger -----------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agents_updated     BEFORE UPDATE ON agents     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated      BEFORE UPDATE ON tasks      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cost_plans_updated BEFORE UPDATE ON cost_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_execution_requests_updated
  BEFORE UPDATE ON execution_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
