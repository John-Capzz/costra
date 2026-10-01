import { ConflictError, NotFoundError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { ReconciliationRepository, type CreateReconciliationInput } from '../repositories/reconciliations'
import { TaskRepository } from '../repositories/tasks'
import { PlanRepository } from '../repositories/plans'
import { TransactionRepository } from '../repositories/transactions'
import type { Queryable, ReconciliationRecord, TransactionRecord } from '../repositories/types'
import type { Pool } from 'pg'
import { Money, MoneyError } from '../../src/lib/money'

const MONEY_SCALE = 6
const PERCENT_SCALE = 4

function parseScaled(value: string, scale: number, field: string): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`${field} must be a non-negative decimal string.`)
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > scale) throw new Error(`${field} exceeds supported precision.`)
  return BigInt(whole) * (10n ** BigInt(scale)) + BigInt(fraction.padEnd(scale, '0') || '0')
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const unit = 10n ** BigInt(scale)
  const whole = absolute / unit
  const fraction = (absolute % unit).toString().padStart(scale, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n
  const negative = (numerator < 0n) !== (denominator < 0n)
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator) quotient += 1n
  return negative ? -quotient : quotient
}

export interface ReconciliationAmounts {
  estimatedCost: string
  budget: string
  actualCost: string
  variance: string
  variancePct: string
}

export function calculateReconciliationAmounts(input: {
  estimatedCost: string
  budget: string
  actualCost: string
}): ReconciliationAmounts {
  const estimated = parseScaled(input.estimatedCost, MONEY_SCALE, 'estimatedCost')
  const budget = parseScaled(input.budget, MONEY_SCALE, 'budget')
  const actual = parseScaled(input.actualCost, MONEY_SCALE, 'actualCost')
  const variance = actual - estimated
  const variancePct = estimated === 0n
    ? 0n
    : roundedDivide(variance * 100n * (10n ** BigInt(PERCENT_SCALE)), estimated)

  return {
    estimatedCost: formatScaled(estimated, MONEY_SCALE),
    budget: formatScaled(budget, MONEY_SCALE),
    actualCost: formatScaled(actual, MONEY_SCALE),
    variance: formatScaled(variance, MONEY_SCALE),
    variancePct: formatScaled(variancePct, PERCENT_SCALE),
  }
}

export function calculateActualExecutionCost(value: string, gasUsdc: string): string {
  try {
    return Money.from(normalizeUsdcScale(value, 'value'))
      .add(Money.from(normalizeUsdcScale(gasUsdc, 'gasUsdc')))
      .toString()
  } catch (error) {
    if (error instanceof MoneyError) throw new Error(`Execution cost is invalid: ${error.message}`)
    throw error
  }
}

function normalizeUsdcScale(value: string, field: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(`${field} must be a non-negative decimal string.`)
  const fraction = match[2] ?? ''
  if (fraction.length > 6 && /[^0]/.test(fraction.slice(6))) {
    throw new Error(`${field} exceeds USDC accounting precision.`)
  }
  return `${match[1]}.${fraction.slice(0, 6).padEnd(6, '0')}`
}

export interface ReconcileConfirmedTransactionResult {
  transaction: TransactionRecord
  reconciliation: ReconciliationRecord
  remainingHeadroom: string
}

export async function reconcileConfirmedTransaction(
  pool: Pick<Pool, 'connect'>,
  input: { transactionId: string; userId: string },
): Promise<ReconcileConfirmedTransactionResult> {
  return withDatabaseClient(pool, async (client) => {
    const db = client as Queryable
    const transactions = new TransactionRepository(db)
    const transaction = await transactions.findByIdForUser(input.transactionId, input.userId)
    if (!transaction) throw new NotFoundError('Transaction was not found.')
    if (transaction.status !== 'success') {
      throw new ConflictError('Only a confirmed successful transaction can be reconciled.')
    }
    if (!transaction.value || !transaction.gasUsdc) {
      throw new ConflictError('The confirmed transaction is missing settled cost data.')
    }

    const task = await new TaskRepository(db).findByIdForUser(transaction.taskId, input.userId)
    if (!task || !task.planId) throw new NotFoundError('Task or linked plan was not found.')
    const plan = await new PlanRepository(db).findByIdForUser(task.planId, input.userId)
    if (!plan || !plan.estimatedCost) throw new NotFoundError('The linked cost plan was not found.')

    const actualCost = calculateActualExecutionCost(transaction.value, transaction.gasUsdc)
    const reconciliation = await persistReconciliation(pool, {
      taskId: task.id,
      userId: input.userId,
      estimatedCost: plan.estimatedCost,
      budget: task.budget,
      actualCost,
      items: { execution: { transfer: transaction.value, fee: transaction.gasUsdc } },
    })
    return {
      transaction,
      reconciliation,
      remainingHeadroom: Money.from(task.budget).subtract(Money.from(actualCost)).toString(),
    }
  })
}

export interface PersistReconciliationInput {
  taskId: string
  userId: string
  estimatedCost: string
  budget: string
  actualCost: string
  items?: Record<string, unknown> | null
}

export async function persistReconciliation(
  pool: Pick<Pool, 'connect'>,
  input: PersistReconciliationInput,
): Promise<ReconciliationRecord> {
  const amounts = calculateReconciliationAmounts(input)
  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const db = client as Queryable
      const tasks = new TaskRepository(db)
      const reconciliations = new ReconciliationRepository(db)
      const task = await tasks.findByIdForUser(input.taskId, input.userId)
      if (!task) throw new NotFoundError('Task was not found.')

      const existing = await reconciliations.findForTask(input.taskId, input.userId)
      if (existing) throw new ConflictError('The task already has a reconciliation.')

      const record = await reconciliations.createForTask(input.taskId, input.userId, {
        ...amounts,
        items: input.items ?? null,
        status: 'completed',
      } satisfies CreateReconciliationInput)
      if (!record) throw new ConflictError('The reconciliation could not be persisted.')

      await client.query('COMMIT')
      return record
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
