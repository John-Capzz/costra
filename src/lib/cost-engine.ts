// ============================================================
// COSTRA — Cost Engine
// Modular, provider-agnostic cost estimation
// ============================================================

import type { CostItem, CostItemType, CostPlan } from '@/types'

export interface CostEstimationInput {
  agentId:     string
  agentName:   string
  task:        string
  network:     string
  currency:    string
  maxBudget:   number
}

export interface CostEstimationResult {
  items:             CostItem[]
  estimatedCost:     number
  safetyBuffer:      number
  recommendedBudget: number
  confidence:        number
}

// ---- Item factories (extend for real providers) -----------

function makeItem(
  id: string,
  type: CostItemType,
  label: string,
  provider: string,
  unitPrice: number,
  quantity: number,
  confidence: number,
): CostItem {
  return {
    id,
    type,
    label,
    provider,
    unitPrice,
    quantity,
    estimated:  +(unitPrice * quantity).toFixed(6),
    confidence,
    source:     confidence > 0.85 ? 'historical' : confidence > 0.70 ? 'estimation' : 'static',
  }
}

// ---- Default estimation profile ----------------------------
// In production, these would come from a provider registry
// and historical cost data.

export function estimateCost(input: CostEstimationInput): CostEstimationResult {
  const { task, network } = input

  // Rough heuristics — real implementation would use provider
  // catalogues and per-agent historical data.
  const isChainTask   = /arc|ethereum|chain|protocol|defi|pool/i.test(task)
  const isResearchTask = /research|analys|report|fetch|study/i.test(task)
  const arcTxCount    = isChainTask ? 10 : 4

  const items: CostItem[] = [
    makeItem('ci_new_a', 'api_call',
      'Data / API requests',  'DeFiLlama',    0.0018, 233, 0.90),
    makeItem('ci_new_b', 'inference',
      'Agent inference',      'OpenAI GPT-4',  0.0031, 100, 0.82),
    makeItem('ci_new_c', 'arc_transaction',
      'Arc transactions',     network || 'Arc', 0.006, arcTxCount, 0.95),
    makeItem('ci_new_d', 'external_service',
      'External services',    'Alchemy',       0.006,  30, 0.85),
    makeItem('ci_new_e', 'retry_overhead',
      'Expected retries',     'COSTRA',        isResearchTask ? 0.0045 : 0.008, 20, 0.75),
  ]

  const estimatedCost     = +items.reduce((s, i) => s + i.estimated, 0).toFixed(4)
  const meanConfidence    = items.reduce((s, i) => s + i.confidence, 0) / items.length
  const safetyBuffer      = +(estimatedCost * (1 - meanConfidence + 0.12)).toFixed(4)
  const recommendedBudget = +(estimatedCost + safetyBuffer).toFixed(4)

  return { items, estimatedCost, safetyBuffer, recommendedBudget, confidence: +meanConfidence.toFixed(3) }
}

// ---- Plan constructor -------------------------------------

export function buildCostPlan(
  input: CostEstimationInput,
  estimation: CostEstimationResult,
  planId: string,
): Omit<CostPlan, 'createdAt' | 'updatedAt'> {
  return {
    id:                planId,
    taskDescription:   input.task,
    agentId:           input.agentId,
    agentName:         input.agentName,
    network:           input.network,
    currency:          input.currency,
    maxBudget:         input.maxBudget,
    estimatedCost:     estimation.estimatedCost,
    safetyBuffer:      estimation.safetyBuffer,
    recommendedBudget: estimation.recommendedBudget,
    confidence:        estimation.confidence,
    status:            'draft',
    items:             estimation.items,
  }
}
