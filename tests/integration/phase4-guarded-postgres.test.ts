import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { AgentRepository } from '../../server/repositories/agents'
import { PlanRepository } from '../../server/repositories/plans'
import { TaskRepository } from '../../server/repositories/tasks'
import { executeArcUsdcTransfer } from '../../server/services/arc-execution'
import { ArcAdapter } from '../../src/lib/arc-adapter'

class TestArcAdapter extends ArcAdapter {
  override executionFeeReserveUsdc(): string { return '0.006000' }
  override getExecutionAddress(): `0x${string}` { return `0x${'3'.repeat(40)}` }
  override async submitUsdcTransfer(): Promise<`0x${string}`> { return `0x${'e'.repeat(64)}` }
}

const integration = process.env.DATABASE_URL ? describe : describe.skip
let pool: ReturnType<typeof createDatabasePool>
let userId = ''
let agentId = ''
let planId = ''
let taskId = ''

integration('Phase 4.5 guarded reservation boundary', () => {
  beforeAll(async () => {
    pool = createDatabasePool()
    await runMigrations(pool)
    const user = await pool.query<{ id: string }>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [`phase4-guarded-${randomUUID()}@costra.test`, 'Phase 4 Guarded User'],
    )
    userId = user.rows[0].id
    agentId = (await new AgentRepository(pool).createForUser(userId, {
      name: 'Phase 4 Guarded Agent', budgetLimit: '1.000000', status: 'active',
    })).id
    const plan = await new PlanRepository(pool).createForUser(userId, {
      agentId, taskDescription: 'Guarded budget reservation', maxBudget: '1.000000',
      estimatedCost: '0.500000', safetyBuffer: '0.000000', recommendedBudget: '0.500000', confidence: '0.9000',
    })
    if (!plan) throw new Error('Expected plan')
    planId = plan.id
    const task = await new TaskRepository(pool).createForUser(userId, {
      agentId, planId, description: 'Guarded budget reservation', budget: '1.000000', estimated: '0.500000',
      idempotencyKey: `phase4-task-${randomUUID()}`,
    })
    if (!task) throw new Error('Expected task')
    taskId = task.id
  })

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM execution_requests WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM transactions WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId])
      await pool.query('DELETE FROM cost_items WHERE plan_id = $1', [planId])
      await pool.query('DELETE FROM cost_plans WHERE id = $1', [planId])
      await pool.query('DELETE FROM users WHERE id = $1', [userId])
    }
    await pool.end()
  })

  test('allows only one of two concurrent reservations that exceed the budget together', async () => {
    const tasks = new TaskRepository(pool)
    const results = await Promise.all([
      tasks.reserveSpendForUser(taskId, userId, '0.600000'),
      tasks.reserveSpendForUser(taskId, userId, '0.600000'),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    const current = await tasks.findByIdForUser(taskId, userId)
    expect(current?.reservedSpend).toBe('0.600000')
  })

  test('persists one controlled execution and returns it on an idempotent retry', async () => {
    const input = {
      userId, agentId, taskId, planId, amount: '0.200000', currency: 'USDC' as const,
      destination: `0x${'4'.repeat(40)}`, network: 'Arc Testnet' as const,
      mode: 'guarded' as const, idempotencyKey: `phase4-execution-${randomUUID()}`,
    }
    const adapter = new TestArcAdapter()
    const first = await executeArcUsdcTransfer(pool, adapter, input)
    const retry = await executeArcUsdcTransfer(pool, adapter, input)
    expect(first.duplicate).toBe(false)
    expect(first.transaction?.executionMode).toBe('real')
    expect(first.transaction?.status).toBe('pending')
    expect(retry.duplicate).toBe(true)
    expect(retry.executionId).toBe(first.executionId)
    expect(retry.transaction?.txHash).toBe(first.transaction?.txHash)
  })
})
