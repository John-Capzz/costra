import type { QueryResultRow } from 'pg'
import type { ExecutionMode, Queryable, TransactionRecord } from './types'

interface TransactionRow extends QueryResultRow {
  id: string
  task_id: string
  tx_hash: string | null
  network: 'arc-testnet'
  from_addr: string | null
  to_addr: string | null
  value: string | null
  currency: 'USDC'
  gas_usdc: string | null
  status: TransactionRecord['status']
  block_number: string | null
  confirmed_at: Date | null
  created_at: Date
  execution_mode: ExecutionMode
  idempotency_key: string | null
}

function mapTransaction(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    txHash: row.tx_hash,
    network: row.network,
    fromAddress: row.from_addr,
    toAddress: row.to_addr,
    value: row.value,
    currency: row.currency,
    gasUsdc: row.gas_usdc,
    status: row.status,
    blockNumber: row.block_number,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    executionMode: row.execution_mode,
    idempotencyKey: row.idempotency_key,
  }
}

export interface CreateTransactionInput {
  txHash?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  value?: string | null
  gasUsdc?: string | null
  status?: TransactionRecord['status']
  blockNumber?: string | null
  confirmedAt?: Date | null
  executionMode: ExecutionMode
  idempotencyKey?: string | null
}

export class TransactionRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdForUser(transactionId: string, userId: string): Promise<TransactionRecord | null> {
    const result = await this.db.query<TransactionRow>(
      `SELECT tr.id, tr.task_id, tr.tx_hash, tr.network, tr.from_addr,
              tr.to_addr, tr.value, tr.currency, tr.gas_usdc, tr.status,
              tr.block_number, tr.confirmed_at, tr.created_at,
              tr.execution_mode, tr.idempotency_key
         FROM transactions AS tr
         INNER JOIN tasks AS t ON t.id = tr.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE tr.id = $1 AND a.user_id = $2
        LIMIT 1`,
      [transactionId, userId],
    )
    return result.rows[0] ? mapTransaction(result.rows[0]) : null
  }

  async listForTask(taskId: string, userId: string): Promise<TransactionRecord[]> {
    const result = await this.db.query<TransactionRow>(
      `SELECT tr.id, tr.task_id, tr.tx_hash, tr.network, tr.from_addr,
              tr.to_addr, tr.value, tr.currency, tr.gas_usdc, tr.status,
              tr.block_number, tr.confirmed_at, tr.created_at,
              tr.execution_mode, tr.idempotency_key
         FROM transactions AS tr
         INNER JOIN tasks AS t ON t.id = tr.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE tr.task_id = $1 AND a.user_id = $2
        ORDER BY tr.created_at ASC`,
      [taskId, userId],
    )
    return result.rows.map(mapTransaction)
  }

  async createForTask(
    taskId: string,
    userId: string,
    input: CreateTransactionInput,
  ): Promise<TransactionRecord | null> {
    const result = await this.db.query<TransactionRow>(
      `INSERT INTO transactions (
         task_id, tx_hash, network, from_addr, to_addr, value, currency,
         gas_usdc, status, block_number, confirmed_at, execution_mode, idempotency_key
       )
       SELECT t.id, $3, 'arc-testnet', $4, $5, $6, 'USDC', $7,
              COALESCE($8, 'pending'), $9, $10, $11, $12
         FROM tasks AS t
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE t.id = $1 AND a.user_id = $2
       RETURNING id, task_id, tx_hash, network, from_addr, to_addr, value,
                 currency, gas_usdc, status, block_number, confirmed_at, created_at,
                 execution_mode, idempotency_key`,
      [taskId, userId, input.txHash, input.fromAddress ?? null,
        input.toAddress ?? null, input.value ?? null, input.gasUsdc ?? null,
        input.status ?? null, input.blockNumber ?? null, input.confirmedAt ?? null,
        input.executionMode, input.idempotencyKey ?? null],
    )
    return result.rows[0] ? mapTransaction(result.rows[0]) : null
  }

  async findByIdempotencyKey(
    taskId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<TransactionRecord | null> {
    const result = await this.db.query<TransactionRow>(
      `SELECT tr.id, tr.task_id, tr.tx_hash, tr.network, tr.from_addr,
              tr.to_addr, tr.value, tr.currency, tr.gas_usdc, tr.status,
              tr.block_number, tr.confirmed_at, tr.created_at,
              tr.execution_mode, tr.idempotency_key
         FROM transactions AS tr
         INNER JOIN tasks AS t ON t.id = tr.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE tr.task_id = $1 AND a.user_id = $2 AND tr.idempotency_key = $3
        LIMIT 1`,
      [taskId, userId, idempotencyKey],
    )
    return result.rows[0] ? mapTransaction(result.rows[0]) : null
  }

  async findByHashForUser(txHash: string, userId: string): Promise<TransactionRecord | null> {
    const result = await this.db.query<TransactionRow>(
      `SELECT tr.id, tr.task_id, tr.tx_hash, tr.network, tr.from_addr,
              tr.to_addr, tr.value, tr.currency, tr.gas_usdc, tr.status,
              tr.block_number, tr.confirmed_at, tr.created_at,
              tr.execution_mode, tr.idempotency_key
         FROM transactions AS tr
         INNER JOIN tasks AS t ON t.id = tr.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE tr.tx_hash = $1 AND a.user_id = $2
        LIMIT 1`,
      [txHash, userId],
    )
    return result.rows[0] ? mapTransaction(result.rows[0]) : null
  }

  async updateStatusForUser(
    transactionId: string,
    userId: string,
    input: { status: TransactionRecord['status']; gasUsdc?: string | null; blockNumber?: string | null; confirmedAt?: Date | null },
  ): Promise<TransactionRecord | null> {
    const result = await this.db.query<TransactionRow>(
      `UPDATE transactions AS tr
          SET status = $3, gas_usdc = $4, block_number = $5, confirmed_at = $6
        WHERE tr.id = $1
          AND EXISTS (
            SELECT 1 FROM tasks AS t
            INNER JOIN agents AS a ON a.id = t.agent_id
             WHERE t.id = tr.task_id AND a.user_id = $2
          )
       RETURNING id, task_id, tx_hash, network, from_addr, to_addr, value,
                 currency, gas_usdc, status, block_number, confirmed_at,
                 created_at, execution_mode, idempotency_key`,
      [transactionId, userId, input.status, input.gasUsdc ?? null,
        input.blockNumber ?? null, input.confirmedAt ?? null],
    )
    return result.rows[0] ? mapTransaction(result.rows[0]) : null
  }
}
