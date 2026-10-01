import type { QueryResultRow } from 'pg'
import type { Queryable, TaskRecord } from './types'

interface TaskRow extends QueryResultRow {
  id: string
  agent_id: string
  plan_id: string | null
  description: string
  network: 'arc-testnet'
  currency: 'USDC'
  status: TaskRecord['status']
  lifecycle_status: TaskRecord['lifecycleStatus']
  budget: string
  estimated: string | null
  current_spend: string
  reserved_spend: string
  spending_mode: TaskRecord['spendingMode']
  idempotency_key: string | null
  created_at: Date
  updated_at: Date
}

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    planId: row.plan_id,
    description: row.description,
    network: row.network,
    currency: row.currency,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    budget: row.budget,
    estimated: row.estimated,
    currentSpend: row.current_spend,
    reservedSpend: row.reserved_spend,
    spendingMode: row.spending_mode,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const taskColumns = `
  t.id, t.agent_id, t.plan_id, t.description, t.network, t.currency,
  t.status, t.budget, t.estimated, t.current_spend, t.reserved_spend, t.spending_mode,
  t.idempotency_key, t.lifecycle_status, t.created_at, t.updated_at
`

const taskReturningColumns = `
  id, agent_id, plan_id, description, network, currency,
  status, budget, estimated, current_spend, reserved_spend, spending_mode,
  idempotency_key, lifecycle_status, created_at, updated_at
`

export interface CreateTaskInput {
  agentId: string
  planId?: string | null
  description: string
  budget: string
  estimated?: string | null
  spendingMode?: TaskRecord['spendingMode']
  idempotencyKey?: string | null
}

export class TaskRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdForUser(taskId: string, userId: string): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `SELECT ${taskColumns}
         FROM tasks AS t
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE t.id = $1 AND a.user_id = $2
        LIMIT 1`,
      [taskId, userId],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async listForUser(userId: string, agentId?: string): Promise<TaskRecord[]> {
    const result = await this.db.query<TaskRow>(
      `SELECT ${taskColumns}
         FROM tasks AS t
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE a.user_id = $1 AND ($2::uuid IS NULL OR t.agent_id = $2)
        ORDER BY t.created_at DESC`,
      [userId, agentId ?? null],
    )
    return result.rows.map(mapTask)
  }

  async createForUser(userId: string, input: CreateTaskInput): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `INSERT INTO tasks (
         agent_id, plan_id, description, network, currency, budget,
         estimated, spending_mode, idempotency_key, lifecycle_status
       )
       SELECT a.id, $3, $4, 'arc-testnet', 'USDC', $5, $6,
              COALESCE($7, 'observe'), $8, 'planned'
         FROM agents AS a
        WHERE a.id = $1 AND a.user_id = $2
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM cost_plans AS linked_plan
             WHERE linked_plan.id = $3 AND linked_plan.agent_id = a.id
          ))
       RETURNING ${taskReturningColumns}`,
      [input.agentId, userId, input.planId ?? null, input.description,
        input.budget, input.estimated ?? null, input.spendingMode ?? null,
        input.idempotencyKey ?? null],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async transitionLifecycleForUser(
    taskId: string,
    userId: string,
    from: TaskRecord['lifecycleStatus'],
    to: TaskRecord['lifecycleStatus'],
  ): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `UPDATE tasks AS t
          SET lifecycle_status = $3,
              status = CASE
                WHEN $3 IN ('planned', 'budgeted') THEN 'pending'
                WHEN $3 IN ('executing', 'tracked') THEN 'executing'
                WHEN $3 IN ('reconciled') THEN 'completed'
                ELSE $3
              END,
              updated_at = NOW()
        WHERE t.id = $1
          AND t.lifecycle_status = $4
          AND EXISTS (
            SELECT 1 FROM agents AS a
             WHERE a.id = t.agent_id AND a.user_id = $2
          )
       RETURNING ${taskReturningColumns}`,
      [taskId, userId, to, from],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async incrementSpendForUser(taskId: string, userId: string, cost: string): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `UPDATE tasks AS t
          SET current_spend = t.current_spend + $3,
              updated_at = NOW()
        WHERE t.id = $1
          AND EXISTS (
            SELECT 1 FROM agents AS a
             WHERE a.id = t.agent_id AND a.user_id = $2
          )
       RETURNING ${taskReturningColumns}`,
      [taskId, userId, cost],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async reserveSpendForUser(taskId: string, userId: string, amount: string): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `UPDATE tasks AS t
          SET reserved_spend = t.reserved_spend + $3,
              updated_at = NOW()
        WHERE t.id = $1
          AND t.currency = 'USDC'
          AND EXISTS (SELECT 1 FROM agents AS a WHERE a.id = t.agent_id AND a.user_id = $2)
          AND t.current_spend + t.reserved_spend + $3 <= t.budget
       RETURNING ${taskReturningColumns}`,
      [taskId, userId, amount],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async releaseReservedSpendForUser(taskId: string, userId: string, amount: string): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `UPDATE tasks AS t
          SET reserved_spend = t.reserved_spend - $3,
              updated_at = NOW()
        WHERE t.id = $1
          AND t.reserved_spend >= $3
          AND EXISTS (SELECT 1 FROM agents AS a WHERE a.id = t.agent_id AND a.user_id = $2)
       RETURNING ${taskReturningColumns}`,
      [taskId, userId, amount],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }

  async settleReservedSpendForUser(taskId: string, userId: string, reserved: string, actual: string): Promise<TaskRecord | null> {
    const result = await this.db.query<TaskRow>(
      `UPDATE tasks AS t
          SET reserved_spend = t.reserved_spend - $3,
              current_spend = t.current_spend + $4,
              updated_at = NOW()
        WHERE t.id = $1
          AND t.reserved_spend >= $3
          AND EXISTS (SELECT 1 FROM agents AS a WHERE a.id = t.agent_id AND a.user_id = $2)
       RETURNING ${taskReturningColumns}`,
      [taskId, userId, reserved, actual],
    )
    return result.rows[0] ? mapTask(result.rows[0]) : null
  }
}
