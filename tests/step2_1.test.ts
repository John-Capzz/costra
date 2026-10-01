import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PoolClient, QueryResult } from 'pg'
import {
  baselineExistingDatabase,
  listMigrationFiles,
  runMigrations,
  verifyExistingBaseline,
} from '../server/db/migrations'

interface FakeDatabase {
  applied: Set<string>
  began: number
  committed: number
  rolledBack: number
  released: number
  failMigration: boolean
}

function fakePool(database: FakeDatabase): Pick<PoolClient, 'connect'> {
  const client = {
    async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
      if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
        return { command: 'CREATE', fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text.includes('SELECT version FROM schema_migrations')) {
        return {
          command: 'SELECT',
          fields: [],
          rowCount: database.applied.size,
          rows: [...database.applied].map((version) => ({ version })),
        } as QueryResult<T>
      }
      if (text === 'BEGIN') {
        database.began += 1
        return { command: 'BEGIN', fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text === 'COMMIT') {
        database.committed += 1
        return { command: 'COMMIT', fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text === 'ROLLBACK') {
        database.rolledBack += 1
        return { command: 'ROLLBACK', fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text.includes('INSERT INTO schema_migrations')) {
        database.applied.add(String(values?.[0]))
        return { command: 'INSERT', fields: [], rowCount: 1, rows: [] } as QueryResult<T>
      }
      if (database.failMigration && text.includes('FAIL_MIGRATION')) {
        throw new Error('migration failed')
      }
      if (text.includes('information_schema.tables')) {
        return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
      }
      if (text.includes('information_schema.columns')) {
        return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
      }
      return { command: 'DO', fields: [], rowCount: null, rows: [] } as QueryResult<T>
    },
    release: () => { database.released += 1 },
  } as unknown as PoolClient

  return { connect: async () => client }
}

describe('Phase 2.1 migration foundation', () => {
  test('discovers ordered SQL migrations without including unrelated files', async () => {
    const migrations = await listMigrationFiles()
    expect(migrations.map((migration) => migration.version)).toEqual([
      '0001_baseline',
      '0002_domain_constraints',
      '0003_ownership_indexes',
      '0004_idempotency_constraints',
      '0005_task_lifecycle',
      '0006_transactions_reconciliation',
      '0007_guarded_execution',
      '0008_rate_limit_buckets',
      '0009_browser_auth',
    ])
  })

  test('applies migrations transactionally and skips applied versions', async () => {
    const database: FakeDatabase = {
      applied: new Set(),
      began: 0,
      committed: 0,
      rolledBack: 0,
      released: 0,
      failMigration: false,
    }
    const pool = fakePool(database)

    const first = await runMigrations(pool)
    const second = await runMigrations(pool)

    expect(first.applied).toEqual([
      '0001_baseline',
      '0002_domain_constraints',
      '0003_ownership_indexes',
      '0004_idempotency_constraints',
      '0005_task_lifecycle',
      '0006_transactions_reconciliation',
      '0007_guarded_execution',
      '0008_rate_limit_buckets',
      '0009_browser_auth',
    ])
    expect(second.applied).toEqual([])
    expect(second.alreadyApplied).toHaveLength(9)
    expect(database.began).toBe(9)
    expect(database.committed).toBe(9)
    expect(database.rolledBack).toBe(0)
    expect(database.released).toBe(2)
  })

  test('rolls back and does not record a failed migration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'costra-migrations-'))
    try {
      await writeFile(join(directory, '0001_failure.sql'), 'SELECT 1; -- FAIL_MIGRATION')
      const database: FakeDatabase = {
        applied: new Set(),
        began: 0,
        committed: 0,
        rolledBack: 0,
        released: 0,
        failMigration: true,
      }

      await expect(runMigrations(fakePool(database), directory)).rejects.toThrow('migration failed')
      expect(database.applied).toEqual(new Set())
      expect(database.began).toBe(1)
      expect(database.committed).toBe(0)
      expect(database.rolledBack).toBe(1)
      expect(database.released).toBe(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('requires all existing tables before accepting an explicit baseline', async () => {
    const database: FakeDatabase = {
      applied: new Set(),
      began: 0,
      committed: 0,
      rolledBack: 0,
      released: 0,
      failMigration: false,
    }
    await expect(verifyExistingBaseline((await fakePool(database).connect()))).rejects.toThrow(
      'Cannot baseline existing database',
    )
  })

  test('baseline command records only the baseline and releases its client', async () => {
    const database: FakeDatabase = {
      applied: new Set(['0001_baseline']),
      began: 0,
      committed: 0,
      rolledBack: 0,
      released: 0,
      failMigration: false,
    }
    const baselinePool = fakePool(database)
    await baselineExistingDatabase(baselinePool)
    expect(database.applied).toEqual(new Set(['0001_baseline']))
    expect(database.released).toBe(1)
  })

  test('baseline contains the Phase 1 authentication tables and domain tables', async () => {
    const sql = await readFile(join(process.cwd(), 'db', 'migrations', '0001_baseline.sql'), 'utf8')
    for (const table of [
      'users', 'api_keys', 'agents', 'budget_policies', 'cost_plans', 'cost_items',
      'tasks', 'execution_events', 'transactions', 'reconciliations',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`)
    }
    expect(sql).toContain('user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE')
    expect(sql).toContain('key_hash      TEXT NOT NULL UNIQUE')
    expect(sql).toContain('NUMERIC(18, 6)')
  })
})
