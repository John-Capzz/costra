import type { CostItemType } from '@/types'
import { Money } from './money'
import type { ExactCostItem } from './cost-item'

export interface CostEstimationInput {
  agentId: string
  agentName: string
  task: string
  network: string
  currency: string
  maxBudget: string
}

export interface CostEstimationResult {
  items: ExactCostItem[]
  estimatedCost: string
  safetyBuffer: string
  recommendedBudget: string
  confidence: string
}

function confidenceSource(confidence: string): ExactCostItem['source'] {
  const value = Money.from(confidence)
  return value.compare(Money.from('0.850000')) > 0 ? 'historical' : value.compare(Money.from('0.700000')) > 0 ? 'estimation' : 'static'
}

function makeItem(id: string, type: CostItemType, label: string, provider: string, unitPrice: string, quantity: string, confidence: string): ExactCostItem {
  const estimated = Money.multiplyDecimal(unitPrice, quantity, 'half-up').toString()
  return { id, type, label, provider, unitPrice, quantity, estimated, confidence, source: confidenceSource(confidence), currency: 'USDC' }
}

export function estimateCost(input: CostEstimationInput): CostEstimationResult {
  const isChainTask = /arc|ethereum|chain|protocol|defi|pool/i.test(input.task)
  const isResearchTask = /research|analys|report|fetch|study/i.test(input.task)
  const arcTxCount = isChainTask ? '10' : '4'
  const items = [
    makeItem('ci_new_a', 'api_call', 'Data / API requests', 'DeFiLlama', '0.0018', '233', '0.90'),
    makeItem('ci_new_b', 'inference', 'Agent inference', 'OpenAI GPT-4', '0.0031', '100', '0.82'),
    makeItem('ci_new_c', 'arc_transaction', 'Arc transactions', input.network || 'Arc Testnet', '0.006', arcTxCount, '0.95'),
    makeItem('ci_new_d', 'external_service', 'External services', 'Alchemy', '0.006', '30', '0.85'),
    makeItem('ci_new_e', 'retry_overhead', 'Expected retries', 'COSTRA', isResearchTask ? '0.0045' : '0.008', '20', '0.75'),
  ]
  const estimated = Money.sum(items.map((item) => Money.from(item.estimated)))
  const meanConfidence = Money.sum(items.map((item) => Money.from(item.confidence))).divideInteger(items.length, 'half-up')
  const safetyFactor = Money.from('1.000000').subtract(meanConfidence).add(Money.from('0.120000'))
  const safetyBuffer = estimated.multiply(safetyFactor.toString(), 'half-up')
  return {
    items,
    estimatedCost: estimated.toString(),
    safetyBuffer: safetyBuffer.toString(),
    recommendedBudget: estimated.add(safetyBuffer).toString(),
    confidence: meanConfidence.toString(),
  }
}
