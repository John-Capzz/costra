// ============================================================
// COSTRA — Budget Engine
// Spending limit checks, state derivation, enforcement
// ============================================================

import type { BudgetState, BudgetCheckResult, BudgetPolicy } from '@/types'

// ---- Budget state -----------------------------------------

export function deriveBudgetState(current: number, limit: number): BudgetState {
  if (current >= limit) return 'blocked'
  if (current / limit >= 0.80) return 'approaching'
  return 'within'
}

// ---- Budget check -----------------------------------------
// A spend request passes through COSTRA before execution.
// Returns whether the spend is allowed and the reason if not.

export function checkBudget(
  current:       number,
  limit:         number,
  proposedSpend: number,
): BudgetCheckResult {
  const remaining = limit - current

  if (proposedSpend > remaining) {
    return {
      allowed:       false,
      reason:        `Proposed spend $${proposedSpend.toFixed(4)} exceeds remaining budget $${remaining.toFixed(4)}`,
      current,
      proposedSpend,
      limit,
      remaining,
    }
  }

  return { allowed: true, current, proposedSpend, limit, remaining }
}

// ---- Policy enforcement -----------------------------------
// Checks a proposed spend against all relevant policies.

export function checkPolicies(
  proposedSpend: number,
  policies:      BudgetPolicy[],
  context: {
    taskTotal?:    number
    dayTotal?:     number
    agentTotal?:   number
  } = {},
): BudgetCheckResult & { policy?: BudgetPolicy } {
  for (const policy of policies) {
    let current = 0

    switch (policy.type) {
      case 'per_transaction': current = 0; break
      case 'per_task':        current = context.taskTotal  ?? 0; break
      case 'daily':           current = context.dayTotal   ?? 0; break
      case 'agent':           current = context.agentTotal ?? 0; break
      default:                continue
    }

    const result = checkBudget(current, policy.limit, proposedSpend)
    if (!result.allowed) {
      return { ...result, policy }
    }

    // Per-tx limit: proposedSpend itself must not exceed limit
    if (policy.type === 'per_transaction' && proposedSpend > policy.limit) {
      return {
        allowed:       false,
        reason:        `Single spend $${proposedSpend.toFixed(4)} exceeds per-transaction limit $${policy.limit.toFixed(4)}`,
        current:       0,
        proposedSpend,
        limit:         policy.limit,
        remaining:     policy.limit,
        policy,
      }
    }
  }

  return {
    allowed:       true,
    current:       context.taskTotal ?? 0,
    proposedSpend,
    limit:         Infinity,
    remaining:     Infinity,
  }
}

// ---- Reconciliation variance ------------------------------

export function computeVariance(estimated: number, actual: number) {
  const variance    = +(actual - estimated).toFixed(6)
  const variancePct = estimated === 0 ? 0 : +(((actual - estimated) / estimated) * 100).toFixed(2)
  return { variance, variancePct }
}
