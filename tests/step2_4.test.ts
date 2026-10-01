import { describe, expect, test } from 'bun:test'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'
import { checkPersistedPolicies } from '../server/services/budget-persistence'
import { persistEstimatedPlan } from '../server/services/plan-persistence'

const planRow = {
  id: 'plan-1',
  agent_id: 'agent-1',
  task_description: 'Research Arc protocols',
  network: 'arc-testnet',
  currency: 'USDC',
  max_budget: '5.000000',
  estimated_cost: '1.234500',
  safety_buffer: '0.250000',
  recommended_budget: '1.484500',
  confidence: '0.8500',
  status: 'draft',
  created_at: new Date('2026-09-29T10:00:00.000Z'),
  updated_at: new Date('2026-09-29T10:00:00.000Z'),
}

const itemRow = {
  id: 'item-1',
  plan_id: 'plan-1',
  type: 'api_call',
  label: 'Data / API requests',
  provider_id: null,
  unit_price: '0.00180000',
  quantity: '233.0000',
  estimated: '0.419400',
  confidence: '0.9000',
  source: 'historical',
  created_at: new Date('2026-09-29T10:00:00.000Z'),
}

function persistencePool() {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = []
  let released = 0
  const client = {
    async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
      calls.push({ text, values })
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { command: text, fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text.includes('INSERT INTO cost_plans')) {
        return { command: 'INSERT', fields: [], rowCount: 1, rows: [planRow] } as QueryResult<T>
      }
      if (text.includes('INSERT INTO cost_items')) {
        return { command: 'INSERT', fields: [], rowCount: 1, rows: [itemRow] } as QueryResult<T>
      }
      return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
    },
    release: () => { released += 1 },
  } as unknown as PoolClient

  return {
    pool: { connect: async () => client } as Pick<PoolClient, 'connect'>,
    calls,
    released: () => released,
  }
}

describe('Phase 2.4 plan persistence', () => {
  test('runs the pure cost engine and persists fixed decimal plan/item values atomically', async () => {
    const fake = persistencePool()
    const result = await persistEstimatedPlan(fake.pool, {
      userId: 'user-1',
      agentId: 'agent-1',
      agentName: 'Research Agent',
      taskDescription: 'Research Arc protocols',
      maxBudget: '5.000000',
    })

    expect(result?.plan.id).toBe('plan-1')
    expect(result?.items[0]?.estimated).toBe('0.419400')
    expect(fake.calls[0]?.text).toBe('BEGIN')
    expect(fake.calls.at(-1)?.text).toBe('COMMIT')
    expect(fake.released()).toBe(1)

    const planInsert = fake.calls.find((call) => call.text.includes('INSERT INTO cost_plans'))
    expect(planInsert?.values?.every((value) => typeof value !== 'number')).toBe(true)
    const itemInsert = fake.calls.find((call) => call.text.includes('INSERT INTO cost_items'))
    expect(itemInsert?.values?.every((value) => typeof value !== 'number')).toBe(true)
  })

  test('rolls back when the requested agent is not owned by the user', async () => {
    const fake = persistencePool()
    const originalQuery = (await fake.pool.connect()).query
    void originalQuery
    // The repository returns null when the ownership-scoped INSERT finds no agent.
    const client = {
      async query<T extends QueryResultRow>(text: string): Promise<QueryResult<T>> {
        if (text === 'BEGIN' || text === 'ROLLBACK') {
          return { command: text, fields: [], rowCount: null, rows: [] } as QueryResult<T>
        }
        if (text.includes('INSERT INTO cost_plans')) {
          return { command: 'INSERT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
        }
        return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
      },
      release: () => undefined,
    } as unknown as PoolClient
    const pool = { connect: async () => client } as Pick<PoolClient, 'connect'>

    await expect(persistEstimatedPlan(pool, {
      userId: 'other-user',
      agentId: 'agent-1',
      agentName: 'Research Agent',
      taskDescription: 'Research Arc protocols',
      maxBudget: '5.000000',
    })).resolves.toBeNull()
  })
})

describe('Phase 2.4 persisted budget policies', () => {
  test('loads NUMERIC policy limits and evaluates them through the pure budget engine', async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = []
    const db = {
      async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
        calls.push({ text, values })
        return {
          command: 'SELECT',
          fields: [],
          rowCount: 1,
          rows: [{
            id: 'policy-1', agent_id: 'agent-1', type: 'per_task',
            limit_amt: '1.500000', currency: 'USDC',
            created_at: new Date('2026-09-29T10:00:00.000Z'),
          }],
        } as QueryResult<T>
      },
    }

    const allowed = await checkPersistedPolicies(db, 'user-1', 'agent-1', '1.250000')
    const blocked = await checkPersistedPolicies(db, 'user-1', 'agent-1', '2.000000')

    expect(allowed.allowed).toBe(true)
    expect(blocked.allowed).toBe(false)
    expect(calls[0]?.values).toEqual(['agent-1', 'user-1'])
  })
})
