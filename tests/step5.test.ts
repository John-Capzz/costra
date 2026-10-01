import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import express from 'express'
import type { Server } from 'node:http'
import { AuthenticationError, UnavailableError } from '../server/errors'
import { errorHandler } from '../server/middleware/error'
import { requestIdMiddleware } from '../server/middleware/requestId'
import { createAuthMiddleware } from '../server/middleware/auth'
import type { ApiKeyRecord, ApiKeyStore } from '../server/auth/contracts'
import {
  authenticateApiKey,
  buildAuthenticatedPrincipal,
  hashApiKey,
} from '../server/auth/service'

const API_KEY = 'costra_test_key_123'
const NOW = new Date('2026-09-28T10:00:00.000Z')

class TestApiKeyStore implements ApiKeyStore {
  readonly records = new Map<string, ApiKeyRecord>()
  lastUsed: { id: string; at: Date } | undefined

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return this.records.get(keyHash) ?? null
  }

  async markLastUsed(apiKeyId: string, usedAt: Date): Promise<void> {
    this.lastUsed = { id: apiKeyId, at: usedAt }
  }
}

const validRecord: ApiKeyRecord = {
  id: 'key-123',
  userId: 'user-123',
  agentId: 'agent-123',
  keyHash: hashApiKey(API_KEY),
  revokedAt: null,
  lastUsedAt: null,
}

let server: Server
let baseUrl: string

beforeAll(async () => {
  const store = new TestApiKeyStore()
  store.records.set(validRecord.keyHash, validRecord)

  const app = express()
  app.use(requestIdMiddleware)
  app.use(createAuthMiddleware(store))
  app.get('/principal', (req, res) => res.json(req.principal))
  app.use(errorHandler)

  server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP address.')
  }
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

describe('authenticated principals', () => {
  test('constructs a principal from persisted key context', () => {
    expect(buildAuthenticatedPrincipal(validRecord, NOW)).toEqual({
      authMethod: 'api_key',
      apiKeyId: 'key-123',
      userId: 'user-123',
      agentId: 'agent-123',
      authenticatedAt: NOW,
    })
  })

  test('authenticates by hash and records last-used time', async () => {
    const store = new TestApiKeyStore()
    store.records.set(validRecord.keyHash, validRecord)

    const principal = await authenticateApiKey(API_KEY, store, () => NOW)

    expect(principal.userId).toBe('user-123')
    expect(principal.agentId).toBe('agent-123')
    expect(store.lastUsed).toEqual({ id: 'key-123', at: NOW })
  })
})

describe('fail-closed API-key behavior', () => {
  test('rejects an unknown API key', async () => {
    const store = new TestApiKeyStore()

    await expect(authenticateApiKey('costra_unknown_key', store)).rejects.toBeInstanceOf(AuthenticationError)
  })

  test('rejects a revoked API key', async () => {
    const store = new TestApiKeyStore()
    store.records.set(validRecord.keyHash, { ...validRecord, revokedAt: NOW })

    await expect(authenticateApiKey(API_KEY, store)).rejects.toBeInstanceOf(AuthenticationError)
  })

  test('rejects absent credentials without constructing a principal', async () => {
    const store = new TestApiKeyStore()

    await expect(authenticateApiKey(null, store)).rejects.toBeInstanceOf(AuthenticationError)
  })

  test('fails closed when persistence is not configured', async () => {
    await expect(authenticateApiKey(API_KEY, undefined)).rejects.toBeInstanceOf(UnavailableError)
  })
})

describe('authentication middleware boundary', () => {
  test('attaches the authenticated principal to the request', async () => {
    const response = await fetch(`${baseUrl}/principal`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      authMethod: 'api_key',
      apiKeyId: 'key-123',
      userId: 'user-123',
      agentId: 'agent-123',
    })
  })

  test('does not attach a principal when credentials are absent', async () => {
    const response = await fetch(`${baseUrl}/principal`, {
      headers: { 'X-Request-ID': 'auth-missing-test' },
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({
      error: 'unauthorized',
      message: 'Missing Authorization header. Use: Authorization: Bearer <api_key>',
      requestId: 'auth-missing-test',
    })
  })
})
