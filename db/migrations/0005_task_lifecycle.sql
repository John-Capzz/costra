ALTER TABLE tasks
  ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'planned';

UPDATE tasks
   SET lifecycle_status = CASE status
     WHEN 'executing' THEN 'executing'
     WHEN 'completed' THEN 'reconciled'
     WHEN 'failed' THEN 'failed'
     WHEN 'blocked' THEN 'blocked'
     ELSE 'planned'
   END;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_lifecycle_status_supported CHECK (
    lifecycle_status IN (
      'planned', 'budgeted', 'executing', 'tracked',
      'reconciled', 'failed', 'blocked'
    )
  );

ALTER TABLE execution_events
  DROP CONSTRAINT IF EXISTS execution_events_type_supported;

ALTER TABLE execution_events
  ADD CONSTRAINT execution_events_type_supported CHECK (
    type IN (
      'TASK_CREATED', 'PLAN_GENERATED', 'BUDGET_APPROVED',
      'TASK_BUDGETED', 'TASK_EXECUTING', 'TASK_TRACKED',
      'TASK_RECONCILED', 'API_CALL', 'SERVICE_PAYMENT',
      'ARC_TRANSACTION', 'RETRY', 'SPEND_BLOCKED',
      'TASK_COMPLETED', 'TASK_FAILED'
    )
  );
