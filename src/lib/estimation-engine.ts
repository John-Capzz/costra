import type { CostItemType } from '@/types'
import { COST_ITEM_TYPES, validateCostItem, type ExactCostItem } from './cost-item'
import { Money } from './money'

export interface CostItemEstimateInput {
  id: string
  type: CostItemType
  label: string
  provider: string
  unitPrice: string
  quantity: string
  confidence: string
  source: ExactCostItem['source']
  currency: 'USDC'
}

export interface CostEstimateResult {
  currency: 'USDC'
  items: ExactCostItem[]
  estimatedCost: string
  byType: Partial<Record<CostItemType, string>>
}

export function estimateCostItems(input: readonly CostItemEstimateInput[]): CostEstimateResult {
  const items = input.map((candidate) => {
    const validated = validateCostItem({ ...candidate, estimated: '0.000000' })
    const estimated = Money.multiplyDecimal(validated.unitPrice, validated.quantity, 'half-up').toString()
    return { ...validated, estimated }
  })

  const byType: Partial<Record<CostItemType, Money>> = {}
  for (const item of items) {
    const current = byType[item.type] ?? Money.zero()
    byType[item.type] = current.add(Money.from(item.estimated))
  }

  const serializedByType: Partial<Record<CostItemType, string>> = {}
  for (const type of COST_ITEM_TYPES) {
    const amount = byType[type]
    if (amount) serializedByType[type] = amount.toString()
  }

  return {
    currency: 'USDC',
    items,
    estimatedCost: Money.sum(items.map((item) => Money.from(item.estimated))).toString(),
    byType: serializedByType,
  }
}
