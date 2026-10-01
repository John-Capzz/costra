ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_idempotency_key_key;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_agent_idempotency_key_unique
  UNIQUE (agent_id, idempotency_key);

ALTER TABLE execution_events
  DROP CONSTRAINT IF EXISTS execution_events_idempotency_key_key;

ALTER TABLE execution_events
  ADD CONSTRAINT events_task_idempotency_key_unique
  UNIQUE (task_id, idempotency_key);
