import { estimateCost, type CostEstimationInput, type CostEstimationResult } from '../../src/lib/cost-engine'
import { withDatabaseClient } from '../db/pool'
import { PlanRepository, type CreateCostItemInput } from '../repositories/plans'
import type { CostItemRecord, CostPlanRecord, Queryable } from '../repositories/types'
import type { Pool } from 'pg'

export interface PersistedPlanResult {
  plan: CostPlanRecord
  items: CostItemRecord[]
}

function decimalForStorage(value: string, scale: number, field: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`${field} must be a valid decimal with no more than ${scale} places.`)
  }
  const [whole, rawFraction = ''] = value.split('.')
  const fraction = rawFraction.replace(/0+$/, '')
  if (fraction.length > scale) throw new Error(`${field} must be a valid decimal with no more than ${scale} places.`)
  return `${whole}.${fraction.padEnd(scale, '0')}`
}

function engineInputFromPersistedInput(input: PersistedPlanInput): CostEstimationInput {
  return {
    agentId: input.agentId,
    agentName: input.agentName,
    task: input.taskDescription,
    network: 'Arc Testnet',
    currency: 'USDC',
    maxBudget: input.maxBudget,
  }
}

function mapEstimationItems(estimation: CostEstimationResult): CreateCostItemInput[] {
  return estimation.items.map((item) => ({
    type: item.type,
    label: item.label,
    providerName: item.provider,
    unitPrice: decimalForStorage(item.unitPrice, 8, `${item.label}.unitPrice`),
    quantity: decimalForStorage(item.quantity, 4, `${item.label}.quantity`),
    estimated: decimalForStorage(item.estimated, 6, `${item.label}.estimated`),
    confidence: decimalForStorage(item.confidence, 4, `${item.label}.confidence`),
    source: item.source,
  }))
}

export interface PersistedPlanInput {
  userId: string
  agentId: string
  agentName: string
  taskDescription: string
  maxBudget: string
}

export async function persistEstimatedPlan(
  pool: Pick<Pool, 'connect'>,
  input: PersistedPlanInput,
): Promise<PersistedPlanResult | null> {
  const estimationInput = engineInputFromPersistedInput(input)
  const estimation = estimateCost(estimationInput)

  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const repository = new PlanRepository(client as Queryable)
      const plan = await repository.createForUser(input.userId, {
        agentId: input.agentId,
        taskDescription: input.taskDescription,
        maxBudget: input.maxBudget,
        estimatedCost: decimalForStorage(estimation.estimatedCost, 6, 'estimatedCost'),
        safetyBuffer: decimalForStorage(estimation.safetyBuffer, 6, 'safetyBuffer'),
        recommendedBudget: decimalForStorage(estimation.recommendedBudget, 6, 'recommendedBudget'),
        confidence: decimalForStorage(estimation.confidence, 4, 'confidence'),
      })

      if (!plan) {
        await client.query('ROLLBACK')
        return null
      }

      const items = await repository.createItemsForPlan(
        plan.id,
        input.userId,
        mapEstimationItems(estimation),
      )
      await client.query('COMMIT')
      return { plan, items }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
