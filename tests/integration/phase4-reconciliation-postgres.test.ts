import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { AgentRepository } from '../../server/repositories/agents'
import { PlanRepository } from '../../server/repositories/plans'
import { TaskRepository } from '../../server/repositories/tasks'
import { TransactionRepository } from '../../server/repositories/transactions'
import { reconcileConfirmedTransaction } from '../../server/services/reconciliation'

const integration = process.env.DATABASE_URL ? describe : describe.skip
let pool: ReturnType<typeof createDatabasePool>
let userId = ''
let agentId = ''
let planId = ''
let taskId = ''
let transactionId = ''

integration('Phase 4.4 real PostgreSQL reconciliation', () => {
  beforeAll(async () => {
    pool = createDatabasePool()
    await runMigrations(pool)
    const user = await pool.query<{ id: string }>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [`phase4-recon-${randomUUID()}@costra.test`, 'Phase 4 Reconciliation User'],
    )
    userId = user.rows[0].id
    agentId = (await new AgentRepository(pool).createForUser(userId, {
      name: 'Phase 4 Reconciliation Agent', budgetLimit: '10.000000', status: 'active',
    })).id
    const plan = await new PlanRepository(pool).createForUser(userId, {
      agentId, taskDescription: 'Execute confirmed transfer', maxBudget: '5.000000',
      estimatedCost: '1.060000', safetyBuffer: '0.210000', recommendedBudget: '1.270000', confidence: '0.9000',
    })
    if (!plan) throw new Error('Expected plan')
    planId = plan.id
    const task = await new TaskRepository(pool).createForUser(userId, {
      agentId, planId, description: 'Execute confirmed transfer', budget: '5.000000', estimated: '1.060000',
      idempotencyKey: `phase4-task-${randomUUID()}`,
    })
    if (!task) throw new Error('Expected task')
    taskId = task.id
    const transaction = await new TransactionRepository(pool).createForTask(taskId, userId, {
      txHash: `0x${'c'.repeat(64)}`,
      fromAddress: `0x${'1'.repeat(40)}`,
      toAddress: `0x${'2'.repeat(40)}`,
      value: '1.100000', gasUsdc: '0.080000', status: 'success',
      executionMode: 'real', idempotencyKey: `phase4-tx-${randomUUID()}`,
      blockNumber: '42', confirmedAt: new Date(),
    })
    if (!transaction) throw new Error('Expected transaction')
    transactionId = transaction.id
  })

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM reconciliations WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM transactions WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId])
      await pool.query('DELETE FROM cost_items WHERE plan_id = $1', [planId])
      await pool.query('DELETE FROM cost_plans WHERE id = $1', [planId])
      await pool.query('DELETE FROM users WHERE id = $1', [userId])
    }
    await pool.end()
  })

  test('reconciles transfer plus fee and preserves exact variance/headroom', async () => {
    const result = await reconcileConfirmedTransaction(pool, { transactionId, userId })
    expect(result.transaction.status).toBe('success')
    expect(result.reconciliation.estimatedCost).toBe('1.060000')
    expect(result.reconciliation.actualCost).toBe('1.180000')
    expect(result.reconciliation.variance).toBe('0.120000')
    expect(result.remainingHeadroom).toBe('3.820000')
  })

  test('does not treat a pending transaction as settled spending', async () => {
    const pending = await new TransactionRepository(pool).createForTask(taskId, userId, {
      txHash: `0x${'d'.repeat(64)}`, toAddress: `0x${'2'.repeat(40)}`, value: '0.100000',
      status: 'pending', executionMode: 'real', idempotencyKey: `phase4-pending-${randomUUID()}`,
    })
    if (!pending) throw new Error('Expected pending transaction')
    await expect(reconcileConfirmedTransaction(pool, { transactionId: pending.id, userId })).rejects.toThrow(
      'Only a confirmed successful transaction can be reconciled',
    )
    await pool.query('DELETE FROM transactions WHERE id = $1', [pending.id])
  })
})
