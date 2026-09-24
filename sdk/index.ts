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
  network:   string
  currency:  'USDC'
  maxBudget: string
}

export interface PlanResult {
  taskId:            string
  planId:            string
  estimatedCost:     number
  safetyBuffer:      number
  recommendedBudget: number
  maxBudget:         number
  confidence:        number
  items:             PlanItem[]
}

export interface PlanItem {
  label:     string
  estimated: number
  confidence: number
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
  current:       number
  proposedSpend: number
  limit:         number
  remaining:     number
}

export interface ReconciliationResult {
  taskId:        string
  estimatedCost: number
  budget:        number
  actualCost:    number
  variance:      number
  variancePct:   number
  completedAt:   string
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
    return this.sdk['post']('/budget/check', {
      current:      0, // SDK fetches current from server in production
      limit:        0,
      proposedSpend: parseFloat(opts.proposedSpend),
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
    const planRes = await this.post('/plans', {
      agentId:    input.agent,
      agentName:  input.agent,
      task:       input.task,
      network:    input.network,
      currency:   input.currency,
      maxBudget:  input.maxBudget,
    })

    const taskRes = await this.post('/tasks', {
      description: input.task,
      agentId:     input.agent,
      network:     input.network,
      currency:    input.currency,
      budget:      input.maxBudget,
      estimated:   String(planRes.estimatedCost),
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
      items:             (planRes.items ?? []).map((i: Record<string, unknown>) => ({
        label:      i.label,
        estimated:  i.estimated,
        confidence: i.confidence,
      })),
    }
  }

  /** Get a tracker for an active task */
  track(taskId: string): TaskTracker {
    return new TaskTracker(this, taskId)
  }

  /** Reconcile a completed task */
  async reconcile(taskId: string): Promise<ReconciliationResult> {
    return this.post(`/tasks/${taskId}/reconcile`, {})
  }

  private async post(path: string, body: object): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`[COSTRA SDK] ${path} → ${res.status}: ${err.message ?? 'unknown error'}`)
    }
    return res.json()
  }
}

// Re-export core engine functions for embedded use (no server required)
export { estimateCost }  from '../src/lib/cost-engine'
export { checkBudget, computeVariance } from '../src/lib/budget-engine'
export { ArcAdapter, getAdapter }        from '../src/lib/arc-adapter'
