import { describe, expect, test } from 'bun:test'
import { CostraApiClient } from '../src/lib/api-client'

describe('Phase 5.5 analytics API contract', () => {
  test('requests validated spending query parameters through the API client', async () => {
    let url = ''
    const client = new CostraApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: async (input) => {
        url = String(input)
        return new Response(JSON.stringify({ series: [], total: 0 }), { status: 200 })
      },
    })

    await client.getSpending({ from: '2026-09-01', to: '2026-09-30', limit: 30, offset: 0 })
    expect(url).toBe('http://api.test/api/v1/spending?from=2026-09-01&to=2026-09-30&limit=30&offset=0')
  })
})
