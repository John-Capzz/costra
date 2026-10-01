-- Normalize the existing human-readable API label to the database slug.
UPDATE cost_plans SET network = 'arc-testnet' WHERE network = 'Arc Testnet';
UPDATE tasks SET network = 'arc-testnet' WHERE network = 'Arc Testnet';
UPDATE transactions SET network = 'arc-testnet' WHERE network = 'Arc Testnet';

ALTER TABLE agents
  ADD CONSTRAINT agents_budget_limit_nonnegative CHECK (budget_limit >= 0),
  ADD CONSTRAINT agents_total_spend_nonnegative CHECK (total_spend >= 0),
  ADD CONSTRAINT agents_planning_accuracy_range
    CHECK (planning_accuracy IS NULL OR planning_accuracy BETWEEN 0 AND 100);

ALTER TABLE budget_policies
  ADD CONSTRAINT budget_policies_limit_nonnegative CHECK (limit_amt >= 0),
  ADD CONSTRAINT budget_policies_currency_supported CHECK (currency = 'USDC');

ALTER TABLE cost_plans
  ADD CONSTRAINT cost_plans_network_supported CHECK (network = 'arc-testnet'),
  ADD CONSTRAINT cost_plans_currency_supported CHECK (currency = 'USDC'),
  ADD CONSTRAINT cost_plans_max_budget_nonnegative CHECK (max_budget >= 0),
  ADD CONSTRAINT cost_plans_estimated_cost_nonnegative
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  ADD CONSTRAINT cost_plans_safety_buffer_nonnegative
    CHECK (safety_buffer IS NULL OR safety_buffer >= 0),
  ADD CONSTRAINT cost_plans_recommended_budget_nonnegative
    CHECK (recommended_budget IS NULL OR recommended_budget >= 0),
  ADD CONSTRAINT cost_plans_confidence_range
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1);

ALTER TABLE cost_items
  ADD CONSTRAINT cost_items_unit_price_nonnegative CHECK (unit_price >= 0),
  ADD CONSTRAINT cost_items_quantity_nonnegative CHECK (quantity >= 0),
  ADD CONSTRAINT cost_items_estimated_nonnegative CHECK (estimated >= 0),
  ADD CONSTRAINT cost_items_confidence_range
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1);

ALTER TABLE services
  ADD CONSTRAINT services_unit_price_nonnegative
    CHECK (unit_price IS NULL OR unit_price >= 0),
  ADD CONSTRAINT services_currency_supported CHECK (currency = 'USDC');

ALTER TABLE tasks
  ADD CONSTRAINT tasks_network_supported CHECK (network = 'arc-testnet'),
  ADD CONSTRAINT tasks_currency_supported CHECK (currency = 'USDC'),
  ADD CONSTRAINT tasks_budget_nonnegative CHECK (budget >= 0),
  ADD CONSTRAINT tasks_estimated_nonnegative
    CHECK (estimated IS NULL OR estimated >= 0),
  ADD CONSTRAINT tasks_current_spend_nonnegative CHECK (current_spend >= 0);

ALTER TABLE execution_events
  ADD CONSTRAINT execution_events_type_supported CHECK (
    type IN (
      'TASK_CREATED', 'PLAN_GENERATED', 'BUDGET_APPROVED', 'API_CALL',
      'SERVICE_PAYMENT', 'ARC_TRANSACTION', 'RETRY', 'SPEND_BLOCKED',
      'TASK_COMPLETED', 'TASK_FAILED'
    )
  ),
  ADD CONSTRAINT execution_events_cost_nonnegative
    CHECK (cost IS NULL OR cost >= 0),
  ADD CONSTRAINT execution_events_currency_supported CHECK (currency = 'USDC');

ALTER TABLE transactions
  ADD CONSTRAINT transactions_network_supported CHECK (network = 'arc-testnet'),
  ADD CONSTRAINT transactions_currency_supported CHECK (currency = 'USDC'),
  ADD CONSTRAINT transactions_value_nonnegative
    CHECK (value IS NULL OR value >= 0),
  ADD CONSTRAINT transactions_gas_nonnegative
    CHECK (gas_usdc IS NULL OR gas_usdc >= 0);

ALTER TABLE reconciliations
  ADD CONSTRAINT reconciliations_estimated_nonnegative CHECK (estimated_cost >= 0),
  ADD CONSTRAINT reconciliations_budget_nonnegative CHECK (budget >= 0),
  ADD CONSTRAINT reconciliations_actual_nonnegative CHECK (actual_cost >= 0);
