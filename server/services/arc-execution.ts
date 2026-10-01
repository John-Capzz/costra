import { ConflictError, NotFoundError, UnavailableError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { TaskRepository } from '../repositories/tasks'
import { TransactionRepository } from '../repositories/transactions'
import { ExecutionRequestRepository } from '../repositories/execution-requests'
import type { Queryable, TransactionRecord } from '../repositories/types'
import type { Pool } from 'pg'
import { ArcAdapter } from '../../src/lib/arc-adapter'
import { validateExecutionRequest, type ExecutionRequest } from '../../src/lib/execution-domain'
import { Money } from '../../src/lib/money'
import { calculateActualExecutionCost } from './reconciliation'

export interface ExecuteArcTransferResult {
  transaction: TransactionRecord | null
  executionId: string
  duplicate: boolean
}

export async function executeArcUsdcTransfer(
  pool: Pick<Pool, 'connect'>,
  adapter: ArcAdapter,
  input: ExecutionRequest,
): Promise<ExecuteArcTransferResult> {
  const request = validateExecutionRequest(input)
  if (request.mode !== 'guarded') {
    throw new ConflictError('Only guarded requests can submit through the controlled Arc execution path.')
  }

  return withDatabaseClient(pool, async (client) => {
    const db = client as Queryable
    const task = await new TaskRepository(db).findByIdForUser(request.taskId, request.userId)
    if (!task || task.planId !== request.planId) throw new NotFoundError('Task or linked plan was not found.')

    const transactions = new TransactionRepository(db)
    const executions = new ExecutionRequestRepository(db)
    const reservedAmount = Money.from(request.amount).add(Money.from(adapter.executionFeeReserveUsdc())).toString()
    const existingExecution = await executions.findByIdempotencyKeyForUser(request.userId, request.idempotencyKey)
    if (existingExecution) {
      if (existingExecution.taskId !== request.taskId
        || existingExecution.planId !== request.planId
        || existingExecution.destination.toLowerCase() !== request.destination.toLowerCase()
        || existingExecution.amount !== request.amount) {
        throw new ConflictError('The idempotency key was already used for another execution.')
      }
      const existingTransaction = existingExecution.txHash
        ? await transactions.findByHashForUser(existingExecution.txHash, request.userId)
        : await transactions.findByIdempotencyKey(request.taskId, request.userId, request.idempotencyKey)
      if (existingTransaction && !existingExecution.txHash) {
        const repaired = await executions.updateSubmittedForUser(
          existingExecution.id,
          request.userId,
          existingTransaction.txHash ?? '',
        )
        if (!repaired) {
          throw new UnavailableError('The previous execution result requires persistence recovery.')
        }
      }
      if (!existingTransaction && !existingExecution.txHash) {
        throw new UnavailableError(
          'The previous execution attempt has an unknown outcome. Manual recovery is required before retrying.',
        )
      }
      return { transaction: existingTransaction, executionId: existingExecution.id, duplicate: true }
    }

    await client.query('BEGIN')
    try {
      const reserved = await new TaskRepository(db).reserveSpendForUser(request.taskId, request.userId, reservedAmount)
      if (!reserved) throw new ConflictError('The controlled payment exceeds the remaining task budget.')
      const execution = await executions.createApproved({
        userId: request.userId, agentId: task.agentId, taskId: task.id, planId: request.planId,
        amount: request.amount, reservedAmount, destination: request.destination,
        idempotencyKey: request.idempotencyKey,
      })
      if (!execution) throw new ConflictError('The execution request could not be created.')
      await client.query('COMMIT')

      let hash: `0x${string}`
      try {
        hash = await adapter.submitUsdcTransfer({ destination: request.destination, amount: request.amount })
      } catch (error) {
        await withDatabaseClient(pool, async (rollbackClient) => {
          await rollbackClient.query('BEGIN')
          try {
            await new TaskRepository(rollbackClient as Queryable).releaseReservedSpendForUser(request.taskId, request.userId, reservedAmount)
            await rollbackClient.query('COMMIT')
          } catch (releaseError) {
            await rollbackClient.query('ROLLBACK').catch(() => undefined)
            throw releaseError
          }
        })
        throw error
      }

      const transaction = await withDatabaseClient(pool, async (persistClient) => {
        const persistDb = persistClient as Queryable
        const created = await new TransactionRepository(persistDb).createForTask(request.taskId, request.userId, {
          txHash: hash, fromAddress: adapter.getExecutionAddress(), toAddress: request.destination,
          value: request.amount, status: 'pending', executionMode: 'real', idempotencyKey: request.idempotencyKey,
        })
        if (!created) throw new NotFoundError('Task was not found.')
        await new ExecutionRequestRepository(persistDb).updateSubmittedForUser(execution.id, request.userId, hash)
        return created
      })
      return { transaction, executionId: execution.id, duplicate: false }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}

export async function trackArcUsdcTransaction(
  pool: Pick<Pool, 'connect'>,
  adapter: ArcAdapter,
  input: { userId: string; txHash: `0x${string}` },
): Promise<TransactionRecord> {
  const transaction = await withDatabaseClient(pool, async (client) => {
    return new TransactionRepository(client as Queryable).findByHashForUser(input.txHash, input.userId)
  })
  if (!transaction) throw new NotFoundError('Transaction was not found.')

  const receipt = await adapter.getReceipt(input.txHash)
  const updated = await withDatabaseClient(pool, async (client) => {
    const db = client as Queryable
    await db.query('BEGIN')
    try {
      const saved = await new TransactionRepository(db).updateStatusForUser(transaction.id, input.userId, {
        status: receipt.status === 'success' ? 'success' : 'failed',
        gasUsdc: receipt.feeUsdc,
        blockNumber: receipt.blockNumber,
        confirmedAt: new Date(),
      })
      const execution = await new ExecutionRequestRepository(db).findByTxHashForUser(input.userId, input.txHash)
      if (execution) {
        const tasks = new TaskRepository(db)
        if (receipt.status === 'success') {
          await tasks.settleReservedSpendForUser(
            execution.taskId,
            input.userId,
            execution.reservedAmount,
            calculateActualExecutionCost(transaction.value ?? '0', receipt.feeUsdc),
          )
          await new ExecutionRequestRepository(db).updateStatusForUser(execution.id, input.userId, 'confirmed')
        } else {
          await tasks.releaseReservedSpendForUser(execution.taskId, input.userId, execution.reservedAmount)
          await new ExecutionRequestRepository(db).updateStatusForUser(execution.id, input.userId, 'failed')
        }
      }
      await db.query('COMMIT')
      return saved
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
  if (!updated) throw new NotFoundError('Transaction was not found.')
  return updated
}
