import { describe, expect, test } from 'bun:test'
import { calculateActualExecutionCost, calculateReconciliationAmounts } from '../server/services/reconciliation'

describe('Phase 4.4 execution reconciliation', () => {
  test('adds confirmed transfer and fee using exact USDC arithmetic', () => {
    expect(calculateActualExecutionCost('1.100000', '0.080000')).toBe('1.180000')
    expect(calculateReconciliationAmounts({
      estimatedCost: '1.060000', budget: '5.000000', actualCost: '1.180000',
    })).toEqual({
      estimatedCost: '1.060000', budget: '5.000000', actualCost: '1.180000',
      variance: '0.120000', variancePct: '11.3208',
    })
  })

  test('supports negative and zero variance exactly', () => {
    expect(calculateReconciliationAmounts({ estimatedCost: '1.180000', budget: '5', actualCost: '1.060000' }).variance).toBe('-0.120000')
    expect(calculateReconciliationAmounts({ estimatedCost: '0', budget: '5', actualCost: '0' }).variancePct).toBe('0.0000')
  })
})
