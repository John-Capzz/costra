import { describe, expect, test } from 'bun:test'
import type { QueryResult, QueryResultRow } from 'pg'
import { AgentRepository } from '../server/repositories/agents'
import { BudgetPolicyRepository } from '../server/repositories/budget-policies'
import { ExecutionEventRepository } from '../server/repositories/events'
import { PlanRepository } from '../server/repositories/plans'
import { ReconciliationRepository } from '../server/repositories/reconciliations'
import { TaskRepository } from '../server/repositories/tasks'
import { TransactionRepository } from '../server/repositories/transactions'

const dates = {
  created: new Date('2026-09-29T10:00:00.000Z'),
  updated: new Date('2026-09-29T10:01:00.000Z'),
}

function fakeDb() {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = []
  const db = {
    async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
      calls.push({ text, values })
      let row: QueryResultRow
      if (text.includes('budget_policies')) {
        row = {
          id: 'policy-1', agent_id: 'agent-1', type: 'per_task', limit_amt: '5.000000',
          currency: 'USDC', created_at: dates.created,
        }
      } else if (text.includes('cost_items')) {
        row = {
          id: 'item-1', plan_id: 'plan-1', type: 'inference', label: 'Inference',
          provider_id: null, unit_price: '0.10000000', quantity: '2.0000',
          estimated: '0.200000', confidence: '0.9500', source: 'estimation',
          created_at: dates.created,
        }
      } else if (text.includes('cost_plans')) {
        row = {
          id: 'plan-1', agent_id: 'agent-1', task_description: 'Research',
          network: 'arc-testnet', currency: 'USDC', max_budget: '5.000000',
          estimated_cost: '1.250000', safety_buffer: '0.125000',
          recommended_budget: '1.375000', confidence: '0.9000', status: 'draft',
          created_at: dates.created, updated_at: dates.updated,
        }
      } else if (text.includes('execution_events')) {
        row = {
          id: 'event-1', task_id: 'task-1', type: 'API_CALL', timestamp: dates.created,
          cost: '0.125000', currency: 'USDC', description: 'Provider call', provider: 'Example',
          tx_hash: null, metadata: { simulated: true }, idempotency_key: 'event-key',
        }
      } else if (text.includes('transactions')) {
        row = {
          id: 'transaction-1', task_id: 'task-1', tx_hash: `0x${'a'.repeat(64)}`,
          network: 'arc-testnet', from_addr: null, to_addr: null, value: '0.500000',
          currency: 'USDC', gas_usdc: '0.00600000', status: 'pending',
          block_number: null, confirmed_at: null, created_at: dates.created,
        }
      } else if (text.includes('reconciliations')) {
        row = {
          id: 'reconciliation-1', task_id: 'task-1', estimated_cost: '1.000000',
          budget: '2.000000', actual_cost: '1.250000', variance: '0.250000',
          variance_pct: '25.0000', items: { inference: '1.25' }, completed_at: dates.created,
        }
      } else if (text.includes('tasks AS t')) {
        row = {
          id: 'task-1', agent_id: 'agent-1', plan_id: 'plan-1', description: 'Research',
          network: 'arc-testnet', currency: 'USDC', status: 'pending', budget: '2.000000',
          estimated: '1.000000', current_spend: '0.000000', spending_mode: 'observe',
          idempotency_key: 'task-key', created_at: dates.created, updated_at: dates.updated,
        }
      } else if (text.includes('agents AS a')) {
        row = {
          id: 'agent-1', user_id: 'user-1', name: 'Research Agent', description: null,
          status: 'idle', spending_mode: 'observe', budget_limit: '50.000000',
          planning_accuracy: '0.00', total_spend: '0.000000',
          created_at: dates.created, updated_at: dates.updated,
        }
      }
      return { command: 'SELECT', fields: [], rowCount: 1, rows: [row] } as QueryResult<T>
    },
  }
  return { db, calls }
}

describe('Phase 2.2 focused repositories', () => {
  test('agent repository scopes reads and preserves NUMERIC values as strings', async () => {
    const { db, calls } = fakeDb()
    const agent = await new AgentRepository(db).findByIdForUser('agent-1', 'user-1')

    expect(agent?.userId).toBe('user-1')
    expect(agent?.budgetLimit).toBe('50.000000')
    expect(calls[0]?.values).toEqual(['agent-1', 'user-1'])
  })

  test('policy and plan repositories require user ownership in SQL', async () => {
    const { db, calls } = fakeDb()
    const policies = await new BudgetPolicyRepository(db).listForAgent('user-1', 'agent-1')
    const plan = await new PlanRepository(db).findByIdForUser('plan-1', 'user-1')

    expect(policies[0]?.limit).toBe('5.000000')
    expect(plan?.estimatedCost).toBe('1.250000')
    expect(calls[0]?.text).toContain('a.user_id = $2')
    expect(calls[1]?.text).toContain('a.user_id = $2')
  })

  test('task repository scopes persisted tasks through their agent', async () => {
    const { db, calls } = fakeDb()
    const task = await new TaskRepository(db).findByIdForUser('task-1', 'user-1')

    expect(task?.budget).toBe('2.000000')
    expect(task?.currentSpend).toBe('0.000000')
    expect(calls[0]?.text).toContain('INNER JOIN agents AS a')
    expect(calls[0]?.values).toEqual(['task-1', 'user-1'])
  })

  test('event, transaction, and reconciliation repositories scope through the task owner', async () => {
    const { db, calls } = fakeDb()
    const event = await new ExecutionEventRepository(db).listForTask('task-1', 'user-1')
    const transaction = await new TransactionRepository(db).listForTask('task-1', 'user-1')
    const reconciliation = await new ReconciliationRepository(db).findForTask('task-1', 'user-1')

    expect(event[0]?.cost).toBe('0.125000')
    expect(transaction[0]?.value).toBe('0.500000')
    expect(reconciliation?.variance).toBe('0.250000')
    expect(calls.every((call) => call.text.includes('a.user_id = $2'))).toBe(true)
  })

  test('write methods use parameterized ownership predicates', async () => {
    const { db, calls } = fakeDb()
    await new TaskRepository(db).createForUser('user-1', {
      agentId: 'agent-1', description: 'Research', budget: '2.000000',
    })
    await new ExecutionEventRepository(db).appendForTask('task-1', 'user-1', {
      type: 'API_CALL', cost: '0.125000', idempotencyKey: 'event-key',
    })
    await new TransactionRepository(db).createForTask('task-1', 'user-1', {
      txHash: `0x${'a'.repeat(64)}`, value: '0.500000',
    })

    expect(calls[0]?.text).toContain('WHERE a.id = $1 AND a.user_id = $2')
    expect(calls[1]?.text).toContain('WHERE t.id = $1 AND a.user_id = $2')
    expect(calls[2]?.text).toContain('WHERE t.id = $1 AND a.user_id = $2')
    expect(calls.every((call) => call.text.includes('$'))).toBe(true)
  })
})
