import { describe, expect, test } from 'bun:test'
import { PostgresRateLimitStore } from '../server/middleware/rateLimit'

describe('Phase 6.5 distributed rate limiting', () => {
  test('increments a PostgreSQL bucket and rejects after the configured limit', async () => {
    const calls: string[] = []
    const client = {
      query: async (text: string) => {
        calls.push(text)
        if (text.includes('SELECT window_started_at')) return { rows: [{ window_started_at: new Date('2026-01-01T00:00:00.000Z'), request_count: 1 }], rowCount: 1 } as never
        return { rows: [], rowCount: 1 } as never
      },
      release: () => undefined,
    }
    const store = new PostgresRateLimitStore({ connect: async () => client })
    const result = await store.consume('ip:127.0.0.1', 1, new Date('2026-01-01T00:00:01.000Z'))
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(calls).toContain('BEGIN')
    expect(calls).toContain('COMMIT')
  })

  test('rolls back when the distributed store is unavailable', async () => {
    const calls: string[] = []
    const client = {
      query: async (text: string) => {
        calls.push(text)
        if (text.includes('SELECT window_started_at')) throw new Error('database unavailable')
        return { rows: [], rowCount: 0 } as never
      },
      release: () => undefined,
    }
    const store = new PostgresRateLimitStore({ connect: async () => client })
    await expect(store.consume('ip:127.0.0.1', 1)).rejects.toThrow('database unavailable')
    expect(calls).toContain('ROLLBACK')
  })
})
