import { Money } from './money'

export type BudgetState = 'within' | 'approaching' | 'blocked' | 'completed'
export interface BudgetPolicy { type: 'per_task' | 'per_transaction' | 'daily' | 'agent' | 'service'; limit: string }
export interface BudgetCheckResult { allowed: boolean; reason?: string; current: string; proposedSpend: string; limit: string; remaining: string }

export function deriveBudgetState(current: string, limit: string): BudgetState {
  const spent = Money.from(current)
  const maximum = Money.from(limit)
  if (spent.compare(maximum) >= 0 || maximum.isZero()) return 'blocked'
  if (spent.compare(Money.multiplyDecimal(maximum.toString(), '0.8')) >= 0) return 'approaching'
  return 'within'
}

export function checkBudget(current: string, limit: string, proposedSpend: string): BudgetCheckResult {
  const spent = Money.from(current)
  const maximum = Money.from(limit)
  const proposed = Money.from(proposedSpend)
  const remaining = maximum.subtract(spent)
  if (proposed.compare(remaining) > 0) {
    return { allowed: false, reason: `Proposed spend $${proposed.toString()} exceeds remaining budget $${remaining.toString()}`, current: spent.toString(), proposedSpend: proposed.toString(), limit: maximum.toString(), remaining: remaining.toString() }
  }
  return { allowed: true, current: spent.toString(), proposedSpend: proposed.toString(), limit: maximum.toString(), remaining: remaining.toString() }
}

export function checkPolicies(proposedSpend: string, policies: BudgetPolicy[], context: { taskTotal?: string; dayTotal?: string; agentTotal?: string } = {}): BudgetCheckResult & { policy?: BudgetPolicy } {
  for (const policy of policies) {
    const current = policy.type === 'per_task' ? context.taskTotal ?? '0' : policy.type === 'daily' ? context.dayTotal ?? '0' : policy.type === 'agent' ? context.agentTotal ?? '0' : '0'
    const result = checkBudget(current, policy.limit, proposedSpend)
    if (!result.allowed) return { ...result, policy }
    if (policy.type === 'per_transaction' && Money.from(proposedSpend).compare(Money.from(policy.limit)) > 0) {
      return { allowed: false, reason: `Single spend $${Money.from(proposedSpend).toString()} exceeds per-transaction limit $${Money.from(policy.limit).toString()}`, current: '0.000000', proposedSpend: Money.from(proposedSpend).toString(), limit: Money.from(policy.limit).toString(), remaining: Money.from(policy.limit).toString(), policy }
    }
  }
  return { allowed: true, current: context.taskTotal ?? '0.000000', proposedSpend: Money.from(proposedSpend).toString(), limit: '0.000000', remaining: '0.000000' }
}

export function computeVariance(estimated: string, actual: string): { variance: string; variancePct: string } {
  const expected = Money.from(estimated)
  const observed = Money.from(actual)
  const variance = observed.subtract(expected)
  if (expected.isZero()) return { variance: variance.toString(), variancePct: '0.00' }
  // Percentage is presentation output; authoritative money remains exact strings.
  return { variance: variance.toString(), variancePct: Money.percentOf(variance, expected, 2) }
}
