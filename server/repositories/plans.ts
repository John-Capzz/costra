import type { QueryResultRow } from 'pg'
import type { CostItemRecord, CostPlanRecord, Queryable } from './types'

interface PlanRow extends QueryResultRow {
  id: string
  agent_id: string
  task_description: string
  network: 'arc-testnet'
  currency: 'USDC'
  max_budget: string
  estimated_cost: string | null
  safety_buffer: string | null
  recommended_budget: string | null
  confidence: string | null
  status: CostPlanRecord['status']
  created_at: Date
  updated_at: Date
}

interface CostItemRow extends QueryResultRow {
  id: string
  plan_id: string
  type: string
  label: string
  provider_id: string | null
  unit_price: string
  quantity: string
  estimated: string
  confidence: string | null
  source: CostItemRecord['source']
  created_at: Date
}

function mapPlan(row: PlanRow): CostPlanRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskDescription: row.task_description,
    network: row.network,
    currency: row.currency,
    maxBudget: row.max_budget,
    estimatedCost: row.estimated_cost,
    safetyBuffer: row.safety_buffer,
    recommendedBudget: row.recommended_budget,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCostItem(row: CostItemRow): CostItemRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    type: row.type,
    label: row.label,
    providerId: row.provider_id,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    estimated: row.estimated,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
  }
}

const planReturningColumns = `
  id, agent_id, task_description, network, currency, max_budget,
  estimated_cost, safety_buffer, recommended_budget, confidence,
  status, created_at, updated_at
`

export interface CreatePlanInput {
  agentId: string
  taskDescription: string
  maxBudget: string
  estimatedCost?: string | null
  safetyBuffer?: string | null
  recommendedBudget?: string | null
  confidence?: string | null
  status?: CostPlanRecord['status']
}

export interface CreateCostItemInput {
  type: string
  label: string
  providerName?: string | null
  unitPrice: string
  quantity: string
  estimated: string
  confidence?: string | null
  source: CostItemRecord['source']
}

export class PlanRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdForUser(planId: string, userId: string): Promise<CostPlanRecord | null> {
    const result = await this.db.query<PlanRow>(
      `SELECT p.id, p.agent_id, p.task_description, p.network, p.currency,
              p.max_budget, p.estimated_cost, p.safety_buffer,
              p.recommended_budget, p.confidence, p.status, p.created_at, p.updated_at
         FROM cost_plans AS p
         INNER JOIN agents AS a ON a.id = p.agent_id
        WHERE p.id = $1 AND a.user_id = $2
        LIMIT 1`,
      [planId, userId],
    )
    return result.rows[0] ? mapPlan(result.rows[0]) : null
  }

  async listForUser(userId: string, agentId?: string): Promise<CostPlanRecord[]> {
    const result = await this.db.query<PlanRow>(
      `SELECT p.id, p.agent_id, p.task_description, p.network, p.currency,
              p.max_budget, p.estimated_cost, p.safety_buffer,
              p.recommended_budget, p.confidence, p.status, p.created_at, p.updated_at
         FROM cost_plans AS p
         INNER JOIN agents AS a ON a.id = p.agent_id
        WHERE a.user_id = $1 AND ($2::uuid IS NULL OR p.agent_id = $2)
        ORDER BY p.created_at DESC`,
      [userId, agentId ?? null],
    )
    return result.rows.map(mapPlan)
  }

  async createForUser(userId: string, input: CreatePlanInput): Promise<CostPlanRecord | null> {
    const result = await this.db.query<PlanRow>(
      `INSERT INTO cost_plans (
         agent_id, task_description, network, currency, max_budget,
         estimated_cost, safety_buffer, recommended_budget, confidence, status
       )
       SELECT a.id, $3, 'arc-testnet', 'USDC', $4, $5, $6, $7, $8, COALESCE($9, 'draft')
         FROM agents AS a
        WHERE a.id = $1 AND a.user_id = $2
       RETURNING ${planReturningColumns}`,
      [input.agentId, userId, input.taskDescription, input.maxBudget,
        input.estimatedCost ?? null, input.safetyBuffer ?? null,
        input.recommendedBudget ?? null, input.confidence ?? null, input.status ?? null],
    )
    return result.rows[0] ? mapPlan(result.rows[0]) : null
  }

  async listItemsForUser(planId: string, userId: string): Promise<CostItemRecord[]> {
    const result = await this.db.query<CostItemRow>(
      `SELECT ci.id, ci.plan_id, ci.type, ci.label, ci.provider_id,
              ci.unit_price, ci.quantity, ci.estimated, ci.confidence,
              ci.source, ci.created_at
         FROM cost_items AS ci
         INNER JOIN cost_plans AS p ON p.id = ci.plan_id
         INNER JOIN agents AS a ON a.id = p.agent_id
        WHERE ci.plan_id = $1 AND a.user_id = $2
        ORDER BY ci.created_at ASC`,
      [planId, userId],
    )
    return result.rows.map(mapCostItem)
  }

  async createItemsForPlan(
    planId: string,
    userId: string,
    items: CreateCostItemInput[],
  ): Promise<CostItemRecord[]> {
    if (items.length === 0) return []

    const databaseItems = items.map((item) => ({
      type: item.type,
      label: item.label,
      provider_name: item.providerName ?? null,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      estimated: item.estimated,
      confidence: item.confidence ?? null,
      source: item.source,
    }))

    const result = await this.db.query<CostItemRow>(
      `INSERT INTO cost_items (
         plan_id, type, label, provider_id, unit_price, quantity,
         estimated, confidence, source
       )
       SELECT p.id, item.type, item.label,
              (SELECT pr.id FROM providers AS pr WHERE pr.name = item.provider_name LIMIT 1),
              item.unit_price, item.quantity, item.estimated, item.confidence, item.source
         FROM cost_plans AS p
         INNER JOIN agents AS a ON a.id = p.agent_id
         CROSS JOIN LATERAL jsonb_to_recordset($3::jsonb) AS item(
           type TEXT,
           label TEXT,
           provider_name TEXT,
           unit_price NUMERIC,
           quantity NUMERIC,
           estimated NUMERIC,
           confidence NUMERIC,
           source TEXT
         )
        WHERE p.id = $1 AND a.user_id = $2
       RETURNING id, plan_id, type, label, provider_id, unit_price,
                 quantity, estimated, confidence, source, created_at`,
      [planId, userId, JSON.stringify(databaseItems)],
    )
    return result.rows.map(mapCostItem)
  }
}
