import type { PoolConfig } from 'pg'

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseConfigurationError'
  }
}

export interface DatabaseEnvironment {
  DATABASE_URL?: string
  PGHOST?: string
  PGPORT?: string
  PGDATABASE?: string
  PGUSER?: string
  PGPASSWORD?: string
  PGSSL?: string
}

function required(environment: DatabaseEnvironment, name: keyof DatabaseEnvironment): string {
  const value = environment[name]?.trim()
  if (!value) {
    throw new DatabaseConfigurationError(`Missing required database configuration: ${name}.`)
  }
  return value
}

export function getDatabaseConfig(environment: DatabaseEnvironment = process.env): PoolConfig {
  const databaseUrl = environment.DATABASE_URL?.trim()
  const ssl = environment.PGSSL?.toLowerCase() === 'true'

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl,
    }
  }

  return {
    host: required(environment, 'PGHOST'),
    port: environment.PGPORT ? Number(environment.PGPORT) : 5432,
    database: required(environment, 'PGDATABASE'),
    user: required(environment, 'PGUSER'),
    password: required(environment, 'PGPASSWORD'),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl,
  }
}
