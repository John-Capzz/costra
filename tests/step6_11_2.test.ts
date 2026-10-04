import { describe, expect, test } from 'bun:test'
import { createApp } from '../server/app'
import { hashPassword, hashSessionToken, type BrowserSessionRecord, type BrowserSessionStore } from '../server/auth/browser-session'
import { createAuthMiddleware } from '../server/middleware/auth'
import type { ApiKeyStore } from '../server/auth/contracts'

const user = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.test', name: 'Owner' }

function store(): BrowserSessionStore & { sessions: Map<string, BrowserSessionRecord>; revoked: string[] } {
  const sessions = new Map<string, BrowserSessionRecord>()
  const revoked: string[] = []
  return {
    sessions, revoked,
    async findUserPassword(email) { return email === user.email ? { ...user, passwordHash: await hashPassword('correct horse battery staple') } : null },
    async createSession(input) {
      const id = `session-${sessions.size + 1}`
      sessions.set(input.tokenHash, { id, userId: input.userId, email: user.email, name: user.name, csrfToken: input.csrfToken, expiresAt: input.expiresAt, revokedAt: null })
      return { id, expiresAt: input.expiresAt }
    },
    async findSessionByTokenHash(tokenHash, now) {
      const record = sessions.get(tokenHash)
      return record && record.expiresAt > now && !record.revokedAt ? record : null
    },
    async revokeSession(sessionId) { revoked.push(sessionId); for (const [key, record] of sessions) if (record.id === sessionId) sessions.set(key, { ...record, revokedAt: new Date() }) },
  }
}

const noApiKey: ApiKeyStore = { async findByHash() { return null }, async markLastUsed() {} }

async function start(store: BrowserSessionStore) {
  const app = createApp({ auth: createAuthMiddleware(noApiKey, store), browserSessionStore: store })
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

function cookieValue(response: Response, name: string): string {
  const header = response.headers.get('set-cookie') ?? ''
  const match = new RegExp(`${name}=([^;]+)`).exec(header)
  if (!match) throw new Error(`Missing ${name} cookie.`)
  return decodeURIComponent(match[1])
}

describe('Phase 6.11.2 browser authentication', () => {
  test('login establishes a session without exposing an API key', async () => {
    const sessions = store()
    const { server, baseUrl } = await start(sessions)
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'correct horse battery staple' }) })
      const body = await response.json() as { csrfToken?: string }
      expect(response.status).toBe(200)
      expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/)
      expect(response.headers.get('set-cookie')).toContain('HttpOnly')
      expect(response.headers.get('set-cookie')).not.toContain('costra_csrf')
      expect(response.headers.get('set-cookie')).not.toContain('api')
    } finally { server.close() }
  })

  test('invalid credentials fail safely', async () => {
    const sessions = store(); const { server, baseUrl } = await start(sessions)
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'wrong password' }) })
      expect(response.status).toBe(401)
      expect((await response.json()).message).not.toContain('password_hash')
    } finally { server.close() }
  })

  test('session authenticates /me and logout revokes it', async () => {
    const sessions = store(); const { server, baseUrl } = await start(sessions)
    try {
      const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'correct horse battery staple' }) })
      const loginBody = await login.json() as { csrfToken: string }
      const sessionCookie = cookieValue(login, 'costra_session')
      const csrf = await fetch(`${baseUrl}/api/v1/auth/csrf`, { headers: { cookie: `costra_session=${sessionCookie}` } })
      const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken
      expect(csrf.status).toBe(200)
      expect(csrfToken).toBe(loginBody.csrfToken)
      const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie: `costra_session=${sessionCookie}` } })
      expect(me.status).toBe(200)
      expect((await me.json()).user.email).toBe(user.email)
      const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: { cookie: `costra_session=${sessionCookie}`, 'x-csrf-token': csrfToken } })
      expect(logout.status).toBe(204)
      expect(sessions.revoked).toHaveLength(1)
      expect(hashSessionToken('secret')).not.toBe('secret')
    } finally { server.close() }
  })
})
