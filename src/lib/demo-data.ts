// ============================================================
// COSTRA — Realistic demo / seed data
// All marked as demo — never presented as live blockchain data
// ============================================================

import type {
  Agent, Task, CostPlan, Reconciliation,
  SpendingDataPoint, SpendingByDimension,
} from '@/types'

// ---- Agents -----------------------------------------------

export const DEMO_AGENTS: Agent[] = [
  {
    id:               'agent_research_01',
    name:             'Research Agent',
    description:      'Autonomously researches DeFi protocols, market data, and on-chain analytics across multiple networks.',
    status:           'active',
    totalSpend:       18.42,
    activeTasks:      2,
    budgetLimit:      50.00,
    planningAccuracy: 91,
    recentActivity:   [
      'Completed DeFi TVL analysis on Arc — $1.18 actual vs $1.06 estimated',
      'Running: Fetch Uniswap v4 pool data — 60% complete',
      'Queued: Cross-chain yield comparison',
    ],
    budgetPolicies: [
      { type: 'per_task',        limit: 5.00 },
      { type: 'per_transaction', limit: 0.50 },
      { type: 'daily',           limit: 10.00 },
    ],
    spendingMode: 'guarded',
    createdAt:    '2026-09-01T10:00:00Z',
    updatedAt:    '2026-09-22T08:14:00Z',
  },
  {
    id:               'agent_data_02',
    name:             'Data Aggregator',
    description:      'Pulls price feeds, TVL snapshots, and on-chain events from external data providers.',
    status:           'idle',
    totalSpend:       6.83,
    activeTasks:      0,
    budgetLimit:      30.00,
    planningAccuracy: 87,
    recentActivity:   [
      'Completed: Arc native gas price sweep — $0.24 actual',
      'Idle since 2026-09-21T16:00:00Z',
    ],
    budgetPolicies: [
      { type: 'per_task',  limit: 3.00 },
      { type: 'daily',     limit: 8.00 },
    ],
    spendingMode: 'observe',
    createdAt:    '2026-09-05T09:00:00Z',
    updatedAt:    '2026-09-21T16:00:00Z',
  },
  {
    id:               'agent_arb_03',
    name:             'Arbitrage Scout',
    description:      'Monitors Arc and Ethereum for cross-chain yield and arbitrage opportunities in real time.',
    status:           'active',
    totalSpend:       34.07,
    activeTasks:      1,
    budgetLimit:      100.00,
    planningAccuracy: 78,
    recentActivity:   [
      'Running: Monitor Arc/Base USDC yield spread',
      'Blocked: Proposed spend $2.10 exceeded daily limit $2.00',
      'Completed: ETH/Arc bridge cost analysis — $0.91',
    ],
    budgetPolicies: [
      { type: 'per_task',        limit: 10.00 },
      { type: 'per_transaction', limit: 2.00 },
      { type: 'daily',           limit: 25.00 },
    ],
    spendingMode: 'guarded',
    createdAt:    '2026-08-20T11:00:00Z',
    updatedAt:    '2026-09-22T09:00:00Z',
  },
]

// ---- Cost Plans -------------------------------------------

