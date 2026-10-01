import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { createAuthMiddleware } from '../../server/middleware/auth'
import { PostgresApiKeyStore } from '../../server/auth/postgres-store'
import { hashApiKey } from '../../server/auth/service'
import { createDatabasePool } from '../../server/db/pool'
import { runMigrations } from '../../server/db/migrations'
import { AgentRepository } from '../../server/repositories/agents'

const integration = process.env.DATABASE_URL ? describe : describe.skip
let pool: ReturnType<typeof createDatabasePool>
let server: Server
let baseUrl = ''
let userId = ''
let agentId = ''
const apiKey = `phase3-api-${randomUUID()}`

integration('Phase 3 API contract', () => {
  beforeAll(async () => {
    pool = createDatabasePool()
    await runMigrations(pool)
    const user = await pool.query<{ id: string }>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [`phase3-api-${randomUUID()}@costra.test`, 'Phase 3 API User'],
    )
    userId = user.rows[0].id
    await pool.query('INSERT INTO api_keys (user_id, key_hash, label) VALUES ($1, $2, $3)', [userId, hashApiKey(apiKey), 'phase 3 API key'])
    const agent = await new AgentRepository(pool).createForUser(userId, {
      name: 'Phase 3 API Agent', budgetLimit: '10.000000', status: 'active',
    })
    agentId = agent.id

    const app = createApp({ db: pool, auth: createAuthMiddleware(new PostgresApiKeyStore({ pool })) })
    server = app.listen(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('API test server did not expose a TCP address.')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    if (userId) {
      await pool.query(
        'DELETE FROM cost_items WHERE plan_id IN (SELECT id FROM cost_plans WHERE agent_id = $1)',
        [agentId],
      )
      await pool.query('DELETE FROM cost_plans WHERE agent_id = $1', [agentId])
      await pool.query('DELETE FROM users WHERE id = $1', [userId])
    }
    await pool.end()
  })

  test('creates an exact plan through the authenticated API contract', async () => {
    const response = await fetch(`${baseUrl}/api/v1/plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        task: 'Collect and summarize research',
        network: 'Arc Testnet',
        currency: 'USDC',
        maxBudget: '1.000000',
        safetyMargin: { type: 'fixed', value: '0.100000' },
        items: [
          { id: 'api-1', type: 'api_call', label: 'Data access', provider: 'example-api', unitPrice: '0.42000000', quantity: '1', confidence: '0.90', source: 'estimation', currency: 'USDC' },
          { id: 'inference-1', type: 'inference', label: 'Inference', provider: 'example-model', unitPrice: '0.15500000', quantity: '2', confidence: '0.80', source: 'estimation', currency: 'USDC' },
        ],
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.currency).toBe('USDC')
    expect(body.network).toBe('Arc Testnet')
    expect(body.estimatedCost).toBe('0.730000')
    expect(body.safetyBuffer).toBe('0.100000')
    expect(body.recommendedBudget).toBe('0.830000')
    expect(body.maxBudget).toBe('1.000000')
    expect(body.items.map((item: { estimated: string }) => item.estimated)).toEqual(['0.420000', '0.310000'])
  })

  test('rejects unauthenticated and invalid exact planning requests', async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    expect(unauthenticated.status).toBe(401)

    const invalid = await fetch(`${baseUrl}/api/v1/plans`, {
      method: 'POST',
      headers: { Authorization: 'Bearer unknown-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [], agentId, task: 'Invalid', maxBudget: '1', safetyMargin: { type: 'fixed', value: '0' } }),
    })
    expect(invalid.status).toBe(401)
  })
})
