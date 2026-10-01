import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Pool, PoolClient } from 'pg'

const MIGRATION_DIRECTORY = join(process.cwd(), 'db', 'migrations')
const MIGRATION_PATTERN = /^(\d{4}_[a-z0-9_]+)\.sql$/
const REQUIRED_BASELINE_TABLES = [
  'users',
  'api_keys',
  'providers',
  'agents',
  'budget_policies',
  'cost_plans',
  'cost_items',
  'services',
  'tasks',
  'execution_events',
  'transactions',
  'reconciliations',
] as const

export interface MigrationFile {
  version: string
  path: string
}

export interface MigrationResult {
  applied: string[]
  alreadyApplied: string[]
}

export async function listMigrationFiles(directory = MIGRATION_DIRECTORY): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = MIGRATION_PATTERN.exec(entry.name)
      return match ? { version: match[1], path: join(directory, entry.name) } : null
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left, right) => left.version.localeCompare(right.version))
}

async function ensureMigrationTable(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedVersions(client: Pick<PoolClient, 'query'>): Promise<Set<string>> {
  const result = await client.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  )
  return new Set(result.rows.map((row) => row.version))
}

async function applyMigration(client: PoolClient, migration: MigrationFile): Promise<void> {
  const sql = await readFile(migration.path, 'utf8')
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration.version],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

export async function verifyExistingBaseline(client: Pick<PoolClient, 'query'>): Promise<void> {
  const tableResult = await client.query<{ table_name: string }>(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = ANY($1::text[])
  `, [REQUIRED_BASELINE_TABLES])
  const found = new Set(tableResult.rows.map((row) => row.table_name))
  const missing = REQUIRED_BASELINE_TABLES.filter((table) => !found.has(table))
  if (missing.length > 0) {
    throw new Error(`Cannot baseline existing database; missing tables: ${missing.join(', ')}`)
  }

  const columnResult = await client.query<{ column_name: string }>(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'api_keys'
       AND column_name = ANY($1::text[])
  `, [['user_id', 'key_hash', 'last_used_at', 'revoked_at']])
  const foundColumns = new Set(columnResult.rows.map((row) => row.column_name))
  const missingColumns = ['user_id', 'key_hash', 'last_used_at', 'revoked_at']
    .filter((column) => !foundColumns.has(column))
  if (missingColumns.length > 0) {
    throw new Error(`Cannot baseline existing database; api_keys is missing: ${missingColumns.join(', ')}`)
  }
}

export async function baselineExistingDatabase(pool: Pick<Pool, 'connect'>): Promise<void> {
  const client = await pool.connect()
  try {
    await ensureMigrationTable(client)
    const applied = await getAppliedVersions(client)
    if (applied.has('0001_baseline')) return

    await verifyExistingBaseline(client)
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      ['0001_baseline'],
    )
  } finally {
    client.release()
  }
}

export async function runMigrations(
  pool: Pick<Pool, 'connect'>,
  directory = MIGRATION_DIRECTORY,
): Promise<MigrationResult> {
  const migrations = await listMigrationFiles(directory)
  const client = await pool.connect()
  const applied: string[] = []
  const alreadyApplied: string[] = []

  try {
    await ensureMigrationTable(client)
    const appliedVersions = await getAppliedVersions(client)

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        alreadyApplied.push(migration.version)
        continue
      }

      await applyMigration(client, migration)
      appliedVersions.add(migration.version)
      applied.push(migration.version)
    }
  } finally {
    client.release()
  }

  return { applied, alreadyApplied }
}
