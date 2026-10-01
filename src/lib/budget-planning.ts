import { Money, MoneyError } from './money'

export type PlanningPolicyType = 'per_task' | 'agent'

export interface SafetyMargin {
  type: 'fixed' | 'percentage'
  value: string
}

export interface BudgetPlanningInput {
  estimatedCost: string
  maximumBudget: string
  safetyMargin: SafetyMargin
}

export interface BudgetPlanResult {
  estimatedCost: string
  safetyMargin: string
  recommendedBudget: string
  maximumBudget: string
  headroom: string
}

export interface PlanningPolicy {
  type: PlanningPolicyType
  limit: string
}

export interface PlanningPolicyResult {
  allowed: boolean
  recommendedBudget: string
  effectiveLimit: string | null
  limitingPolicy?: PlanningPolicy
  reason?: string
}

export class BudgetPlanningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetPlanningError'
  }
}

function money(value: string, field: string): Money {
  try {
    return Money.from(value)
  } catch (error) {
    if (error instanceof MoneyError) throw new BudgetPlanningError(`${field}: ${error.message}`)
    throw error
  }
}

export function calculateBudgetPlan(input: BudgetPlanningInput): BudgetPlanResult {
  const estimated = money(input.estimatedCost, 'estimatedCost')
  const maximum = money(input.maximumBudget, 'maximumBudget')
  let margin: Money

  try {
    if (input.safetyMargin.type === 'fixed') {
      margin = Money.from(input.safetyMargin.value)
    } else if (input.safetyMargin.type === 'percentage') {
      const percentage = Money.from(input.safetyMargin.value)
      if (percentage.compare(Money.from('100.000000')) > 0) {
        throw new BudgetPlanningError('safetyMargin percentage must not exceed 100.')
      }
      margin = Money.percentage(estimated, input.safetyMargin.value)
    } else {
      throw new BudgetPlanningError('safetyMargin type is invalid.')
    }
  } catch (error) {
    if (error instanceof BudgetPlanningError) throw error
    if (error instanceof MoneyError) throw new BudgetPlanningError(`safetyMargin: ${error.message}`)
    throw error
  }

  const recommended = estimated.add(margin)
  if (recommended.compare(maximum) > 0) {
    throw new BudgetPlanningError('recommendedBudget must not exceed maximumBudget.')
  }

  return {
    estimatedCost: estimated.toString(),
    safetyMargin: margin.toString(),
    recommendedBudget: recommended.toString(),
    maximumBudget: maximum.toString(),
    headroom: maximum.subtract(recommended).toString(),
  }
}

export function assessPlanningPolicies(
  recommendedBudget: string,
  policies: readonly PlanningPolicy[],
): PlanningPolicyResult {
  const recommended = money(recommendedBudget, 'recommendedBudget')
  let limitingPolicy: PlanningPolicy | undefined
  let effectiveLimit: Money | undefined

  for (const policy of policies) {
    let limit: Money
    try {
      limit = Money.from(policy.limit)
    } catch (error) {
      if (error instanceof MoneyError) throw new BudgetPlanningError(`policy.limit: ${error.message}`)
      throw error
    }
    if (!effectiveLimit || limit.compare(effectiveLimit) < 0) {
      effectiveLimit = limit
      limitingPolicy = policy
    }
  }

  if (effectiveLimit && recommended.compare(effectiveLimit) > 0) {
    return {
      allowed: false,
      recommendedBudget: recommended.toString(),
      effectiveLimit: effectiveLimit.toString(),
      limitingPolicy,
      reason: 'recommendedBudget exceeds the applicable planning policy limit.',
    }
  }

  return {
    allowed: true,
    recommendedBudget: recommended.toString(),
    effectiveLimit: effectiveLimit?.toString() ?? null,
    limitingPolicy,
  }
}
