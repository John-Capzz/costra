// ============================================================
// @costra/sdk — TypeScript SDK foundation
//
// The COSTRA SDK is the programmatic interface for autonomous
// agents to plan, track, and reconcile task economics.
//
// Core loop:
//   plan() → track() → reconcile()
// ============================================================

export interface CostraConfig {
  apiKey:   string
  baseUrl?: string
}

export interface PlanInput {
  agent:     string
  task:      string
  network:   'Arc Testnet' | 'arc-testnet'
  currency:  'USDC'
  maxBudget: string
}

export interface PlanResult {
  taskId:            string
  planId:            string
  estimatedCost:     string
  safetyBuffer:      string
  recommendedBudget: string
  maxBudget:         string
  confidence:        string
  items:             PlanItem[]
}

export interface ExactPlanItemInput {
  id: string
  type: 'inference' | 'api_call' | 'arc_transaction' | 'external_service' | 'retry_overhead' | 'compute' | 'storage' | 'agent_fee'
  label: string
  provider: string
  unitPrice: string
  quantity: string
  confidence: string
  source: 'static' | 'historical' | 'dynamic' | 'estimation'
  currency: 'USDC'
}

export interface ExactPlanInput {
  agent: string
  task: string
  network?: 'Arc Testnet'
  currency?: 'USDC'
  maxBudget: string
  safetyMargin: { type: 'fixed' | 'percentage'; value: string }
  items: ExactPlanItemInput[]
}

export interface ExactPlanResult {
  id: string
  agentId: string
  taskDescription: string
  network: 'Arc Testnet'
  currency: 'USDC'
  status: string
  maxBudget: string
  estimatedCost: string
  safetyBuffer: string
  recommendedBudget: string
  headroom: string
  estimateByType: Partial<Record<ExactPlanItemInput['type'], string>>
  items: ExactPlanItemInput & { estimated: string }[]
}

export interface PlanItem {
  label:     string
  estimated: string
  confidence: string
}

export interface SpendEvent {
  type:         string
  description?: string
  provider?:    string
  cost:         string
  txHash?:      string
}

export interface BudgetCheckResult {
  allowed:       boolean
  reason?:       string
  current:       string
  proposedSpend: string
  limit:         string
  remaining:     string
}

export interface ReconciliationResult {
  taskId:        string
  estimatedCost: string
  budget:        string
  actualCost:    string
  variance:      string
  variancePct:   string
  completedAt:   string
}

export interface ExecutionInput {
  agentId: string
  taskId: string
  planId: string
  amount: string
  destination: string
  currency?: 'USDC'
  network?: 'Arc Testnet'
  mode?: 'guarded'
  idempotencyKey: string
  reason?: string
}

export interface ExecutionResult {
  executionId: string
  duplicate: boolean
  transaction: {
    id: string
    taskId: string
    txHash: string | null
    value: string | null
    gasUsdc: string | null
    status: 'pending' | 'success' | 'failed'
    executionMode: 'real'
  } | null
}

interface PlanApiResponse {
  id:                string
  estimatedCost:     string
  safetyBuffer:      string
  recommendedBudget: string
  maxBudget:         string
  confidence:        string
  items:             Array<{
    label:      string
    estimated:  string
    confidence: string
  }>
}

interface TaskApiResponse {
  id: string
}

class TaskTracker {
  constructor(
    private readonly sdk:    Costra,
    private readonly taskId: string,
  ) {}

  /** Report a spend event from the agent */
  async event(ev: SpendEvent): Promise<void> {
    await this.sdk['post'](`/tasks/${this.taskId}/events`, ev)
  }

  /** Check if a proposed spend is within budget before executing it */
  async budgetCheck(opts: { proposedSpend: string }): Promise<BudgetCheckResult> {
    return this.sdk['post']<BudgetCheckResult>('/budget/check', {
      current:      '0.000000',
      limit:        '0.000000',
      proposedSpend: opts.proposedSpend,
    })
  }
}

export class Costra {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  constructor(config: CostraConfig) {
    this.baseUrl = (config.baseUrl ?? 'http://localhost:3001/api/v1').replace(/\/$/, '')
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type':  'application/json',
    }
  }

  /** Create a cost plan and task for the given agent + task description */
  async plan(input: PlanInput): Promise<PlanResult> {
    const planRes = await this.post<PlanApiResponse>('/plans', {
      agentId:    input.agent,
      agentName:  input.agent,
      task:       input.task,
      network:    input.network === 'arc-testnet' ? 'Arc Testnet' : input.network,
      currency:   input.currency,
      maxBudget:  input.maxBudget,
    })

    const taskRes = await this.post<TaskApiResponse>('/tasks', {
      description: input.task,
      agentId:     input.agent,
      network:     input.network,
      currency:    input.currency,
      budget:      input.maxBudget,
      estimated:   planRes.estimatedCost,
      planId:      planRes.id,
    })

    return {
      taskId:            taskRes.id,
      planId:            planRes.id,
      estimatedCost:     planRes.estimatedCost,
      safetyBuffer:      planRes.safetyBuffer,
      recommendedBudget: planRes.recommendedBudget,
      maxBudget:         planRes.maxBudget,
      confidence:        planRes.confidence,
      items:             (planRes.items ?? []).map((i) => ({
        label:      i.label,
        estimated:  i.estimated,
        confidence: i.confidence,
      })),
    }
  }

  /** Create an exact Phase 3 cost plan without floating-point monetary conversion. */
  async planExact(input: ExactPlanInput): Promise<ExactPlanResult> {
    return this.post<ExactPlanResult>('/plans', {
      agentId: input.agent,
      task: input.task,
      network: input.network ?? 'Arc Testnet',
      currency: input.currency ?? 'USDC',
      maxBudget: input.maxBudget,
      safetyMargin: input.safetyMargin,
      items: input.items,
    })
  }

  /** Get a tracker for an active task */
  track(taskId: string): TaskTracker {
    return new TaskTracker(this, taskId)
  }

  /** Reconcile a completed task */
  async reconcile(taskId: string): Promise<ReconciliationResult> {
    return this.post<ReconciliationResult>(`/tasks/${taskId}/reconcile`, {})
  }

  /** Explicitly submit a controlled Arc Testnet USDC execution. */
  async execute(input: ExecutionInput): Promise<ExecutionResult> {
    return this.post<ExecutionResult>('/executions', { ...input, mode: input.mode ?? 'guarded', currency: input.currency ?? 'USDC', network: input.network ?? 'Arc Testnet' })
  }

  async getExecution(executionId: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/executions/${executionId}`)
  }

  async getTaskTransactions(taskId: string): Promise<{ transactions: Array<Record<string, unknown>>; total: number }> {
    return this.get(`/tasks/${taskId}/transactions`)
  }

  async getPlanReconciliation(planId: string): Promise<Record<string, unknown>> {
    return this.get(`/plans/${planId}/reconciliation`)
  }

  private async post<T>(path: string, body: object): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`[COSTRA SDK] ${path} → ${res.status}: ${err.message ?? 'unknown error'}`)
    }
    return res.json() as Promise<T>
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`[COSTRA SDK] ${path} → ${res.status}: ${err.message ?? 'unknown error'}`)
    }
    return res.json() as Promise<T>
  }
}

// Re-export core engine functions for embedded use (no server required)
export { estimateCost }  from '../src/lib/cost-engine'
export { checkBudget, computeVariance } from '../src/lib/budget-engine'
export { ArcAdapter, getAdapter }        from '../src/lib/arc-adapter'
