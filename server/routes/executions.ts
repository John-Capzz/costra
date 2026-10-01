import { Router } from 'express'
import { asDatabaseUnavailable } from '../db/errors'
import { getDefaultDatabasePool } from '../db/pool'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { NotFoundError, UnavailableError, ValidationError } from '../errors'
import { ExecutionRequestRepository } from '../repositories/execution-requests'
import { ReconciliationRepository } from '../repositories/reconciliations'
import { TaskRepository } from '../repositories/tasks'
import { TransactionRepository } from '../repositories/transactions'
import type { DatabasePool, ExecutionRequestRecord, ReconciliationRecord, TransactionRecord } from '../repositories/types'
import { executeArcUsdcTransfer, trackArcUsdcTransaction } from '../services/arc-execution'
import { readArcTestnetExecutionConfig, ArcAdapter, ArcAdapterConfigurationError } from '../../src/lib/arc-adapter'
import { validateExecutionRequest, type ExecutionRequest } from '../../src/lib/execution-domain'
import { validateIdentifier, validateTransactionHash } from '../validation'

function serializeExecution(record: ExecutionRequestRecord) {
  return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
}

function serializeTransaction(record: TransactionRecord) {
  return { ...record, createdAt: record.createdAt.toISOString(), confirmedAt: record.confirmedAt?.toISOString() ?? null }
}

function serializeReconciliation(record: ReconciliationRecord) {
  return { ...record, completedAt: record.completedAt.toISOString() }
}

function executionAdapter(): ArcAdapter {
  try {
    return new ArcAdapter(readArcTestnetExecutionConfig())
  } catch (error) {
    if (error instanceof ArcAdapterConfigurationError) {
      throw new UnavailableError('Arc Testnet execution is not configured.')
    }
    throw error
  }
}

function requestFromBody(body: unknown, userId: string): ExecutionRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.')
  }
  try {
    return validateExecutionRequest({ ...(body as Record<string, unknown>), userId })
  } catch (error) {
    throw error instanceof Error ? new ValidationError(error.message) : error
  }
}

export function createExecutionsRouter(db?: DatabasePool) {
  const router = Router()

  router.post('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const request = requestFromBody(req.body, principal.userId)
      const result = await executeArcUsdcTransfer(
        db ?? getDefaultDatabasePool(),
        executionAdapter(),
        request,
      )
      res.status(result.duplicate ? 200 : 201).json({
        executionId: result.executionId,
        duplicate: result.duplicate,
        transaction: result.transaction ? serializeTransaction(result.transaction) : null,
      })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const record = await new ExecutionRequestRepository(db ?? getDefaultDatabasePool()).findByIdForUser(id, principal.userId)
      if (!record) throw new NotFoundError('Execution request was not found.')
      res.json(serializeExecution(record))
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.get('/:id/transaction', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const execution = await new ExecutionRequestRepository(db ?? getDefaultDatabasePool()).findByIdForUser(id, principal.userId)
      if (!execution) throw new NotFoundError('Execution request was not found.')
      if (!execution.txHash) return res.status(202).json({ execution: serializeExecution(execution), transaction: null })
      const transaction = await new TransactionRepository(db ?? getDefaultDatabasePool()).findByHashForUser(execution.txHash, principal.userId)
      if (!transaction) throw new NotFoundError('Transaction was not found.')
      res.json({ execution: serializeExecution(execution), transaction: serializeTransaction(transaction) })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.post('/:id/track', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const execution = await new ExecutionRequestRepository(db ?? getDefaultDatabasePool()).findByIdForUser(id, principal.userId)
      if (!execution?.txHash) throw new NotFoundError('A submitted transaction was not found for this execution.')
      const transaction = await trackArcUsdcTransaction(db ?? getDefaultDatabasePool(), executionAdapter(), { userId: principal.userId, txHash: validateTransactionHash(execution.txHash) as `0x${string}` })
      res.json({ executionId: execution.id, transaction: serializeTransaction(transaction) })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  return router
}

export function createExecutionRelatedRouter(db?: DatabasePool) {
  const router = Router()
  router.get('/tasks/:id/transactions', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const taskId = validateIdentifier(req.params.id, 'id')
      const task = await new TaskRepository(db ?? getDefaultDatabasePool()).findByIdForUser(taskId, principal.userId)
      if (!task) throw new NotFoundError('Task was not found.')
      const transactions = await new TransactionRepository(db ?? getDefaultDatabasePool()).listForTask(taskId, principal.userId)
      res.json({ transactions: transactions.map(serializeTransaction), total: transactions.length })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.get('/plans/:id/reconciliation', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const planId = validateIdentifier(req.params.id, 'id')
      const reconciliation = await new ReconciliationRepository(db ?? getDefaultDatabasePool()).findForPlan(planId, principal.userId)
      if (!reconciliation) throw new NotFoundError('Plan reconciliation was not found.')
      res.json(serializeReconciliation(reconciliation))
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })
  return router
}
