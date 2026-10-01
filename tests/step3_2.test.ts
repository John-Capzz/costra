import { describe, expect, test } from 'bun:test'
import { estimateCostItems } from '../src/lib/estimation-engine'
import { CostItemValidationError } from '../src/lib/cost-item'

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1', type: 'api_call' as const, label: 'API', provider: 'Provider',
  unitPrice: '0.100000', quantity: '2', confidence: '0.9000', source: 'estimation' as const, currency: 'USDC' as const,
  ...overrides,
})

describe('Phase 3.2 exact cost estimation', () => {
  test('calculates multiple quantity/rate items exactly and aggregates the total', () => {
    const result = estimateCostItems([
      item({ id: 'api', unitPrice: '0.420000', quantity: '1' }),
      item({ id: 'inference', type: 'inference', unitPrice: '0.155000', quantity: '2' }),
      item({ id: 'retry', type: 'retry_overhead', unitPrice: '0.030000', quantity: '3' }),
    ])

    expect(result.estimatedCost).toBe('0.820000')
    expect(result.items.map((value) => value.estimated)).toEqual(['0.420000', '0.310000', '0.090000'])
    expect(result.byType).toEqual({ api_call: '0.420000', inference: '0.310000', retry_overhead: '0.090000' })
  })

  test('rounds only the final item amount deterministically', () => {
    const result = estimateCostItems([item({ unitPrice: '0.0000005', quantity: '1' })])
    expect(result.items[0]?.estimated).toBe('0.000001')
    expect(result.estimatedCost).toBe('0.000001')
  })

  test('supports an empty estimate as exact zero', () => {
    expect(estimateCostItems([])).toEqual({ currency: 'USDC', items: [], estimatedCost: '0.000000', byType: {} })
  })

  test('rejects invalid items instead of coercing them', () => {
    expect(() => estimateCostItems([item({ quantity: '-1' })])).toThrow(CostItemValidationError)
    expect(() => estimateCostItems([item({ unitPrice: 'NaN' })])).toThrow(CostItemValidationError)
    expect(() => estimateCostItems([item({ type: 'not-a-category' })])).toThrow(CostItemValidationError)
  })
})
