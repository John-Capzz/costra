import type { Pool, QueryResultRow } from 'pg'
import type { ApiKeyRecord, ApiKeyStore } from './contracts'
import { getDefaultDatabasePool } from '../db/pool'

interface ApiKeyRow extends QueryResultRow {
  id: string
  user_id: string
  key_hash: string
  revoked_at: Date | null
}

export interface ApiKeyStoreOptions {
  pool?: Pick<Pool, 'query'>
}

export class PostgresApiKeyStore implements ApiKeyStore {
  private readonly configuredPool?: Pick<Pool, 'query'>

  constructor(options: ApiKeyStoreOptions = {}) {
    this.configuredPool = options.pool
  }

  private getPool(): Pick<Pool, 'query'> {
    return this.configuredPool ?? getDefaultDatabasePool()
  }

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const result = await this.getPool().query<ApiKeyRow>(
      `SELECT ak.id::text AS id,
              ak.user_id::text AS user_id,
              ak.key_hash,
              ak.revoked_at
         FROM api_keys AS ak
         INNER JOIN users AS u ON u.id = ak.user_id
        WHERE ak.key_hash = $1
        LIMIT 1`,
      [keyHash],
    )
    const row = result.rows[0]
    if (!row) return null

    return {
      id: row.id,
      userId: row.user_id,
      keyHash: row.key_hash,
      revokedAt: row.revoked_at,
    }
  }

  async markLastUsed(apiKeyId: string, usedAt: Date): Promise<void> {
    const result = await this.getPool().query(
      `UPDATE api_keys
          SET last_used_at = $2
        WHERE id = $1
          AND revoked_at IS NULL`,
      [apiKeyId, usedAt],
    )

    if (result.rowCount !== 1) {
      throw new Error('API key was not available for last-used update.')
    }
  }
}

export function createPostgresApiKeyStore(options: ApiKeyStoreOptions = {}): ApiKeyStore {
  return new PostgresApiKeyStore(options)
}
