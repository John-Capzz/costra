import { randomBytes } from 'node:crypto'
import type { Pool, QueryResultRow } from 'pg'
import { withDatabaseClient } from '../db/pool'
import type { DatabasePool } from '../repositories/types'
import { hashApiKey } from './service'

export interface ManagedApiKey {
  id: string
  label: string | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export interface ApiKeyCreateInput {
  label?: string
  keyHash: string
}

export interface ApiKeyManagementStore {
  listForUser(userId: string): Promise<ManagedApiKey[]>
  createForUser(userId: string, input: ApiKeyCreateInput): Promise<ManagedApiKey>
  revokeForUser(userId: string, apiKeyId: string): Promise<boolean>
  rotateForUser(userId: string, apiKeyId: string, input: ApiKeyCreateInput): Promise<ManagedApiKey | null>
}

interface ApiKeyManagementRow extends QueryResultRow {
  id: string
  label: string | null
  last_used_at: Date | null
  revoked_at: Date | null
  created_at: Date
}

function mapRow(row: ApiKeyManagementRow): ManagedApiKey {
  return {
    id: row.id,
    label: row.label,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }
}

export class PostgresApiKeyManagementStore implements ApiKeyManagementStore {
  constructor(private readonly pool: Pick<Pool, 'query' | 'connect'>) {}

  async listForUser(userId: string): Promise<ManagedApiKey[]> {
    const result = await this.pool.query<ApiKeyManagementRow>(
      `SELECT id::text, label, last_used_at, revoked_at, created_at
         FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId],
    )
    return result.rows.map(mapRow)
  }

  async createForUser(userId: string, input: ApiKeyCreateInput): Promise<ManagedApiKey> {
    const result = await this.pool.query<ApiKeyManagementRow>(
      `INSERT INTO api_keys (user_id, key_hash, label)
       VALUES ($1, $2, $3)
       RETURNING id::text, label, last_used_at, revoked_at, created_at`,
      [userId, input.keyHash, input.label ?? null],
    )
    const row = result.rows[0]
    if (!row) throw new Error('API key creation returned no record.')
    return mapRow(row)
  }

  async revokeForUser(userId: string, apiKeyId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_keys
          SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [apiKeyId, userId],
    )
    return result.rowCount === 1
  }

  async rotateForUser(userId: string, apiKeyId: string, input: ApiKeyCreateInput): Promise<ManagedApiKey | null> {
    return withDatabaseClient(this.pool, async (client) => {
      await client.query('BEGIN')
      try {
        const revoked = await client.query(
          `UPDATE api_keys
              SET revoked_at = COALESCE(revoked_at, NOW())
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
            RETURNING id`,
          [apiKeyId, userId],
        )
        if (revoked.rowCount !== 1) {
          await client.query('ROLLBACK')
          return null
        }

        const created = await client.query<ApiKeyManagementRow>(
          `INSERT INTO api_keys (user_id, key_hash, label)
           VALUES ($1, $2, $3)
           RETURNING id::text, label, last_used_at, revoked_at, created_at`,
          [userId, input.keyHash, input.label ?? null],
        )
        await client.query('COMMIT')
        const row = created.rows[0]
        if (!row) throw new Error('API key rotation returned no record.')
        return mapRow(row)
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      }
    })
  }
}

export function createApiKeySecret(): string {
  return `csk_${randomBytes(32).toString('hex')}`
}

export function createApiKeyInput(label?: string): { secret: string; input: ApiKeyCreateInput } {
  const secret = createApiKeySecret()
  return { secret, input: { label, keyHash: hashApiKey(secret) } }
}
