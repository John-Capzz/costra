import type { Pool, QueryResultRow } from 'pg'
import type { BrowserSessionRecord, BrowserSessionStore } from './browser-session'
import { getDefaultDatabasePool } from '../db/pool'

interface UserRow extends QueryResultRow { id: string; email: string; name: string | null; password_hash: string | null }
interface SessionRow extends QueryResultRow { id: string; user_id: string; email: string; name: string | null; csrf_token: string; expires_at: Date; revoked_at: Date | null }

export class PostgresBrowserSessionStore implements BrowserSessionStore {
  constructor(private readonly configuredPool?: Pick<Pool, 'query'>) {}

  private get pool(): Pick<Pool, 'query'> { return this.configuredPool ?? getDefaultDatabasePool() }

  async findUserPassword(email: string) {
    const result = await this.pool.query<UserRow>(
      'SELECT id::text AS id, email, name, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email],
    )
    const row = result.rows[0]
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null
  }

  async createSession(input: { userId: string; tokenHash: string; csrfToken: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) {
    const result = await this.pool.query<{ id: string; expires_at: Date }>(
      `INSERT INTO browser_sessions (user_id, token_hash, csrf_token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text AS id, expires_at`,
      [input.userId, input.tokenHash, input.csrfToken, input.expiresAt, input.userAgent ?? null, input.ipAddress ?? null],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Session creation returned no record.')
    return { id: row.id, expiresAt: row.expires_at }
  }

  async findSessionByTokenHash(tokenHash: string, now: Date): Promise<BrowserSessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT s.id::text AS id, s.user_id::text AS user_id, u.email, u.name, s.csrf_token, s.expires_at, s.revoked_at
         FROM browser_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2
        LIMIT 1`,
      [tokenHash, now],
    )
    const row = result.rows[0]
    return row ? { id: row.id, userId: row.user_id, email: row.email, name: row.name, csrfToken: row.csrf_token, expiresAt: row.expires_at, revokedAt: row.revoked_at } : null
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.pool.query('UPDATE browser_sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, revokedAt])
  }
}

export function createPostgresBrowserSessionStore(options: { pool?: Pick<Pool, 'query'> } = {}): BrowserSessionStore {
  return new PostgresBrowserSessionStore(options.pool)
}