export const DEMO_PLANS: CostPlan[] = [
  {
    id:                'plan_001',
    taskDescription:   'Research the top 10 DeFi protocols on Arc',
    agentId:           'agent_research_01',
    agentName:         'Research Agent',
    network:           'Arc Testnet',
    currency:          'USDC',
    maxBudget:         5.00,
    estimatedCost:     1.06,
    safetyBuffer:      0.21,
    recommendedBudget: 1.27,
    confidence:        0.88,
    status:            'completed',
    createdAt:         '2026-09-20T08:00:00Z',
    updatedAt:         '2026-09-20T12:30:00Z',
    items: [
      { id: 'ci_001a', type: 'api_call',      label: 'Data / API requests',  provider: 'DeFiLlama',   unitPrice: 0.0018, quantity: 233, estimated: 0.42, confidence: 0.90, source: 'historical' },
      { id: 'ci_001b', type: 'inference',     label: 'Agent inference',      provider: 'OpenAI',      unitPrice: 0.0031, quantity: 100, estimated: 0.31, confidence: 0.82, source: 'historical' },
      { id: 'ci_001c', type: 'arc_transaction',label:'Arc transactions',     provider: 'Arc Testnet', unitPrice: 0.006,  quantity:  10, estimated: 0.06, confidence: 0.95, source: 'dynamic' },
      { id: 'ci_001d', type: 'external_service',label:'External services',   provider: 'Alchemy',     unitPrice: 0.006,  quantity:  30, estimated: 0.18, confidence: 0.85, source: 'static' },
      { id: 'ci_001e', type: 'retry_overhead', label: 'Expected retries',    provider: 'COSTRA',      unitPrice: 0.0045, quantity:  20, estimated: 0.09, confidence: 0.75, source: 'estimation' },
    ],
  },
  {
    id:                'plan_002',
    taskDescription:   'Fetch Uniswap v4 pool data and yield metrics',
    agentId:           'agent_research_01',
    agentName:         'Research Agent',
    network:           'Arc Testnet',
    currency:          'USDC',
    maxBudget:         3.00,
    estimatedCost:     0.74,
    safetyBuffer:      0.15,
    recommendedBudget: 0.89,
    confidence:        0.85,
    status:            'executing',
    createdAt:         '2026-09-22T07:00:00Z',
    updatedAt:         '2026-09-22T09:14:00Z',
    items: [
      { id: 'ci_002a', type: 'api_call',      label: 'Subgraph queries',    provider: 'The Graph',   unitPrice: 0.0022, quantity: 150, estimated: 0.33, confidence: 0.88, source: 'historical' },
      { id: 'ci_002b', type: 'inference',     label: 'Agent inference',     provider: 'Anthropic',   unitPrice: 0.0024, quantity:  80, estimated: 0.19, confidence: 0.80, source: 'historical' },
      { id: 'ci_002c', type: 'arc_transaction',label:'Arc transactions',    provider: 'Arc Testnet', unitPrice: 0.006,  quantity:   8, estimated: 0.05, confidence: 0.93, source: 'dynamic' },
      { id: 'ci_002d', type: 'retry_overhead', label: 'Expected retries',   provider: 'COSTRA',      unitPrice: 0.0085, quantity:  20, estimated: 0.17, confidence: 0.70, source: 'estimation' },
    ],
  },
  {
    id:                'plan_003',
    taskDescription:   'Arc/Base USDC yield spread analysis',
    agentId:           'agent_arb_03',
    agentName:         'Arbitrage Scout',
    network:           'Arc Testnet',
    currency:          'USDC',
    maxBudget:         10.00,
    estimatedCost:     2.44,
    safetyBuffer:      0.49,
    recommendedBudget: 2.93,
    confidence:        0.76,
    status:            'executing',
    createdAt:         '2026-09-22T06:30:00Z',
    updatedAt:         '2026-09-22T09:30:00Z',
    items: [
      { id: 'ci_003a', type: 'inference',      label: 'Agent inference',     provider: 'OpenAI',      unitPrice: 0.004, quantity: 200, estimated: 0.80, confidence: 0.80, source: 'historical' },
      { id: 'ci_003b', type: 'api_call',       label: 'Price feed requests', provider: 'Pyth',        unitPrice: 0.002, quantity: 400, estimated: 0.80, confidence: 0.90, source: 'historical' },
      { id: 'ci_003c', type: 'arc_transaction',label: 'Arc transactions',    provider: 'Arc Testnet', unitPrice: 0.006, quantity:  20, estimated: 0.12, confidence: 0.95, source: 'dynamic' },
      { id: 'ci_003d', type: 'external_service',label:'Bridge checks',       provider: 'Wormhole',    unitPrice: 0.012, quantity:  48, estimated: 0.58, confidence: 0.72, source: 'estimation' },
      { id: 'ci_003e', type: 'retry_overhead', label: 'Expected retries',    provider: 'COSTRA',      unitPrice: 0.007, quantity:  20, estimated: 0.14, confidence: 0.65, source: 'estimation' },
    ],
  },
]

