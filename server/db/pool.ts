import { Pool, type PoolClient } from 'pg'
import { getDatabaseConfig, type DatabaseEnvironment } from './config'

export type DatabasePool = Pick<Pool, 'connect' | 'query' | 'end'>

export function createDatabasePool(environment: DatabaseEnvironment = process.env): Pool {
  return new Pool(getDatabaseConfig(environment))
}

export async function withDatabaseClient<T>(
  pool: Pick<Pool, 'connect'>,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    return await operation(client)
  } finally {
    client.release()
  }
}

let defaultPool: Pool | undefined

export function getDefaultDatabasePool(): Pool {
  defaultPool ??= createDatabasePool()
  return defaultPool
}

export async function closeDefaultDatabasePool(): Promise<void> {
  if (!defaultPool) return
  const pool = defaultPool
  defaultPool = undefined
  await pool.end()
}
