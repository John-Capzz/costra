import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { PostgresApiKeyStore } from '../../server/auth/postgres-store'
import { authenticateApiKey, hashApiKey } from '../../server/auth/service'
import { AgentRepository } from '../../server/repositories/agents'
import { PlanRepository } from '../../server/repositories/plans'
import { TaskRepository } from '../../server/repositories/tasks'
import { ExecutionEventRepository } from '../../server/repositories/events'
import { TransactionRepository } from '../../server/repositories/transactions'
import { ReconciliationRepository } from '../../server/repositories/reconciliations'
import { transitionTask } from '../../server/services/task-lifecycle'
import { recordTaskEvent } from '../../server/services/task-events'
import { persistTransaction } from '../../server/services/transaction-persistence'
import { persistReconciliation } from '../../server/services/reconciliation'

const integration = process.env.DATABASE_URL ? describe : describe.skip
const dates = { created: new Date(), updated: new Date() }
let pool: ReturnType<typeof createDatabasePool>
let userId = ''
let otherUserId = ''
let agentId = ''
let planId = ''
let taskId = ''
const apiKey = `costra-integration-${randomUUID()}`

integration('Phase 2 real PostgreSQL integration', () => {
  beforeAll(async () => {
    pool = createDatabasePool()
    await runMigrations(pool)

    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2), ($3, $4) RETURNING id`,
      [`integration-${randomUUID()}@costra.test`, 'Integration User', `integration-${randomUUID()}@costra.test`, 'Other User'],
    )
    userId = users.rows[0].id
    otherUserId = users.rows[1].id
    const keyHash = hashApiKey(apiKey)
    await pool.query(`INSERT INTO api_keys (user_id, key_hash, label) VALUES ($1, $2, $3)`, [userId, keyHash, 'integration key'])

    const agent = await new AgentRepository(pool).createForUser(userId, {
      name: 'Integration Agent', budgetLimit: '25.000000', status: 'active',
    })
    agentId = agent.id
    const plan = await new PlanRepository(pool).createForUser(userId, {
      agentId, taskDescription: 'Integration plan', maxBudget: '2.000000',
      estimatedCost: '1.000000', safetyBuffer: '0.100000', recommendedBudget: '1.100000', confidence: '0.9000',
    })
    if (!plan) throw new Error('Expected owned plan to be created')
    planId = plan.id
    const task = await new TaskRepository(pool).createForUser(userId, {
      agentId, planId, description: 'Integration task', budget: '2.000000', estimated: '1.000000', idempotencyKey: `task-${randomUUID()}`,
    })
    if (!task) throw new Error('Expected owned task to be created')
    taskId = task.id
  })

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM transactions WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM reconciliations WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM execution_events WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId])
      await pool.query('DELETE FROM cost_items WHERE plan_id = $1', [planId])
      await pool.query('DELETE FROM cost_plans WHERE id = $1', [planId])
      await pool.query('DELETE FROM api_keys WHERE user_id = $1', [userId])
      await pool.query('DELETE FROM users WHERE id = $1 OR id = $2', [userId, otherUserId])
    }
    await pool.end()
  })

  test('migration chain and schema metadata are present', async () => {
    const migrations = await pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
    expect(migrations.rows.map((row) => row.version)).toEqual([
      '0001_baseline', '0002_domain_constraints', '0003_ownership_indexes',
      '0004_idempotency_constraints', '0005_task_lifecycle', '0006_transactions_reconciliation', '0007_guarded_execution', '0008_rate_limit_buckets', '0009_browser_auth', '0010_session_csrf_tokens',
    ])
    const foreignKeys = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'`)
    expect(Number(foreignKeys.rows[0].count)).toBeGreaterThanOrEqual(10)
  })

  test('looks up a real API key and updates last_used_at', async () => {
    const principal = await authenticateApiKey(apiKey, new PostgresApiKeyStore({ pool }))
    expect(principal.userId).toBe(userId)
    const row = await pool.query<{ last_used_at: Date | null }>('SELECT last_used_at FROM api_keys WHERE user_id = $1', [userId])
    expect(row.rows[0].last_used_at).toBeInstanceOf(Date)
  })

  test('rejects revoked API keys against real PostgreSQL', async () => {
    const revokedKey = `revoked-${randomUUID()}`
    await pool.query('INSERT INTO api_keys (user_id, key_hash, revoked_at) VALUES ($1, $2, NOW())', [userId, hashApiKey(revokedKey)])
    await expect(authenticateApiKey(revokedKey, new PostgresApiKeyStore({ pool }))).rejects.toThrow()
  })

  test('persists agents and scopes retrieval by owner', async () => {
    expect((await new AgentRepository(pool).findByIdForUser(agentId, userId))?.id).toBe(agentId)
    expect(await new AgentRepository(pool).findByIdForUser(agentId, otherUserId)).toBeNull()
  })

  test('persists plans and tasks with ownership scope', async () => {
    expect((await new PlanRepository(pool).findByIdForUser(planId, userId))?.agentId).toBe(agentId)
    expect(await new PlanRepository(pool).findByIdForUser(planId, otherUserId)).toBeNull()
    expect((await new TaskRepository(pool).findByIdForUser(taskId, userId))?.planId).toBe(planId)
    expect(await new TaskRepository(pool).findByIdForUser(taskId, otherUserId)).toBeNull()
  })

  test('persists lifecycle events and makes event retries idempotent', async () => {
    const lifecycle = await transitionTask(pool, { taskId, userId, to: 'budgeted', idempotencyKey: `lifecycle-${randomUUID()}` })
    const eventKey = `event-${randomUUID()}`
    const first = await recordTaskEvent(pool, { taskId, userId, event: { type: 'API_CALL', cost: '0.100000', idempotencyKey: eventKey } })
    const retry = await recordTaskEvent(pool, { taskId, userId, event: { type: 'API_CALL', cost: '0.100000', idempotencyKey: eventKey } })
    expect(lifecycle.event.type).toBe('TASK_BUDGETED')
    expect(first.event.type).toBe('API_CALL')
    expect(retry.duplicate).toBe(true)
    expect((await new ExecutionEventRepository(pool).listForTask(taskId, userId)).length).toBeGreaterThanOrEqual(1)
  })

  test('persists transactions and reconciliation records', async () => {
    const transaction = await persistTransaction(pool, { taskId, userId, executionMode: 'simulated', value: '0.250000', idempotencyKey: `tx-${randomUUID()}` })
    expect(transaction.transaction.executionMode).toBe('simulated')
    expect((await new TransactionRepository(pool).listForTask(taskId, userId)).length).toBe(1)
    const reconciliation = await persistReconciliation(pool, { taskId, userId, estimatedCost: '1.000000', budget: '2.000000', actualCost: '0.250000' })
    expect(reconciliation.actualCost).toBe('0.250000')
    expect((await new ReconciliationRepository(pool).findForTask(taskId, userId))?.status).toBe('completed')
  })
})