// ---- Tasks ------------------------------------------------

const NOW = '2026-09-22T09:30:00Z'

export const DEMO_TASKS: Task[] = [
  {
    id:           'task_001',
    description:  'Research the top 10 DeFi protocols on Arc',
    agentId:      'agent_research_01',
    agentName:    'Research Agent',
    network:      'Arc Testnet',
    currency:     'USDC',
    status:       'completed',
    budget:       5.00,
    estimated:    1.06,
    currentSpend: 1.18,
    planId:       'plan_001',
    spendingMode: 'guarded',
    createdAt:    '2026-09-20T08:00:00Z',
    updatedAt:    '2026-09-20T12:30:00Z',
    events: [
      { id: 'ev_001a', type: 'TASK_CREATED',    timestamp: '2026-09-20T08:00:00Z', description: 'Task created with budget $5.00' },
      { id: 'ev_001b', type: 'PLAN_GENERATED',  timestamp: '2026-09-20T08:01:12Z', cost: 0.00, description: 'Cost plan generated — estimated $1.06, recommended $1.27' },
      { id: 'ev_001c', type: 'BUDGET_APPROVED', timestamp: '2026-09-20T08:01:30Z', description: 'Budget approved: $5.00 max / $1.27 recommended' },
      { id: 'ev_001d', type: 'API_CALL',        timestamp: '2026-09-20T08:03:11Z', cost: 0.086, description: 'DeFiLlama TVL endpoint — 48 protocols fetched', provider: 'DeFiLlama' },
      { id: 'ev_001e', type: 'ARC_TRANSACTION', timestamp: '2026-09-20T08:05:42Z', cost: 0.006, description: 'Arc contract read: USDC balance check', txHash: '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd', provider: 'Arc Testnet' },
      { id: 'ev_001f', type: 'SERVICE_PAYMENT', timestamp: '2026-09-20T08:12:00Z', cost: 0.18,  description: 'Alchemy node query — 30 RPC calls', provider: 'Alchemy' },
      { id: 'ev_001g', type: 'API_CALL',        timestamp: '2026-09-20T09:00:00Z', cost: 0.22,  description: 'OpenAI: summarise protocol data — 5 calls', provider: 'OpenAI' },
      { id: 'ev_001h', type: 'RETRY',           timestamp: '2026-09-20T09:45:00Z', cost: 0.012, description: 'Rate limit hit on DeFiLlama — 1 retry', provider: 'DeFiLlama' },
      { id: 'ev_001i', type: 'API_CALL',        timestamp: '2026-09-20T10:00:00Z', cost: 0.22,  description: 'OpenAI: final analysis pass — 5 calls', provider: 'OpenAI' },
      { id: 'ev_001j', type: 'ARC_TRANSACTION', timestamp: '2026-09-20T10:30:00Z', cost: 0.006, description: 'Arc: read protocol registry data', txHash: '0xfe09dc81a72b456c78901234ef5678901234567890123456789012345678fedc', provider: 'Arc Testnet' },
      { id: 'ev_001k', type: 'TASK_COMPLETED',  timestamp: '2026-09-20T12:30:00Z', description: 'Task completed. Actual: $1.18, estimated: $1.06, variance: +$0.12 (+11.3%)' },
    ],
  },
  {
    id:           'task_002',
    description:  'Fetch Uniswap v4 pool data and yield metrics',
    agentId:      'agent_research_01',
    agentName:    'Research Agent',
    network:      'Arc Testnet',
    currency:     'USDC',
    status:       'executing',
    budget:       3.00,
    estimated:    0.74,
    currentSpend: 0.44,
    planId:       'plan_002',
    spendingMode: 'guarded',
    createdAt:    '2026-09-22T07:00:00Z',
    updatedAt:    NOW,
    events: [
      { id: 'ev_002a', type: 'TASK_CREATED',    timestamp: '2026-09-22T07:00:00Z', description: 'Task created with budget $3.00' },
      { id: 'ev_002b', type: 'PLAN_GENERATED',  timestamp: '2026-09-22T07:01:00Z', description: 'Cost plan generated — estimated $0.74' },
      { id: 'ev_002c', type: 'BUDGET_APPROVED', timestamp: '2026-09-22T07:01:30Z', description: 'Budget approved: $3.00 max' },
      { id: 'ev_002d', type: 'API_CALL',        timestamp: '2026-09-22T07:05:00Z', cost: 0.11, description: 'The Graph: Uniswap v4 pool subgraph — 50 queries', provider: 'The Graph' },
      { id: 'ev_002e', type: 'API_CALL',        timestamp: '2026-09-22T08:00:00Z', cost: 0.14, description: 'Anthropic: pool data analysis batch 1', provider: 'Anthropic' },
      { id: 'ev_002f', type: 'ARC_TRANSACTION', timestamp: '2026-09-22T09:00:00Z', cost: 0.006, description: 'Arc: read USDC/ETH pool state', txHash: '0x1234deadbeef5678901234567890abcdef1234567890123456789012345678ab', provider: 'Arc Testnet' },
      { id: 'ev_002g', type: 'API_CALL',        timestamp: '2026-09-22T09:14:00Z', cost: 0.184, description: 'The Graph: yield metrics batch 2 — 84 queries', provider: 'The Graph' },
    ],
  },
  {
    id:           'task_003',
    description:  'Arc/Base USDC yield spread analysis',
    agentId:      'agent_arb_03',
    agentName:    'Arbitrage Scout',
    network:      'Arc Testnet',
    currency:     'USDC',
    status:       'executing',
    budget:       10.00,
    estimated:    2.44,
    currentSpend: 1.87,
    planId:       'plan_003',
    spendingMode: 'guarded',
    createdAt:    '2026-09-22T06:30:00Z',
    updatedAt:    NOW,
    events: [
      { id: 'ev_003a', type: 'TASK_CREATED',    timestamp: '2026-09-22T06:30:00Z', description: 'Task created with budget $10.00' },
      { id: 'ev_003b', type: 'PLAN_GENERATED',  timestamp: '2026-09-22T06:31:00Z', description: 'Cost plan generated — estimated $2.44' },
      { id: 'ev_003c', type: 'BUDGET_APPROVED', timestamp: '2026-09-22T06:31:30Z', description: 'Budget approved: $10.00 max' },
      { id: 'ev_003d', type: 'API_CALL',        timestamp: '2026-09-22T06:35:00Z', cost: 0.40, description: 'Pyth: price feed subscription — 200 ticks', provider: 'Pyth' },
      { id: 'ev_003e', type: 'SERVICE_PAYMENT', timestamp: '2026-09-22T07:00:00Z', cost: 0.29, description: 'Wormhole: bridge cost query batch 1', provider: 'Wormhole' },
      { id: 'ev_003f', type: 'SPEND_BLOCKED',   timestamp: '2026-09-22T07:30:00Z', cost: 2.10, description: 'Proposed $2.10 blocked — exceeds daily per-tx limit $2.00' },
      { id: 'ev_003g', type: 'API_CALL',        timestamp: '2026-09-22T08:00:00Z', cost: 0.60, description: 'OpenAI: yield spread model inference', provider: 'OpenAI' },
      { id: 'ev_003h', type: 'ARC_TRANSACTION', timestamp: '2026-09-22T09:00:00Z', cost: 0.012, description: 'Arc: two contract reads for USDC pool states', txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', provider: 'Arc Testnet' },
      { id: 'ev_003i', type: 'SERVICE_PAYMENT', timestamp: '2026-09-22T09:15:00Z', cost: 0.29, description: 'Wormhole: bridge cost query batch 2', provider: 'Wormhole' },
      { id: 'ev_003j', type: 'RETRY',           timestamp: '2026-09-22T09:20:00Z', cost: 0.27, description: 'Timeout on Wormhole API — 1 retry', provider: 'Wormhole' },
    ],
  },
  {
    id:           'task_004',
    description:  'Arc native gas price sweep',
    agentId:      'agent_data_02',
    agentName:    'Data Aggregator',
    network:      'Arc Testnet',
    currency:     'USDC',
    status:       'completed',
    budget:       1.00,
    estimated:    0.22,
    currentSpend: 0.24,
    spendingMode: 'observe',
    createdAt:    '2026-09-21T14:00:00Z',
    updatedAt:    '2026-09-21T16:00:00Z',
    events: [
      { id: 'ev_004a', type: 'TASK_CREATED',   timestamp: '2026-09-21T14:00:00Z', description: 'Task created — observe mode (no enforcement)' },
      { id: 'ev_004b', type: 'API_CALL',       timestamp: '2026-09-21T14:10:00Z', cost: 0.12, description: 'Arc RPC: 20 gas price samples', provider: 'Arc Testnet' },
      { id: 'ev_004c', type: 'API_CALL',       timestamp: '2026-09-21T15:00:00Z', cost: 0.12, description: 'Arc RPC: 20 more gas samples', provider: 'Arc Testnet' },
      { id: 'ev_004d', type: 'TASK_COMPLETED', timestamp: '2026-09-21T16:00:00Z', description: 'Task completed. Actual: $0.24 (+9.1% vs estimated $0.22)' },
    ],
  },
]

// ---- Reconciliations -------------------------------------

export const DEMO_RECONCILIATIONS: Reconciliation[] = [
  {
    taskId:          'task_001',
    taskDescription: 'Research the top 10 DeFi protocols on Arc',
    estimatedCost:   1.06,
    budget:          5.00,
    actualCost:      1.18,
    variance:        0.12,
    variancePct:     11.32,
    completedAt:     '2026-09-20T12:30:00Z',
    items: [
      { label: 'Data / API requests', estimated: 0.42, actual: 0.498, variance:  0.078 },
      { label: 'Agent inference',     estimated: 0.31, actual: 0.310, variance:  0.000 },
      { label: 'Arc transactions',    estimated: 0.06, actual: 0.048, variance: -0.012 },
      { label: 'External services',   estimated: 0.18, actual: 0.180, variance:  0.000 },
      { label: 'Expected retries',    estimated: 0.09, actual: 0.144, variance:  0.054 },
    ],
  },
  {
    taskId:          'task_004',
    taskDescription: 'Arc native gas price sweep',
    estimatedCost:   0.22,
    budget:          1.00,
    actualCost:      0.24,
    variance:        0.02,
    variancePct:     9.09,
    completedAt:     '2026-09-21T16:00:00Z',
    items: [
      { label: 'Arc RPC calls', estimated: 0.22, actual: 0.24, variance: 0.02 },
    ],
  },
]

// ---- Spending Series (30 days) ---------------------------

export const DEMO_SPENDING_SERIES: SpendingDataPoint[] = (() => {
  const result: SpendingDataPoint[] = []
  const base = new Date('2026-08-23T00:00:00Z')
  for (let i = 0; i < 30; i++) {
    const d = new Date(base.getTime() + i * 86_400_000)
    const noise = 0.4 + Math.abs(Math.sin(i * 1.1) * 1.2 + Math.cos(i * 0.7) * 0.5)
    result.push({
      date:   d.toISOString().slice(0, 10),
      amount: +noise.toFixed(4),
    })
  }
  return result
})()

export const DEMO_SPENDING_BY_AGENT: SpendingByDimension[] = [
  { name: 'Research Agent',    amount: 18.42 },
  { name: 'Arbitrage Scout',   amount: 34.07 },
  { name: 'Data Aggregator',   amount:  6.83 },
]

export const DEMO_SPENDING_BY_SERVICE: SpendingByDimension[] = [
  { name: 'Inference',      amount: 22.10 },
  { name: 'API Calls',      amount: 18.44 },
  { name: 'Arc Txns',       amount:  3.90 },
  { name: 'External',       amount:  9.20 },
  { name: 'Retries',        amount:  5.68 },
]
