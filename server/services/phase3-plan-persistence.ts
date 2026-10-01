import { ConflictError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { AgentRepository } from '../repositories/agents'
import { BudgetPolicyRepository } from '../repositories/budget-policies'
import { PlanRepository, type CreateCostItemInput } from '../repositories/plans'
import type { CostItemRecord, CostPlanRecord, DatabasePool } from '../repositories/types'
import { assessPlanningPolicies, calculateBudgetPlan, type BudgetPlanResult, type SafetyMargin } from '../../src/lib/budget-planning'
import { estimateCostItems, type CostEstimateResult, type CostItemEstimateInput } from '../../src/lib/estimation-engine'

export interface PersistExactPlanInput {
  userId: string
  agentId: string
  taskDescription: string
  maximumBudget: string
  safetyMargin: SafetyMargin
  items: readonly CostItemEstimateInput[]
}

export interface PersistedExactPlanResult {
  plan: CostPlanRecord
  items: CostItemRecord[]
  estimate: CostEstimateResult
  budget: BudgetPlanResult
}

function persistenceItems(items: CostEstimateResult['items']): CreateCostItemInput[] {
  return items.map((item) => ({
    type: item.type,
    label: item.label,
    providerName: item.provider,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    estimated: item.estimated,
    confidence: item.confidence,
    source: item.source,
  }))
}

export async function persistExactPlan(
  pool: DatabasePool,
  input: PersistExactPlanInput,
): Promise<PersistedExactPlanResult | null> {
  const estimate = estimateCostItems(input.items)
  const budget = calculateBudgetPlan({
    estimatedCost: estimate.estimatedCost,
    maximumBudget: input.maximumBudget,
    safetyMargin: input.safetyMargin,
  })

  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const db = client
      const agent = await new AgentRepository(db).findByIdForUser(input.agentId, input.userId)
      if (!agent) {
        await client.query('ROLLBACK')
        return null
      }

      const policies = await new BudgetPolicyRepository(db).listForAgent(input.userId, agent.id)
      const policyResult = assessPlanningPolicies(
        budget.recommendedBudget,
        policies
          .flatMap((policy) => policy.type === 'per_task' || policy.type === 'agent'
            ? [{ type: policy.type, limit: policy.limit }]
            : []),
      )
      if (!policyResult.allowed) {
        throw new ConflictError(policyResult.reason ?? 'The plan exceeds an applicable budget policy.')
      }

      const repository = new PlanRepository(db)
      const plan = await repository.createForUser(input.userId, {
        agentId: agent.id,
        taskDescription: input.taskDescription,
        maxBudget: budget.maximumBudget,
        estimatedCost: budget.estimatedCost,
        safetyBuffer: budget.safetyMargin,
        recommendedBudget: budget.recommendedBudget,
      })
      if (!plan) {
        await client.query('ROLLBACK')
        return null
      }

      const items = await repository.createItemsForPlan(plan.id, input.userId, persistenceItems(estimate.items))
      await client.query('COMMIT')
      return { plan, items, estimate, budget }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
