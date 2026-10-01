import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { createAuthMiddleware } from '../../server/middleware/auth'
import { PostgresApiKeyStore } from '../../server/auth/postgres-store'
import { hashApiKey } from '../../server/auth/service'
import { closeDefaultDatabasePool, createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { AgentRepository } from '../../server/repositories/agents'

const enabled = process.env.RUN_STAGING_E2E === 'true' && Boolean(process.env.DATABASE_URL)
const staging = enabled ? describe : describe.skip

let pool: ReturnType<typeof createDatabasePool>
let server: Server
let baseUrl = ''
let userId = ''
let otherUserId = ''
let agentId = ''
let planId = ''
let taskId = ''
const apiKey = `phase6-9-${randomUUID()}`
const otherApiKey = `phase6-9-other-${randomUUID()}`

async function api(path: string, init: RequestInit = {}, key = apiKey): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
}

staging('Phase 6.9 staging journey', () => {
  beforeAll(async () => {
    process.env.COSTRA_ENV = 'staging'
    process.env.CORS_ORIGIN = 'http://localhost:5173'
    process.env.ARC_TESTNET_RPC_URL = 'https://127.0.0.1:1'
    process.env.ARC_TESTNET_CHAIN_ID = '5042002'
    process.env.ARC_TESTNET_EXECUTION_PRIVATE_KEY = `0x${'1'.repeat(64)}`
    process.env.ARC_TESTNET_EXECUTION_ADDRESS = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A'

    pool = createDatabasePool()
    await runMigrations(pool)
    const users = await pool.query<{ id: string }>(
      'INSERT INTO users (email, name) VALUES ($1, $2), ($3, $4) RETURNING id',
      [`phase6-9-${randomUUID()}@costra.test`, 'Phase 6.9 User', `phase6-9-other-${randomUUID()}@costra.test`, 'Other User'],
    )
    userId = users.rows[0].id
    otherUserId = users.rows[1].id
    await pool.query('INSERT INTO api_keys (user_id, key_hash, label) VALUES ($1, $2, $3), ($4, $5, $6)', [
      userId, hashApiKey(apiKey), 'staging journey key', otherUserId, hashApiKey(otherApiKey), 'other user key',
    ])
    agentId = (await new AgentRepository(pool).createForUser(userId, {
      name: 'Phase 6.9 Agent', budgetLimit: '1.000000', status: 'active',
    })).id

    const app = createApp({ db: pool, auth: createAuthMiddleware(new PostgresApiKeyStore({ pool })) })
    server = app.listen(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Staging journey server did not start.')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    if (userId) {
      await pool.query('DELETE FROM reconciliations WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM execution_requests WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM transactions WHERE task_id = $1', [taskId])
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId])
      await pool.query('DELETE FROM cost_items WHERE plan_id = $1', [planId])
      await pool.query('DELETE FROM cost_plans WHERE id = $1', [planId])
      await pool.query('DELETE FROM users WHERE id = $1 OR id = $2', [userId, otherUserId])
    }
    await closeDefaultDatabasePool()
    await pool.end()
  })

  test('runs the persisted planning, budgeting, task, reconciliation, spending, and ownership journey', async () => {
    const planResponse = await api('/api/v1/plans', {
      method: 'POST',
      body: JSON.stringify({
        agentId, task: 'Validate staging cost planning', network: 'Arc Testnet', currency: 'USDC', maxBudget: '0.500000',
        safetyMargin: { type: 'fixed', value: '0.050000' },
        items: [{ id: 'api', type: 'api_call', label: 'Staging API', provider: 'fixture', unitPrice: '0.10000000', quantity: '1', confidence: '0.9000', source: 'estimation', currency: 'USDC' }],
      }),
    })
    expect(planResponse.status).toBe(201)
    const plan = await planResponse.json() as { id: string; estimatedCost: string; recommendedBudget: string }
    planId = plan.id
    expect(plan.estimatedCost).toBe('0.100000')
    expect(plan.recommendedBudget).toBe('0.150000')

    expect((await api(`/api/v1/plans/${planId}`)).status).toBe(200)

    const budgetResponse = await api('/api/v1/budget/check', {
      method: 'POST', body: JSON.stringify({ current: '0.000000', limit: '0.500000', proposedSpend: '0.100000' }),
    })
    expect(budgetResponse.status).toBe(200)
    expect((await budgetResponse.json()).allowed).toBe(true)

    const taskResponse = await api('/api/v1/tasks', {
      method: 'POST', body: JSON.stringify({ agentId, planId, description: 'Staging task', budget: '0.500000', estimated: '0.100000' }),
    })
    expect(taskResponse.status).toBe(201)
    taskId = (await taskResponse.json()).id

    const eventResponse = await api(`/api/v1/tasks/${taskId}/events`, {
      method: 'POST', body: JSON.stringify({ type: 'API_CALL', cost: '0.100000', provider: 'fixture', idempotencyKey: `event-${randomUUID()}` }),
    })
    expect(eventResponse.status).toBe(201)

    const reconcileResponse = await api(`/api/v1/tasks/${taskId}/reconcile`, { method: 'POST', body: '{}' })
    expect(reconcileResponse.status).toBe(200)

    const spendingResponse = await api('/api/v1/spending?limit=10&offset=0')
    expect(spendingResponse.status).toBe(200)

    const otherOwnerResponse = await api(`/api/v1/plans/${planId}`, {}, otherApiKey)
    expect(otherOwnerResponse.status).toBe(404)
  })

  test('fails controlled execution closed when Arc RPC is unavailable', async () => {
    const response = await api('/api/v1/executions', {
      method: 'POST',
      body: JSON.stringify({
        agentId, taskId, planId, amount: '0.100000', destination: `0x${'2'.repeat(40)}`,
        network: 'Arc Testnet', currency: 'USDC', mode: 'guarded', idempotencyKey: `execution-${randomUUID()}`,
      }),
    })
    expect(response.status).toBe(503)
    const body = await response.json() as { error: string; requestId: string }
    expect(body.error).toBe('unavailable')
    expect(body.requestId).toBeTruthy()
  })
})
