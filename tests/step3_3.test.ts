import { describe, expect, test } from 'bun:test'
import { assessPlanningPolicies, BudgetPlanningError, calculateBudgetPlan } from '../src/lib/budget-planning'

describe('Phase 3.3 budget planning', () => {
  test('calculates an explicit fixed safety margin and headroom exactly', () => {
    expect(calculateBudgetPlan({
      estimatedCost: '1.060000', maximumBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.210000' },
    })).toEqual({
      estimatedCost: '1.060000', safetyMargin: '0.210000',
      recommendedBudget: '1.270000', maximumBudget: '5.000000', headroom: '3.730000',
    })
  })

  test('calculates percentage margins without floating-point arithmetic', () => {
    expect(calculateBudgetPlan({
      estimatedCost: '1.060000', maximumBudget: '5.000000',
      safetyMargin: { type: 'percentage', value: '20' },
    }).recommendedBudget).toBe('1.272000')
  })

  test('rejects invalid margins and a recommended budget over the maximum', () => {
    expect(() => calculateBudgetPlan({
      estimatedCost: '1.060000', maximumBudget: '1.000000',
      safetyMargin: { type: 'fixed', value: '0.210000' },
    })).toThrow(BudgetPlanningError)
    expect(() => calculateBudgetPlan({
      estimatedCost: '1.000000', maximumBudget: '5.000000',
      safetyMargin: { type: 'percentage', value: '101' },
    })).toThrow(BudgetPlanningError)
    expect(() => calculateBudgetPlan({
      estimatedCost: '-1.000000', maximumBudget: '5.000000',
      safetyMargin: { type: 'fixed', value: '0.000000' },
    })).toThrow(BudgetPlanningError)
  })

  test('applies the tightest resolved planning policy', () => {
    expect(assessPlanningPolicies('1.270000', [
      { type: 'agent', limit: '5.000000' },
      { type: 'per_task', limit: '1.500000' },
    ])).toMatchObject({ allowed: true, effectiveLimit: '1.500000', limitingPolicy: { type: 'per_task' } })
    expect(assessPlanningPolicies('1.270000', [
      { type: 'per_task', limit: '1.200000' },
    ])).toMatchObject({ allowed: false, effectiveLimit: '1.200000' })
  })
})
