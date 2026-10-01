import type { QueryResultRow } from 'pg'
import type { ExecutionEventRecord, ExecutionMode, Queryable } from './types'

interface EventRow extends QueryResultRow {
  id: string
  task_id: string
  type: string
  timestamp: Date
  cost: string | null
  currency: 'USDC'
  description: string | null
  provider: string | null
  tx_hash: string | null
  metadata: Record<string, unknown> | null
  idempotency_key: string | null
  execution_mode: ExecutionMode
}

function mapEvent(row: EventRow): ExecutionEventRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    timestamp: row.timestamp,
    cost: row.cost,
    currency: row.currency,
    description: row.description,
    provider: row.provider,
    txHash: row.tx_hash,
    metadata: row.metadata,
    idempotencyKey: row.idempotency_key,
    executionMode: row.execution_mode,
  }
}

export interface AppendEventInput {
  type: string
  cost?: string | null
  description?: string | null
  provider?: string | null
  txHash?: string | null
  metadata?: Record<string, unknown> | null
  idempotencyKey?: string | null
  executionMode?: ExecutionMode
}

export class ExecutionEventRepository {
  constructor(private readonly db: Queryable) {}

  async listForTask(taskId: string, userId: string): Promise<ExecutionEventRecord[]> {
    const result = await this.db.query<EventRow>(
      `SELECT e.id, e.task_id, e.type, e.timestamp, e.cost, e.currency,
              e.description, e.provider, e.tx_hash, e.metadata, e.idempotency_key,
              e.execution_mode
         FROM execution_events AS e
         INNER JOIN tasks AS t ON t.id = e.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE e.task_id = $1 AND a.user_id = $2
        ORDER BY e.timestamp ASC, e.id ASC`,
      [taskId, userId],
    )
    return result.rows.map(mapEvent)
  }

  async findByIdempotencyKey(
    taskId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<ExecutionEventRecord | null> {
    const result = await this.db.query<EventRow>(
      `SELECT e.id, e.task_id, e.type, e.timestamp, e.cost, e.currency,
              e.description, e.provider, e.tx_hash, e.metadata, e.idempotency_key,
              e.execution_mode
         FROM execution_events AS e
         INNER JOIN tasks AS t ON t.id = e.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE e.task_id = $1 AND a.user_id = $2 AND e.idempotency_key = $3
        LIMIT 1`,
      [taskId, userId, idempotencyKey],
    )
    return result.rows[0] ? mapEvent(result.rows[0]) : null
  }

  async appendForTask(
    taskId: string,
    userId: string,
    input: AppendEventInput,
  ): Promise<ExecutionEventRecord | null> {
    const result = await this.db.query<EventRow>(
      `INSERT INTO execution_events (
         task_id, type, cost, currency, description, provider, tx_hash,
         metadata, idempotency_key, execution_mode
       )
       SELECT t.id, $3, $4, 'USDC', $5, $6, $7, $8, $9, COALESCE($10, 'simulated')
         FROM tasks AS t
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE t.id = $1 AND a.user_id = $2
       RETURNING id, task_id, type, timestamp, cost, currency, description,
                 provider, tx_hash, metadata, idempotency_key, execution_mode`,
      [taskId, userId, input.type, input.cost ?? null, input.description ?? null,
        input.provider ?? null, input.txHash ?? null, input.metadata ?? null,
        input.idempotencyKey ?? null, input.executionMode ?? null],
    )
    return result.rows[0] ? mapEvent(result.rows[0]) : null
  }
}
