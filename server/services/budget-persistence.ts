import { checkPolicies } from '../../src/lib/budget-engine'
import type { BudgetCheckResult } from '../../src/types'
import { BudgetPolicyRepository } from '../repositories/budget-policies'
import type { Queryable } from '../repositories/types'

export interface PersistedBudgetContext {
  taskTotal?: string
  dayTotal?: string
  agentTotal?: string
}

export async function checkPersistedPolicies(
  db: Queryable,
  userId: string,
  agentId: string,
  proposedSpend: string,
  context: PersistedBudgetContext = {},
): Promise<BudgetCheckResult> {
  if (!proposedSpend) throw new Error('proposedSpend is required.')

  const policies = await new BudgetPolicyRepository(db).listForAgent(userId, agentId)
  return checkPolicies(
    proposedSpend,
    policies.map((policy) => ({
      type: policy.type,
      limit: policy.limit,
    })),
    {
      taskTotal: context.taskTotal,
      dayTotal: context.dayTotal,
      agentTotal: context.agentTotal,
    },
  )
}
