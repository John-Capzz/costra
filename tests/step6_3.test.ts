import { describe, expect, test } from 'bun:test'
import { createApiKeyInput, createApiKeySecret } from '../server/auth/api-key-management'
import { PostgresApiKeyManagementStore } from '../server/auth/api-key-management'
import { hashApiKey } from '../server/auth/service'

describe('Phase 6.3 API-key lifecycle foundation', () => {
  test('generates high-entropy prefixed secrets and stores only their hash input', () => {
    const secret = createApiKeySecret()
    expect(secret).toMatch(/^csk_[0-9a-f]{64}$/)
    expect(hashApiKey(secret)).not.toBe(secret)
  })

  test('creates a management input without retaining plaintext in the persistence input', () => {
    const result = createApiKeyInput('staging agent')
    expect(result.secret).toMatch(/^csk_[0-9a-f]{64}$/)
    expect(result.input).toEqual({ label: 'staging agent', keyHash: hashApiKey(result.secret) })
    expect(result.input).not.toHaveProperty('secret')
  })

  test('scopes metadata reads, creation, and revocation to the authenticated user', async () => {
    const calls: string[] = []
    const row = { id: 'key-1', label: 'agent', last_used_at: null, revoked_at: null, created_at: new Date() }
    const pool = {
      query: async (text: string) => {
        calls.push(text)
        return { rows: text.includes('RETURNING') ? [row] : [], rowCount: 1 } as never
      },
      connect: async () => { throw new Error('not used') },
    }
    const store = new PostgresApiKeyManagementStore(pool)

    await store.listForUser('user-1')
    await store.createForUser('user-1', { keyHash: 'hash', label: 'agent' })
    await store.revokeForUser('user-1', 'key-1')

    expect(calls[0]).toContain('WHERE user_id = $1')
    expect(calls[1]).toContain('INSERT INTO api_keys')
    expect(calls[2]).toContain('id = $1 AND user_id = $2')
  })

  test('rotates atomically and never returns the previous secret', async () => {
    const calls: string[] = []
    const row = { id: 'key-2', label: 'rotated', last_used_at: null, revoked_at: null, created_at: new Date() }
    const client = {
      query: async (text: string) => {
        calls.push(text)
        if (text.includes('RETURNING id::text')) return { rows: [row], rowCount: 1 } as never
        if (text.includes('RETURNING id')) return { rows: [{ id: 'key-1' }], rowCount: 1 } as never
        return { rows: [], rowCount: 1 } as never
      },
      release: () => undefined,
    }
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }) as never,
      connect: async () => client,
    }
    const store = new PostgresApiKeyManagementStore(pool)
    const result = await store.rotateForUser('user-1', 'key-1', { keyHash: 'new-hash', label: 'rotated' })

    expect(result?.id).toBe('key-2')
    expect(calls).toContain('BEGIN')
    expect(calls).toContain('COMMIT')
    expect(calls.some((call) => call.includes('UPDATE api_keys') && call.includes('user_id = $2'))).toBe(true)
  })
})
