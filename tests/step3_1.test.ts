import { describe, expect, test } from 'bun:test'
import { COST_ITEM_TYPES, CostItemValidationError, validateCostItem } from '../src/lib/cost-item'
import { Money, MoneyError } from '../src/lib/money'

describe('Phase 3.1 exact money foundation', () => {
  test('adds, subtracts, and formats exact USDC values', () => {
    expect(Money.from('0.100000').add(Money.from('0.200000')).toString()).toBe('0.300000')
    expect(Money.from('1.000000').subtract(Money.from('1.250000')).toString()).toBe('-0.250000')
  })

  test('multiplies without floating-point artifacts', () => {
    expect(Money.from('0.100000').multiply('2').toString()).toBe('0.200000')
    expect(Money.from('0.100000').multiply('0.2').toString()).toBe('0.020000')
    expect(Money.from('1.000000').multiply('0.333333').toString()).toBe('0.333333')
  })

  test('requires explicit rounding when multiplication exceeds USDC precision', () => {
    expect(() => Money.from('1.000000').multiply('0.0000005')).toThrow(MoneyError)
    expect(Money.from('1.000000').multiply('0.0000005', 'half-up').toString()).toBe('0.000001')
  })

  test('rejects malformed, negative, non-finite, and over-precise values', () => {
    for (const value of ['-1.000000', '1.0000001', 'NaN', 'Infinity', '1e-2']) {
      expect(() => Money.from(value)).toThrow(MoneyError)
    }
    expect(Money.zero().toString()).toBe('0.000000')
  })
})

describe('Phase 3.1 cost-item model', () => {
  const valid = {
    id: 'item-1', type: 'api_call', label: 'Data API', provider: 'Example',
    unitPrice: '0.00180000', quantity: '233', estimated: '0.419400', confidence: '0.9000', source: 'historical', currency: 'USDC',
  }

  test('accepts an exact cost item using existing categories and precision', () => {
    expect(validateCostItem(valid)).toEqual(valid)
    expect(COST_ITEM_TYPES).toContain('inference')
    expect(COST_ITEM_TYPES).toContain('arc_transaction')
  })

  test('rejects invalid category, currency, precision, confidence, and required text', () => {
    expect(() => validateCostItem({ ...valid, type: 'unknown' })).toThrow(CostItemValidationError)
    expect(() => validateCostItem({ ...valid, currency: 'EUR' })).toThrow(CostItemValidationError)
    expect(() => validateCostItem({ ...valid, estimated: '0.0000001' })).toThrow(CostItemValidationError)
    expect(() => validateCostItem({ ...valid, confidence: '1.0001' })).toThrow(CostItemValidationError)
    expect(() => validateCostItem({ ...valid, label: '   ' })).toThrow(CostItemValidationError)
  })
})
