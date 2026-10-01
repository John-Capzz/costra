import type { CostItemType } from '@/types'
import { Money, MoneyError, USDC_SCALE } from './money'

export const COST_ITEM_TYPES: readonly CostItemType[] = [
  'inference',
  'api_call',
  'arc_transaction',
  'external_service',
  'retry_overhead',
  'compute',
  'storage',
  'agent_fee',
] as const

export interface ExactCostItem {
  id: string
  type: CostItemType
  label: string
  provider: string
  /** Unit price is retained at the existing schema precision. */
  unitPrice: string
  /** Quantity is dimensionless and retained at the existing schema precision. */
  quantity: string
  /** Estimated amount is fixed-scale USDC. */
  estimated: string
  confidence: string
  source: 'static' | 'historical' | 'dynamic' | 'estimation'
  currency: 'USDC'
}

export class CostItemValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CostItemValidationError'
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CostItemValidationError(`${field} is required.`)
  }
  if (value.length > maxLength) {
    throw new CostItemValidationError(`${field} must be ${maxLength} characters or fewer.`)
  }
  return value
}

function nonNegativeDecimal(value: unknown, field: string, scale: number): string {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new CostItemValidationError(`${field} must be a non-negative decimal string.`)
  }
  const fraction = value.split('.')[1] ?? ''
  if (fraction.length > scale) {
    throw new CostItemValidationError(`${field} supports no more than ${scale} decimal places.`)
  }
  return value
}

export function validateCostItem(value: unknown): ExactCostItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CostItemValidationError('Cost item must be an object.')
  }
  const item = value as Record<string, unknown>
  const type = item.type
  if (typeof type !== 'string' || !COST_ITEM_TYPES.includes(type as CostItemType)) {
    throw new CostItemValidationError(`type must be one of: ${COST_ITEM_TYPES.join(', ')}.`)
  }
  if (item.currency !== 'USDC') {
    throw new CostItemValidationError('currency must be USDC.')
  }

  const estimated = nonNegativeDecimal(item.estimated, 'estimated', USDC_SCALE)
  const confidence = nonNegativeDecimal(item.confidence, 'confidence', 4)
  const source = item.source
  if (source !== 'static' && source !== 'historical' && source !== 'dynamic' && source !== 'estimation') {
    throw new CostItemValidationError('source is invalid.')
  }
  if (Money.from(confidence, { allowNegative: false }).compare(Money.from('1.000000')) > 0) {
    throw new CostItemValidationError('confidence must be between 0 and 1.')
  }

  try {
    Money.from(estimated)
  } catch (error) {
    if (error instanceof MoneyError) throw new CostItemValidationError(error.message)
    throw error
  }

  return {
    id: requiredText(item.id, 'id', 128),
    type: type as CostItemType,
    label: requiredText(item.label, 'label', 200),
    provider: requiredText(item.provider, 'provider', 200),
    unitPrice: nonNegativeDecimal(item.unitPrice, 'unitPrice', 8),
    quantity: nonNegativeDecimal(item.quantity, 'quantity', 4),
    estimated,
    confidence,
    source,
    currency: 'USDC',
  }
}
