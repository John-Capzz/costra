import { describe, expect, test } from 'bun:test'
import type { QueryResult, QueryResultRow } from 'pg'
import { SpendingRepository } from '../server/repositories/spending'

describe('Phase 2.7 persisted API routes', () => {
  test('authoritative routes no longer use demo or in-memory stores', async () => {
    for (const file of ['agents.ts', 'plans.ts', 'tasks.ts', 'spending.ts']) {
      const source = await Bun.file(`server/routes/${file}`).text()
      expect(source).not.toContain('DEMO_')
      expect(source).not.toContain('new Map')
      expect(source).toContain('requireAuthenticatedPrincipal')
    }
  })

  test('spending query is scoped to the authenticated user and uses persisted events', async () => {
    let queryText = ''
    let queryValues: readonly unknown[] | undefined
    const db = {
      async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
        queryText = text
        queryValues = values
        return { command: 'SELECT', fields: [], rowCount: 1, rows: [{ date: '2026-09-29', amount: '1.250000' }] } as QueryResult<T>
      },
    }
    const result = await new SpendingRepository(db).listDailyForUser('user-1', '2026-09-01', '2026-09-30')
    expect(result).toEqual([{ date: '2026-09-29', amount: '1.250000' }])
    expect(queryText).toContain('FROM execution_events')
    expect(queryText).toContain('a.user_id = $1')
    expect(queryValues).toEqual(['user-1', '2026-09-01', '2026-09-30'])
  })

  test('task creation SQL requires both principal ownership and linked-plan ownership', async () => {
    const source = await Bun.file('server/repositories/tasks.ts').text()
    expect(source).toContain('WHERE a.id = $1 AND a.user_id = $2')
    expect(source).toContain('linked_plan.agent_id = a.id')
  })
})
