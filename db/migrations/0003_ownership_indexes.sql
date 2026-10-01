CREATE INDEX idx_agents_user
  ON agents(user_id);

CREATE INDEX idx_budget_policies_agent_type
  ON budget_policies(agent_id, type);

CREATE INDEX idx_plans_agent_status_created
  ON cost_plans(agent_id, status, created_at DESC);

CREATE INDEX idx_tasks_agent_status_created
  ON tasks(agent_id, status, created_at DESC);

CREATE INDEX idx_events_task_timestamp
  ON execution_events(task_id, timestamp DESC);

CREATE INDEX idx_transactions_task_created
  ON transactions(task_id, created_at DESC);
