import { describe, expect, test } from 'bun:test'
import type { QueryResult, QueryResultRow } from 'pg'
import {
  authorizeOwnedResource,
  assertOwnership,
  requireAuthenticatedPrincipal,
} from '../server/auth/authorization'
import { PostgresOwnershipResolver } from '../server/auth/postgres-ownership'
import type { AuthenticatedPrincipal } from '../server/auth/contracts'
import { AuthenticationError, AuthorizationError, UnavailableError } from '../server/errors'

const principal: AuthenticatedPrincipal = {
  authMethod: 'api_key',
  apiKeyId: 'key-1',
  userId: 'user-1',
  authenticatedAt: new Date('2026-09-29T10:00:00.000Z'),
}

function ownershipDb(userId: string | null, error?: Error) {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = []
  const db = {
    async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
      calls.push({ text, values })
      if (error) throw error
      const rows = userId ? [{ user_id: userId }] : []
      return { command: 'SELECT', fields: [], rowCount: rows.length, rows } as QueryResult<T>
    },
  }
  return { db, calls }
}

describe('Phase 2.3 ownership boundary', () => {
  test('requires an authenticated principal before checking ownership', () => {
    expect(() => requireAuthenticatedPrincipal(undefined)).toThrow(AuthenticationError)
  })

  test('accepts a persisted resource owned by the principal user', async () => {
    const { db } = ownershipDb('user-1')
    const resolver = new PostgresOwnershipResolver(db)

    await expect(authorizeOwnedResource(principal, resolver, 'plan', 'plan-1')).resolves.toBeUndefined()
  })

  test('rejects a resource owned by another user', async () => {
    const { db } = ownershipDb('other-user')
    const resolver = new PostgresOwnershipResolver(db)

    await expect(authorizeOwnedResource(principal, resolver, 'task', 'task-1'))
      .rejects.toBeInstanceOf(AuthorizationError)
  })

  test('fails closed when a resource has no resolvable owner', async () => {
    const { db } = ownershipDb(null)
    const resolver = new PostgresOwnershipResolver(db)

    await expect(authorizeOwnedResource(principal, resolver, 'transaction', 'tx-1'))
      .rejects.toBeInstanceOf(UnavailableError)
  })

  test('fails closed when ownership persistence is unavailable', async () => {
    const { db } = ownershipDb(null, new Error('database connection refused'))
    const resolver = new PostgresOwnershipResolver(db)

    await expect(authorizeOwnedResource(principal, resolver, 'agent', 'agent-1'))
      .rejects.toBeInstanceOf(UnavailableError)
  })

  test('never authorizes based on a supplied owner that differs from persisted ownership', () => {
    expect(() => assertOwnership(principal, { type: 'user', id: 'other-user' }))
      .toThrow(AuthorizationError)
  })

  test('uses parent ownership joins for nested resources', async () => {
    const { db, calls } = ownershipDb('user-1')
    const resolver = new PostgresOwnershipResolver(db)

    await resolver.resolveOwner('event', 'event-1')
    await resolver.resolveOwner('reconciliation', 'reconciliation-1')

    expect(calls[0]?.text).toContain('INNER JOIN tasks AS t')
    expect(calls[0]?.text).toContain('INNER JOIN agents AS a')
    expect(calls[1]?.text).toContain('INNER JOIN tasks AS t')
    expect(calls[1]?.text).toContain('INNER JOIN agents AS a')
    expect(calls.every((call) => call.values?.length === 1)).toBe(true)
  })
})
