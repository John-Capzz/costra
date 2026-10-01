import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { AgentRepository } from '../../server/repositories/agents'
import { BudgetPolicyRepository } from '../../server/repositories/budget-policies'
import { PlanRepository } from '../../server/repositories/plans'
import { persistExactPlan } from '../../server/services/phase3-plan-persistence'
import { ConflictError } from '../../server/errors'

const integration = process.env.DATABASE_URL ? describe : describe.skip
let pool: ReturnType<typeof createDatabasePool>
let userId = ''
let otherUserId = ''
let agentId = ''
let planId = ''

const items = [
  { id: 'api', type: 'api_call' as const, label: 'API', provider: 'Provider', unitPrice: '0.420000', quantity: '1', confidence: '0.9000', source: 'estimation' as const, currency: 'USDC' as const },
  { id: 'inference', type: 'inference' as const, label: 'Inference', provider: 'Model', unitPrice: '0.155000', quantity: '2', confidence: '0.8000', source: 'historical' as const, currency: 'USDC' as const },
]

integration('Phase 3 persisted exact planning', () => {
  beforeAll(async () => {
    pool = createDatabasePool()
    await runMigrations(pool)
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2), ($3, $4) RETURNING id`,
      [`phase3-${randomUUID()}@costra.test`, 'Phase 3 User', `phase3-${randomUUID()}@costra.test`, 'Other User'],
    )
    userId = users.rows[0].id
    otherUserId = users.rows[1].id
    agentId = (await new AgentRepository(pool).createForUser(userId, { name: 'Planning Agent', status: 'active' })).id
    await new BudgetPolicyRepository(pool).createForAgent(userId, agentId, { type: 'agent', limit: '5.000000' })
  })

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM cost_items WHERE plan_id = $1', [planId]).catch(() => undefined)
      await pool.query('DELETE FROM cost_plans WHERE agent_id = $1', [agentId]).catch(() => undefined)
      await pool.query('DELETE FROM budget_policies WHERE agent_id = $1', [agentId]).catch(() => undefined)
      await pool.query('DELETE FROM agents WHERE id = $1', [agentId]).catch(() => undefined)
      await pool.query('DELETE FROM users WHERE id = $1 OR id = $2', [userId, otherUserId])
    }
    await pool.end()
  })

  test('persists exact estimates, budget fields, and cost items', async () => {
    const result = await persistExactPlan(pool, {
      userId, agentId, taskDescription: 'Persisted exact plan', maximumBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.210000' }, items,
    })
    if (!result) throw new Error('Expected owned plan')
    planId = result.plan.id
    expect(result.plan.estimatedCost).toBe('0.730000')
    expect(result.plan.safetyBuffer).toBe('0.210000')
    expect(result.plan.recommendedBudget).toBe('0.940000')
    const persisted = await new PlanRepository(pool).listItemsForUser(planId, userId)
    expect(persisted.map((item) => item.estimated)).toEqual(['0.420000', '0.310000'])
    expect(persisted[1]?.unitPrice).toBe('0.15500000')
  })

  test('rejects a plan over the owned agent policy and rolls back', async () => {
    await new BudgetPolicyRepository(pool).createForAgent(userId, agentId, { type: 'per_task', limit: '0.500000' })
    await expect(persistExactPlan(pool, {
      userId, agentId, taskDescription: 'Rejected plan', maximumBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.210000' }, items,
    })).rejects.toBeInstanceOf(ConflictError)
    const plans = await new PlanRepository(pool).listForUser(userId, agentId)
    expect(plans).toHaveLength(1)
  })

  test('does not persist a plan for another user agent', async () => {
    const result = await persistExactPlan(pool, {
      userId: otherUserId, agentId, taskDescription: 'Cross-user plan', maximumBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.100000' }, items,
    })
    expect(result).toBeNull()
  })
})
