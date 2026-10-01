import type { QueryResultRow } from 'pg'
import type { ExecutionRequestRecord, ExecutionRequestStatus, Queryable } from './types'

interface ExecutionRequestRow extends QueryResultRow {
  id: string; user_id: string; agent_id: string; task_id: string; plan_id: string
  amount: string; reserved_amount: string; currency: 'USDC'; network: 'arc-testnet'
  destination: string; mode: 'guarded'; status: ExecutionRequestStatus
  idempotency_key: string; tx_hash: string | null; created_at: Date; updated_at: Date
}

function mapExecution(row: ExecutionRequestRow): ExecutionRequestRecord {
  return {
    id: row.id, userId: row.user_id, agentId: row.agent_id, taskId: row.task_id,
    planId: row.plan_id, amount: row.amount, reservedAmount: row.reserved_amount,
    currency: row.currency, network: row.network, destination: row.destination,
    mode: row.mode, status: row.status, idempotencyKey: row.idempotency_key,
    txHash: row.tx_hash, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

const columns = `id, user_id, agent_id, task_id, plan_id, amount, reserved_amount,
  currency, network, destination, mode, status, idempotency_key, tx_hash, created_at, updated_at`

export interface CreateExecutionRequestInput {
  userId: string; agentId: string; taskId: string; planId: string; amount: string
  reservedAmount: string; destination: string; idempotencyKey: string
}

export class ExecutionRequestRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdForUser(id: string, userId: string): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `SELECT ${columns} FROM execution_requests WHERE id = $1 AND user_id = $2 LIMIT 1`, [id, userId],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }

  async findByIdempotencyKeyForUser(userId: string, key: string): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `SELECT ${columns} FROM execution_requests WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`, [userId, key],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }

  async findByTxHashForUser(userId: string, txHash: string): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `SELECT ${columns} FROM execution_requests WHERE user_id = $1 AND tx_hash = $2 LIMIT 1`, [userId, txHash],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }

  async createApproved(input: CreateExecutionRequestInput): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `INSERT INTO execution_requests (
         user_id, agent_id, task_id, plan_id, amount, reserved_amount,
         destination, mode, idempotency_key
       )
       SELECT $1, a.id, t.id, p.id, $5, $6, $7, 'guarded', $8
         FROM agents AS a
         INNER JOIN tasks AS t ON t.agent_id = a.id
         INNER JOIN cost_plans AS p ON p.id = t.plan_id AND p.agent_id = a.id
        WHERE a.id = $2 AND t.id = $3 AND p.id = $4 AND a.user_id = $1
       RETURNING ${columns}`,
      [input.userId, input.agentId, input.taskId, input.planId, input.amount,
        input.reservedAmount, input.destination, input.idempotencyKey],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }

  async updateSubmittedForUser(id: string, userId: string, txHash: string): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `UPDATE execution_requests SET status = 'submitted', tx_hash = $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 RETURNING ${columns}`,
      [id, userId, txHash],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }

  async updateStatusForUser(id: string, userId: string, status: ExecutionRequestStatus): Promise<ExecutionRequestRecord | null> {
    const result = await this.db.query<ExecutionRequestRow>(
      `UPDATE execution_requests SET status = $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 RETURNING ${columns}`,
      [id, userId, status],
    )
    return result.rows[0] ? mapExecution(result.rows[0]) : null
  }
}
