import { ConflictError, NotFoundError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { TransactionRepository, type CreateTransactionInput } from '../repositories/transactions'
import type { Queryable, TransactionRecord } from '../repositories/types'
import type { Pool } from 'pg'

export interface PersistTransactionInput extends CreateTransactionInput {
  taskId: string
  userId: string
}

export interface PersistTransactionResult {
  transaction: TransactionRecord
  duplicate: boolean
}

export async function persistTransaction(
  pool: Pick<Pool, 'connect'>,
  input: PersistTransactionInput,
): Promise<PersistTransactionResult> {
  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const repository = new TransactionRepository(client as Queryable)

      if (input.idempotencyKey) {
        const existing = await repository.findByIdempotencyKey(
          input.taskId,
          input.userId,
          input.idempotencyKey,
        )
        if (existing) {
          if (existing.executionMode !== input.executionMode || existing.txHash !== (input.txHash ?? null)) {
            throw new ConflictError('The idempotency key was already used for another transaction.')
          }
          await client.query('COMMIT')
          return { transaction: existing, duplicate: true }
        }
      }

      const transaction = await repository.createForTask(input.taskId, input.userId, input)
      if (!transaction) throw new NotFoundError('Task was not found.')

      await client.query('COMMIT')
      return { transaction, duplicate: false }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
