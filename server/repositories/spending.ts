import type { QueryResultRow } from 'pg'
import type { Queryable } from './types'

export interface SpendingPointRecord {
  date: string
  amount: string
}

interface SpendingPointRow extends QueryResultRow {
  date: string
  amount: string
}

export class SpendingRepository {
  constructor(private readonly db: Queryable) {}

  async listDailyForUser(userId: string, from?: string, to?: string): Promise<SpendingPointRecord[]> {
    const result = await this.db.query<SpendingPointRow>(
      `SELECT TO_CHAR(DATE_TRUNC('day', e.timestamp), 'YYYY-MM-DD') AS date,
              COALESCE(SUM(e.cost), 0)::text AS amount
         FROM execution_events AS e
         INNER JOIN tasks AS t ON t.id = e.task_id
         INNER JOIN agents AS a ON a.id = t.agent_id
        WHERE a.user_id = $1
          AND ($2::date IS NULL OR e.timestamp >= $2::date)
          AND ($3::date IS NULL OR e.timestamp < ($3::date + INTERVAL '1 day'))
        GROUP BY DATE_TRUNC('day', e.timestamp)
        ORDER BY DATE_TRUNC('day', e.timestamp) ASC`,
      [userId, from ?? null, to ?? null],
    )
    return result.rows.map((row) => ({ date: row.date, amount: row.amount }))
  }
}
