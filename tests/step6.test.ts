import { describe, expect, test } from 'bun:test'
import type { Pool, QueryResult } from 'pg'
import { DatabaseConfigurationError, getDatabaseConfig } from '../server/db/config'
import { withDatabaseClient } from '../server/db/pool'
import { PostgresApiKeyStore } from '../server/auth/postgres-store'
import { authenticateApiKey, hashApiKey } from '../server/auth/service'
import { AuthenticationError, UnavailableError } from '../server/errors'

const API_KEY = 'costra_persisted_key_123'
const KEY_HASH = hashApiKey(API_KEY)

function fakePool(
  query: (text: string, values?: readonly unknown[]) => Promise<QueryResult>,
): Pick<Pool, 'query'> {
  return { query } as Pick<Pool, 'query'>
}

describe('PostgreSQL configuration', () => {
  test('rejects missing database configuration clearly', () => {
    expect(() => getDatabaseConfig({})).toThrow(DatabaseConfigurationError)
  })

  test('supports DATABASE_URL without embedding credentials in application code', () => {
    const config = getDatabaseConfig({ DATABASE_URL: 'postgresql://user:password@localhost/costra' })

    expect(config.connectionString).toBe('postgresql://user:password@localhost/costra')
    expect(config.max).toBe(10)
    expect(config.connectionTimeoutMillis).toBe(5_000)
  })
})

describe('PostgresApiKeyStore', () => {
  test('loads a persisted API key and associated user context by hash', async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = []
    const pool = fakePool(async (text, values) => {
      calls.push({ text, values })
      return {
        command: 'SELECT',
        fields: [],
        rowCount: 1,
        rows: [{ id: 'key-1', user_id: 'user-1', key_hash: KEY_HASH, revoked_at: null }],
      }
    })
    const store = new PostgresApiKeyStore({ pool })

    const record = await store.findByHash(KEY_HASH)

    expect(record).toEqual({
      id: 'key-1',
      userId: 'user-1',
      keyHash: KEY_HASH,
      revokedAt: null,
    })
    expect(calls[0]?.values).toEqual([KEY_HASH])
    expect(calls[0]?.text).toContain('INNER JOIN users')
  })

  test('returns null for an unknown key and preserves revocation data', async () => {
    const unknownStore = new PostgresApiKeyStore({
      pool: fakePool(async () => ({ command: 'SELECT', fields: [], rowCount: 0, rows: [] })),
    })
    expect(await unknownStore.findByHash('unknown-hash')).toBeNull()

    const revokedStore = new PostgresApiKeyStore({
      pool: fakePool(async () => ({
        command: 'SELECT',
        fields: [],
        rowCount: 1,
        rows: [{ id: 'key-2', user_id: 'user-2', key_hash: KEY_HASH, revoked_at: new Date() }],
      })),
    })
    const record = await revokedStore.findByHash(KEY_HASH)
    expect(record?.revokedAt).toBeInstanceOf(Date)
  })

  test('updates last_used_at for the persisted key', async () => {
    let values: readonly unknown[] | undefined
    const pool = fakePool(async (_text, queryValues) => {
      values = queryValues
      return { command: 'UPDATE', fields: [], rowCount: 1, rows: [] }
    })
    const store = new PostgresApiKeyStore({ pool })
    const usedAt = new Date('2026-09-28T10:00:00.000Z')

    await store.markLastUsed('key-1', usedAt)

    expect(values).toEqual(['key-1', usedAt])
  })
})

describe('database-backed authentication behavior', () => {
  test('authenticates a valid persisted key and records usage', async () => {
    let lastUsedValues: readonly unknown[] | undefined
    const pool = fakePool(async (text, values) => {
      if (text.includes('SELECT')) {
        return {
          command: 'SELECT',
          fields: [],
          rowCount: 1,
          rows: [{ id: 'key-1', user_id: 'user-1', key_hash: KEY_HASH, revoked_at: null }],
        }
      }
      lastUsedValues = values
      return { command: 'UPDATE', fields: [], rowCount: 1, rows: [] }
    })
    const principal = await authenticateApiKey(API_KEY, new PostgresApiKeyStore({ pool }))

    expect(principal.userId).toBe('user-1')
    expect(principal.apiKeyId).toBe('key-1')
    expect(lastUsedValues?.[0]).toBe('key-1')
  })

  test('rejects unknown and revoked persisted keys', async () => {
    const unknown = new PostgresApiKeyStore({
      pool: fakePool(async () => ({ command: 'SELECT', fields: [], rowCount: 0, rows: [] })),
    })
    await expect(authenticateApiKey(API_KEY, unknown)).rejects.toBeInstanceOf(AuthenticationError)

    const revoked = new PostgresApiKeyStore({
      pool: fakePool(async () => ({
        command: 'SELECT',
        fields: [],
        rowCount: 1,
        rows: [{ id: 'key-1', user_id: 'user-1', key_hash: KEY_HASH, revoked_at: new Date() }],
      })),
    })
    await expect(authenticateApiKey(API_KEY, revoked)).rejects.toBeInstanceOf(AuthenticationError)
  })

  test('fails closed when the database is unavailable', async () => {
    const unavailable = new PostgresApiKeyStore({
      pool: fakePool(async () => {
        throw new Error('connection refused: postgres://secret')
      }),
    })

    await expect(authenticateApiKey(API_KEY, unavailable)).rejects.toBeInstanceOf(UnavailableError)
  })
})

describe('database client lifecycle', () => {
  test('releases a checked-out client on success and failure', async () => {
    let released = 0
    const client = {
      release: () => { released += 1 },
    }
    const pool = { connect: async () => client } as unknown as Pick<Pool, 'connect'>

    await withDatabaseClient(pool, async () => 'ok')
    await expect(withDatabaseClient(pool, async () => { throw new Error('operation failed') })).rejects.toThrow('operation failed')

    expect(released).toBe(2)
  })
})
