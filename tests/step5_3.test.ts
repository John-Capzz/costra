import { describe, expect, test } from 'bun:test'
import { CostraApiClient } from '../src/lib/api-client'

describe('Phase 5.3 planning and task API contracts', () => {
  test('submits exact plan values without converting monetary strings to numbers', async () => {
    let body: Record<string, unknown> | undefined
    const client = new CostraApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ id: 'plan-1', agentId: 'agent-1' }), { status: 201 })
      },
    })

    await client.createExactPlan({
      agentId: 'agent-1', task: 'Research', maxBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.250000' },
      items: [{
        id: 'item-1', type: 'api_call', label: 'API', provider: 'Provider',
        unitPrice: '0.00180000', quantity: '233.0000', confidence: '0.9000',
        source: 'historical', currency: 'USDC',
      }],
    })

    expect(body?.maxBudget).toBe('5.000000')
    expect((body?.items as Array<Record<string, unknown>>)[0].unitPrice).toBe('0.00180000')
    expect((body?.items as Array<Record<string, unknown>>)[0].quantity).toBe('233.0000')
  })

  test('uses the authenticated task list endpoint', async () => {
    let url = ''
    const client = new CostraApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: async (input) => {
        url = String(input)
        return new Response(JSON.stringify({ tasks: [], total: 0 }), { status: 200 })
      },
    })

    await client.getTasks()
    expect(url).toBe('http://api.test/api/v1/tasks')
  })
})
