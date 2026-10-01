import type { QueryResultRow } from 'pg'
import type { BudgetPolicyRecord, Queryable } from './types'

interface BudgetPolicyRow extends QueryResultRow {
  id: string
  agent_id: string
  type: BudgetPolicyRecord['type']
  limit_amt: string
  currency: 'USDC'
  created_at: Date
}

function mapPolicy(row: BudgetPolicyRow): BudgetPolicyRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type,
    limit: row.limit_amt,
    currency: row.currency,
    createdAt: row.created_at,
  }
}

export interface CreateBudgetPolicyInput {
  type: BudgetPolicyRecord['type']
  limit: string
}

export class BudgetPolicyRepository {
  constructor(private readonly db: Queryable) {}

  async listForAgent(userId: string, agentId: string): Promise<BudgetPolicyRecord[]> {
    const result = await this.db.query<BudgetPolicyRow>(
      `SELECT bp.id, bp.agent_id, bp.type, bp.limit_amt, bp.currency, bp.created_at
         FROM budget_policies AS bp
         INNER JOIN agents AS a ON a.id = bp.agent_id
        WHERE bp.agent_id = $1 AND a.user_id = $2
        ORDER BY bp.created_at DESC`,
      [agentId, userId],
    )
    return result.rows.map(mapPolicy)
  }

  async createForAgent(
    userId: string,
    agentId: string,
    input: CreateBudgetPolicyInput,
  ): Promise<BudgetPolicyRecord | null> {
    const result = await this.db.query<BudgetPolicyRow>(
      `INSERT INTO budget_policies (agent_id, type, limit_amt, currency)
       SELECT a.id, $3, $4, 'USDC'
         FROM agents AS a
        WHERE a.id = $1 AND a.user_id = $2
       RETURNING id, agent_id, type, limit_amt, currency, created_at`,
      [agentId, userId, input.type, input.limit],
    )
    return result.rows[0] ? mapPolicy(result.rows[0]) : null
  }
}
