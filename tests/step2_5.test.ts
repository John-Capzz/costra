import { describe, expect, test } from 'bun:test'
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { transitionTask } from '../server/services/task-lifecycle'
import { ConflictError, NotFoundError } from '../server/errors'

const timestamp = new Date('2026-09-29T10:00:00.000Z')

function taskRow(lifecycleStatus: string) {
  return {
    id: 'task-1', agent_id: 'agent-1', plan_id: 'plan-1', description: 'Research',
    network: 'arc-testnet', currency: 'USDC', status: lifecycleStatus === 'reconciled' ? 'completed' : 'pending',
    lifecycle_status: lifecycleStatus, budget: '5.000000', estimated: '1.000000',
    current_spend: '0.000000', spending_mode: 'observe', idempotency_key: null,
    created_at: timestamp, updated_at: timestamp,
  }
}

function eventRow(type: string, idempotencyKey: string | null) {
  return {
    id: 'event-1', task_id: 'task-1', type, timestamp,
    cost: null, currency: 'USDC', description: null, provider: null,
    tx_hash: null, metadata: null, idempotency_key: idempotencyKey,
  }
}

function lifecyclePool(options: {
  current?: string | null
  existingEvent?: { type: string; idempotencyKey: string } | null
}) {
  const calls: string[] = []
  const current = options.current ?? 'planned'
  const client = {
    async query<T extends QueryResultRow>(text: string): Promise<QueryResult<T>> {
      calls.push(text)
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { command: text, fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text.includes('INSERT INTO execution_events')) {
        return {
          command: 'INSERT', fields: [], rowCount: 1,
          rows: [eventRow('TASK_BUDGETED', 'transition-key')],
        } as QueryResult<T>
      }
      if (text.includes('FROM tasks AS t')) {
        return {
          command: 'SELECT', fields: [], rowCount: options.current === null ? 0 : 1,
          rows: options.current === null ? [] : [taskRow(current)],
        } as QueryResult<T>
      }
      if (text.includes('FROM execution_events AS e')) {
        const existing = options.existingEvent
        return {
          command: 'SELECT', fields: [], rowCount: existing ? 1 : 0,
          rows: existing ? [eventRow(existing.type, existing.idempotencyKey)] : [],
        } as QueryResult<T>
      }
      if (text.startsWith('UPDATE tasks')) {
        const next = text.includes('lifecycle_status = $3') ? 'budgeted' : current
        return { command: 'UPDATE', fields: [], rowCount: 1, rows: [taskRow(next)] } as QueryResult<T>
      }
      return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
    },
    release: () => undefined,
  } as unknown as PoolClient

  return {
    pool: { connect: async () => client } as Pick<Pool, 'connect'>,
    calls,
  }
}

describe('Phase 2.5 persisted task lifecycle', () => {
  test('persists a legal transition and its lifecycle event in one transaction', async () => {
    const fake = lifecyclePool({ current: 'planned' })
    const result = await transitionTask(fake.pool, {
      taskId: 'task-1', userId: 'user-1', to: 'budgeted', idempotencyKey: 'transition-key',
    })

    expect(result.task.lifecycleStatus).toBe('budgeted')
    expect(result.event.type).toBe('TASK_BUDGETED')
    expect(result.duplicate).toBe(false)
    expect(fake.calls[0]).toBe('BEGIN')
    expect(fake.calls.at(-1)).toBe('COMMIT')
  })

  test('rejects an illegal transition and rolls back', async () => {
    const fake = lifecyclePool({ current: 'planned' })

    await expect(transitionTask(fake.pool, {
      taskId: 'task-1', userId: 'user-1', to: 'tracked',
    })).rejects.toBeInstanceOf(ConflictError)
    expect(fake.calls.at(-1)).toBe('ROLLBACK')
    expect(fake.calls.some((call) => call.startsWith('UPDATE tasks'))).toBe(false)
  })

  test('does not create a duplicate authoritative event for an idempotent retry', async () => {
    const fake = lifecyclePool({
      current: 'planned',
      existingEvent: { type: 'TASK_BUDGETED', idempotencyKey: 'transition-key' },
    })

    const result = await transitionTask(fake.pool, {
      taskId: 'task-1', userId: 'user-1', to: 'budgeted', idempotencyKey: 'transition-key',
    })

    expect(result.duplicate).toBe(true)
    expect(fake.calls.some((call) => call.includes('INSERT INTO execution_events'))).toBe(false)
  })

  test('rejects reuse of an idempotency key for a conflicting lifecycle event', async () => {
    const fake = lifecyclePool({
      current: 'planned',
      existingEvent: { type: 'TASK_FAILED', idempotencyKey: 'transition-key' },
    })

    await expect(transitionTask(fake.pool, {
      taskId: 'task-1', userId: 'user-1', to: 'budgeted', idempotencyKey: 'transition-key',
    })).rejects.toBeInstanceOf(ConflictError)
  })

  test('rejects transitions against another user task without guessing ownership', async () => {
    const fake = lifecyclePool({ current: null })

    await expect(transitionTask(fake.pool, {
      taskId: 'task-1', userId: 'other-user', to: 'budgeted',
    })).rejects.toBeInstanceOf(NotFoundError)
  })
})
