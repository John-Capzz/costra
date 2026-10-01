import { describe, expect, test } from 'bun:test'
import { CostraApiClient } from '../src/lib/api-client'

describe('Phase 5.4 execution API contract', () => {
  test('submits explicit guarded execution values and does not coerce amount', async () => {
    let request: { url: string; body: Record<string, unknown> } | undefined
    const client = new CostraApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: async (input, init) => {
        request = { url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> }
        return new Response(JSON.stringify({ executionId: 'execution-1', duplicate: false, transaction: null }), { status: 201 })
      },
    })

    await client.execute({
      agentId: 'agent-1', taskId: 'task-1', planId: 'plan-1', amount: '0.400000',
      destination: `0x${'1'.repeat(40)}`, idempotencyKey: 'attempt-1',
    })

    expect(request?.url).toBe('http://api.test/api/v1/executions')
    expect(request?.body.amount).toBe('0.400000')
    expect(request?.body.mode).toBe('guarded')
    expect(request?.body.network).toBe('Arc Testnet')
  })
})
