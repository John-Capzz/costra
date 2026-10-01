import type { QueryResultRow } from 'pg'
import type { Queryable, ReconciliationRecord } from './types'

interface ReconciliationRow extends QueryResultRow {
  id: string
  task_id: string
  estimated_cost: string
  budget: string
  actual_cost: string
  variance: string | null
  variance_pct: string | null
  items: Record<string, unknown> | null
  completed_at: Date
  status: ReconciliationRecord['status']
}

function mapReconciliation(row: ReconciliationRow): ReconciliationRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    estimatedCost: row.estimated_cost,
    budget: row.budget,
    actualCost: row.actual_cost,
    variance: row.variance,
    variancePct: row.variance_pct,
    items: row.items,
    completedAt: row.completed_at,
    status: row.status,
  }
}

export interface CreateReconciliationInput {
  estimatedCost: string
  budget: string
  actualCost: string
  variance?: string | null
  variancePct?: string | null
  items?: Record<string, unknown> | null
  status?: ReconciliationRecord['status']
}

export class ReconciliationRepository {
  constructor(private readonly db: Queryable) {}

  async findForTask(taskId: string, userId: string): Promise<ReconciliationRecord | null> {
    const result = await this.db.query<ReconciliationRow>(
      `SELECT r.id, r.task_id, r.estimated_cost, r.budget, r.actual_cost,
              r.variance, r.variance_pct, r.items, r.completed_at, r.status
         FROM reconciliations AS r
         INNER JOIN tasks AS t ON t.id = r.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE r.task_id = $1 AND a.user_id = $2
        LIMIT 1`,
      [taskId, userId],
    )
    return result.rows[0] ? mapReconciliation(result.rows[0]) : null
  }

  async findForPlan(planId: string, userId: string): Promise<ReconciliationRecord | null> {
    const result = await this.db.query<ReconciliationRow>(
      `SELECT r.id, r.task_id, r.estimated_cost, r.budget, r.actual_cost,
              r.variance, r.variance_pct, r.items, r.completed_at, r.status
         FROM reconciliations AS r
         INNER JOIN tasks AS t ON t.id = r.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE t.plan_id = $1 AND a.user_id = $2
        ORDER BY r.completed_at DESC
        LIMIT 1`,
      [planId, userId],
    )
    return result.rows[0] ? mapReconciliation(result.rows[0]) : null
  }

  async createForTask(
    taskId: string,
    userId: string,
    input: CreateReconciliationInput,
  ): Promise<ReconciliationRecord | null> {
    const result = await this.db.query<ReconciliationRow>(
      `INSERT INTO reconciliations (
         task_id, estimated_cost, budget, actual_cost, variance, variance_pct, items, status
       )
       SELECT t.id, $3, $4, $5, $6, $7, $8, COALESCE($9, 'completed')
         FROM tasks AS t
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE t.id = $1 AND a.user_id = $2
       RETURNING id, task_id, estimated_cost, budget, actual_cost,
                 variance, variance_pct, items, completed_at, status`,
      [taskId, userId, input.estimatedCost, input.budget, input.actualCost,
        input.variance ?? null, input.variancePct ?? null, input.items ?? null,
        input.status ?? null],
    )
    return result.rows[0] ? mapReconciliation(result.rows[0]) : null
  }
}
