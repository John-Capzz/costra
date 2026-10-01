import { describe, expect, test } from 'bun:test'
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { calculateReconciliationAmounts, persistReconciliation } from '../server/services/reconciliation'
import { persistTransaction } from '../server/services/transaction-persistence'
import { ConflictError } from '../server/errors'

const timestamp = new Date('2026-09-29T10:00:00.000Z')

function transactionRow() {
  return {
    id: 'transaction-1', task_id: 'task-1', tx_hash: null, network: 'arc-testnet',
    from_addr: null, to_addr: null, value: '0.750000', currency: 'USDC',
    gas_usdc: '0.00600000', status: 'pending', block_number: null,
    confirmed_at: null, created_at: timestamp, execution_mode: 'simulated',
    idempotency_key: 'transaction-key',
  }
}

function taskRow() {
  return {
    id: 'task-1', agent_id: 'agent-1', plan_id: 'plan-1', description: 'Research',
    network: 'arc-testnet', currency: 'USDC', status: 'executing',
    lifecycle_status: 'tracked', budget: '2.000000', estimated: '1.000000',
    current_spend: '0.750000', spending_mode: 'observe', idempotency_key: null,
    created_at: timestamp, updated_at: timestamp,
  }
}

function reconciliationRow() {
  return {
    id: 'reconciliation-1', task_id: 'task-1', estimated_cost: '1.000000',
    budget: '2.000000', actual_cost: '0.750000', variance: '-0.250000',
    variance_pct: '-25.0000', items: { inference: { actual: '0.75' } },
    completed_at: timestamp, status: 'completed',
  }
}

function fakePool(options: { existingTransaction?: boolean; existingReconciliation?: boolean } = {}) {
  const calls: string[] = []
  const client = {
    async query<T extends QueryResultRow>(text: string): Promise<QueryResult<T>> {
      calls.push(text)
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { command: text, fields: [], rowCount: null, rows: [] } as QueryResult<T>
      }
      if (text.includes('FROM transactions AS tr')) {
        return {
          command: 'SELECT', fields: [], rowCount: options.existingTransaction ? 1 : 0,
          rows: options.existingTransaction ? [transactionRow()] : [],
        } as QueryResult<T>
      }
      if (text.includes('INSERT INTO transactions')) {
        return { command: 'INSERT', fields: [], rowCount: 1, rows: [transactionRow()] } as QueryResult<T>
      }
      if (text.includes('FROM reconciliations AS r')) {
        return {
          command: 'SELECT', fields: [], rowCount: options.existingReconciliation ? 1 : 0,
          rows: options.existingReconciliation ? [reconciliationRow()] : [],
        } as QueryResult<T>
      }
      if (text.includes('INSERT INTO reconciliations')) {
        return { command: 'INSERT', fields: [], rowCount: 1, rows: [reconciliationRow()] } as QueryResult<T>
      }
      if (text.includes('FROM tasks AS t')) {
        return { command: 'SELECT', fields: [], rowCount: 1, rows: [taskRow()] } as QueryResult<T>
      }
      return { command: 'SELECT', fields: [], rowCount: 0, rows: [] } as QueryResult<T>
    },
    release: () => undefined,
  } as unknown as PoolClient

  return { pool: { connect: async () => client } as Pick<Pool, 'connect'>, calls }
}

describe('Phase 2.6 reconciliation precision', () => {
  test('calculates negative variance without floating-point arithmetic', () => {
    expect(calculateReconciliationAmounts({
      estimatedCost: '1.000000', budget: '2.000000', actualCost: '0.750000',
    })).toEqual({
      estimatedCost: '1.000000', budget: '2.000000', actualCost: '0.750000',
      variance: '-0.250000', variancePct: '-25.0000',
    })
  })

  test('rejects over-precise authoritative money input', () => {
    expect(() => calculateReconciliationAmounts({
      estimatedCost: '1.0000001', budget: '2.000000', actualCost: '1.000000',
    })).toThrow('exceeds supported precision')
  })

  test('persists a simulated transaction with explicit provenance and supports idempotency', async () => {
    const fake = fakePool()
    const result = await persistTransaction(fake.pool, {
      taskId: 'task-1', userId: 'user-1', txHash: null, value: '0.750000',
      executionMode: 'simulated', idempotencyKey: 'transaction-key',
    })

    expect(result.transaction.executionMode).toBe('simulated')
    expect(result.transaction.txHash).toBeNull()
    expect(result.duplicate).toBe(false)
    expect(fake.calls.at(-1)).toBe('COMMIT')
  })

  test('rejects conflicting transaction reuse of an idempotency key', async () => {
    const fake = fakePool({ existingTransaction: true })

    await expect(persistTransaction(fake.pool, {
      taskId: 'task-1', userId: 'user-1', txHash: `0x${'a'.repeat(64)}`,
      executionMode: 'observed', idempotencyKey: 'transaction-key',
    })).rejects.toBeInstanceOf(ConflictError)
  })

  test('persists reconciliation breakdown and status through the owned task', async () => {
    const fake = fakePool()
    const result = await persistReconciliation(fake.pool, {
      taskId: 'task-1', userId: 'user-1', estimatedCost: '1.000000',
      budget: '2.000000', actualCost: '0.750000',
      items: { inference: { estimated: '1.00', actual: '0.75', provider: 'OpenAI' } },
    })

    expect(result.status).toBe('completed')
    expect(result.variance).toBe('-0.250000')
    expect(result.variancePct).toBe('-25.0000')
    expect(fake.calls.at(-1)).toBe('COMMIT')
  })

  test('does not create a second reconciliation for the same task', async () => {
    const fake = fakePool({ existingReconciliation: true })

    await expect(persistReconciliation(fake.pool, {
      taskId: 'task-1', userId: 'user-1', estimatedCost: '1.000000',
      budget: '2.000000', actualCost: '0.750000',
    })).rejects.toBeInstanceOf(ConflictError)
  })
})
