ALTER TABLE tasks
  ADD COLUMN reserved_spend NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD CONSTRAINT tasks_reserved_spend_non_negative CHECK (reserved_spend >= 0);

CREATE TABLE execution_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  plan_id          UUID NOT NULL REFERENCES cost_plans(id) ON DELETE CASCADE,
  amount           NUMERIC(18, 6) NOT NULL CHECK (amount > 0),
  reserved_amount  NUMERIC(18, 6) NOT NULL CHECK (reserved_amount > 0),
  currency        TEXT NOT NULL DEFAULT 'USDC' CHECK (currency = 'USDC'),
  network         TEXT NOT NULL DEFAULT 'arc-testnet' CHECK (network = 'arc-testnet'),
  destination     TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('guarded')),
  status          TEXT NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('approved','submitted','confirmed','failed','rejected')),
  idempotency_key TEXT NOT NULL,
  tx_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_execution_requests_task ON execution_requests(task_id);
CREATE INDEX idx_execution_requests_tx_hash ON execution_requests(tx_hash);

CREATE TRIGGER trg_execution_requests_updated
  BEFORE UPDATE ON execution_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
