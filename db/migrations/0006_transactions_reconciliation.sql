ALTER TABLE execution_events
  ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'simulated',
  ADD CONSTRAINT execution_events_execution_mode_supported CHECK (
    execution_mode IN ('simulated', 'observed', 'real')
  );

ALTER TABLE transactions
  ALTER COLUMN tx_hash DROP NOT NULL,
  ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'simulated',
  ADD COLUMN idempotency_key TEXT,
  ADD CONSTRAINT transactions_execution_mode_supported CHECK (
    execution_mode IN ('simulated', 'observed', 'real')
  ),
  ADD CONSTRAINT transactions_real_records_require_hash CHECK (
    execution_mode = 'simulated' OR tx_hash IS NOT NULL
  ),
  ADD CONSTRAINT transactions_task_idempotency_key_unique
    UNIQUE (task_id, idempotency_key);

ALTER TABLE reconciliations
  ADD COLUMN status TEXT NOT NULL DEFAULT 'completed',
  ADD CONSTRAINT reconciliations_status_supported CHECK (
    status IN ('pending', 'completed', 'failed')
  );
