import type { Pool, QueryResult, QueryResultRow } from 'pg'

/** Database-facing query boundary used by focused repositories. */
export type Queryable = Pick<Pool, 'query'>
export type DatabasePool = Queryable & Pick<Pool, 'connect'>
export type Query<T extends QueryResultRow> = (
  text: string,
  values?: readonly unknown[],
) => Promise<QueryResult<T>>

/** PostgreSQL NUMERIC values remain strings at the domain persistence boundary. */
export type Money = string
export type ExecutionMode = 'simulated' | 'observed' | 'real'

export interface AgentRecord {
  id: string
  userId: string
  name: string
  description: string | null
  status: 'active' | 'idle' | 'paused' | 'error'
  spendingMode: 'observe' | 'guarded'
  budgetLimit: Money
  planningAccuracy: Money | null
  totalSpend: Money
  createdAt: Date
  updatedAt: Date
}

export interface BudgetPolicyRecord {
  id: string
  agentId: string
  type: 'per_task' | 'per_transaction' | 'daily' | 'agent' | 'service'
  limit: Money
  currency: 'USDC'
  createdAt: Date
}

export interface CostPlanRecord {
  id: string
  agentId: string
  taskDescription: string
  network: 'arc-testnet'
  currency: 'USDC'
  maxBudget: Money
  estimatedCost: Money | null
  safetyBuffer: Money | null
  recommendedBudget: Money | null
  confidence: Money | null
  status: 'draft' | 'approved' | 'executing' | 'completed'
  createdAt: Date
  updatedAt: Date
}

export interface CostItemRecord {
  id: string
  planId: string
  type: string
  label: string
  providerId: string | null
  unitPrice: Money
  quantity: Money
  estimated: Money
  confidence: Money | null
  source: 'static' | 'historical' | 'dynamic' | 'estimation'
  createdAt: Date
}

export interface TaskRecord {
  id: string
  agentId: string
  planId: string | null
  description: string
  network: 'arc-testnet'
  currency: 'USDC'
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'blocked'
  lifecycleStatus: 'planned' | 'budgeted' | 'executing' | 'tracked' | 'reconciled' | 'failed' | 'blocked'
  budget: Money
  estimated: Money | null
  currentSpend: Money
  reservedSpend: Money
  spendingMode: 'observe' | 'guarded'
  idempotencyKey: string | null
  createdAt: Date
  updatedAt: Date
}

export type ExecutionRequestStatus = 'approved' | 'submitted' | 'confirmed' | 'failed' | 'rejected'

export interface ExecutionRequestRecord {
  id: string
  userId: string
  agentId: string
  taskId: string
  planId: string
  amount: Money
  reservedAmount: Money
  currency: 'USDC'
  network: 'arc-testnet'
  destination: string
  mode: 'guarded'
  status: ExecutionRequestStatus
  idempotencyKey: string
  txHash: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ExecutionEventRecord {
  id: string
  taskId: string
  type: string
  timestamp: Date
  cost: Money | null
  currency: 'USDC'
  description: string | null
  provider: string | null
  txHash: string | null
  metadata: Record<string, unknown> | null
  idempotencyKey: string | null
  executionMode: ExecutionMode
}

export interface TransactionRecord {
  id: string
  taskId: string
  txHash: string | null
  network: 'arc-testnet'
  fromAddress: string | null
  toAddress: string | null
  value: Money | null
  currency: 'USDC'
  gasUsdc: Money | null
  status: 'pending' | 'success' | 'failed'
  blockNumber: string | null
  confirmedAt: Date | null
  createdAt: Date
  executionMode: ExecutionMode
  idempotencyKey: string | null
}

export interface ReconciliationRecord {
  id: string
  taskId: string
  estimatedCost: Money
  budget: Money
  actualCost: Money
  variance: Money | null
  variancePct: Money | null
  items: Record<string, unknown> | null
  completedAt: Date
  status: 'pending' | 'completed' | 'failed'
}
