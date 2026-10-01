// ============================================================
// COSTRA — Core Domain Types
// ============================================================

// ---- Cost Engine ------------------------------------------

export type CostItemType =
  | 'inference'
  | 'api_call'
  | 'arc_transaction'
  | 'external_service'
  | 'retry_overhead'
  | 'compute'
  | 'storage'
  | 'agent_fee'

export interface CostItem {
  id:         string
  type:       CostItemType
  label:      string
  provider:   string
  unitPrice:  number
  quantity:   number
  estimated:  number
  confidence: number   // 0..1
  source:     'static' | 'historical' | 'dynamic' | 'estimation'
}

// ---- Budget Engine ----------------------------------------

export type BudgetState = 'within' | 'approaching' | 'blocked' | 'completed'

export interface BudgetPolicy {
  type:  'per_task' | 'per_transaction' | 'daily' | 'agent' | 'service'
  limit: string | number
}

export interface BudgetCheckResult {
  allowed:       boolean
  reason?:       string
  current:       string
  proposedSpend: string
  limit:         string
  remaining:     string
}

// ---- Cost Plan --------------------------------------------

export type CostPlanStatus = 'draft' | 'approved' | 'executing' | 'completed'

export interface CostPlan {
  id:                string
  taskDescription:   string
  agentId:           string
  agentName:         string
  network:           string
  currency:          string
  maxBudget:         number
  estimatedCost:     number
  safetyBuffer:      number
  recommendedBudget: number
  confidence:        number
  status:            CostPlanStatus
  items:             CostItem[]
  createdAt:         string
  updatedAt:         string
}

// ---- Task -------------------------------------------------

export type TaskStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'blocked'

export type TaskLifecycleStatus =
  | 'planned'
  | 'budgeted'
  | 'executing'
  | 'tracked'
  | 'reconciled'
  | 'failed'
  | 'blocked'

export type TaskEventType =
  | 'TASK_CREATED'
  | 'PLAN_GENERATED'
  | 'BUDGET_APPROVED'
  | 'TASK_BUDGETED'
  | 'TASK_EXECUTING'
  | 'TASK_TRACKED'
  | 'TASK_RECONCILED'
  | 'API_CALL'
  | 'SERVICE_PAYMENT'
  | 'ARC_TRANSACTION'
  | 'RETRY'
  | 'SPEND_BLOCKED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'

export interface TaskEvent {
  id:          string
  type:        TaskEventType
  timestamp:   string
  cost?:       string | number
  description?: string
  provider?:   string
  txHash?:     string
  metadata?:   Record<string, unknown>
  executionMode?: 'simulated' | 'observed' | 'real'
}

export type SpendingMode = 'observe' | 'guarded'

export interface Task {
  id:            string
  description:   string
  agentId:       string
  agentName:     string
  network:       string
  currency:      string
  status:        TaskStatus
  lifecycleStatus: TaskLifecycleStatus
  budget:        number
  estimated:     number
  currentSpend:  number
  events:        TaskEvent[]
  spendingMode:  SpendingMode
  createdAt:     string
  updatedAt:     string
  planId?:       string
}

// ---- Agent ------------------------------------------------

export type AgentStatus = 'active' | 'idle' | 'paused' | 'error'

export interface Agent {
  id:                string
  name:              string
  description:       string
  status:            AgentStatus
  totalSpend:        number
  activeTasks:       number
  budgetLimit:       number
  planningAccuracy:  number   // 0..100
  recentActivity:    string[]
  budgetPolicies:    BudgetPolicy[]
  spendingMode:      SpendingMode
  createdAt:         string
  updatedAt:         string
}

// ---- Reconciliation ---------------------------------------

export interface ReconciliationItem {
  label:     string
  estimated: number
  actual:    number
  variance:  number
}

export interface Reconciliation {
  taskId:          string
  taskDescription: string
  estimatedCost:   number
  budget:          number
  actualCost:      number
  variance:        number
  variancePct:     number
  items:           ReconciliationItem[]
  completedAt:     string
}

// ---- Spending series (for charts) -------------------------

export interface SpendingDataPoint {
  date:   string
  amount: number
}

export interface SpendingByDimension {
  name:   string
  amount: number
}
