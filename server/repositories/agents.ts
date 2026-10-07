import type { QueryResultRow } from 'pg'
import type { AgentRecord, Queryable } from './types'

interface AgentRow extends QueryResultRow {
  id: string
  user_id: string
  name: string
  description: string | null
  wallet_address: string | null
  status: AgentRecord['status']
  spending_mode: AgentRecord['spendingMode']
  budget_limit: string
  planning_accuracy: string | null
  total_spend: string
  created_at: Date
  updated_at: Date
}

function mapAgent(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    walletAddress: row.wallet_address,
    status: row.status,
    spendingMode: row.spending_mode,
    budgetLimit: row.budget_limit,
    planningAccuracy: row.planning_accuracy,
    totalSpend: row.total_spend,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const agentColumns = `
  a.id, a.user_id, a.name, a.description, a.status, a.spending_mode,
  a.wallet_address,
  a.budget_limit, a.planning_accuracy, a.total_spend, a.created_at, a.updated_at
`

const agentReturningColumns = `
  id, user_id, name, description, status, spending_mode,
  wallet_address,
  budget_limit, planning_accuracy, total_spend, created_at, updated_at
`

export interface CreateAgentInput {
  name: string
  description?: string | null
  walletAddress?: string | null
  status?: AgentRecord['status']
  spendingMode?: AgentRecord['spendingMode']
  budgetLimit?: string
}

export class AgentRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdForUser(agentId: string, userId: string): Promise<AgentRecord | null> {
    const result = await this.db.query<AgentRow>(
      `SELECT ${agentColumns} FROM agents AS a WHERE a.id = $1 AND a.user_id = $2 LIMIT 1`,
      [agentId, userId],
    )
    return result.rows[0] ? mapAgent(result.rows[0]) : null
  }

  async listForUser(userId: string): Promise<AgentRecord[]> {
    const result = await this.db.query<AgentRow>(
      `SELECT ${agentColumns} FROM agents AS a WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
      [userId],
    )
    return result.rows.map(mapAgent)
  }

  async createForUser(userId: string, input: CreateAgentInput): Promise<AgentRecord> {
    const result = await this.db.query<AgentRow>(
      `INSERT INTO agents (user_id, name, description, wallet_address, status, spending_mode, budget_limit)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'idle'), COALESCE($6, 'observe'), COALESCE($7::numeric, 50))
       RETURNING ${agentReturningColumns}`,
      [userId, input.name, input.description ?? null, input.walletAddress ?? null, input.status ?? null, input.spendingMode ?? null, input.budgetLimit ?? null],
    )
    return mapAgent(result.rows[0])
  }
}
