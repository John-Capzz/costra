import type { QueryResultRow } from 'pg'
import { UnavailableError } from '../errors'
import type { OwnedResourceType, OwnershipResolver, ResourceOwner } from './authorization'
import type { Queryable } from '../repositories/types'

interface OwnerRow extends QueryResultRow {
  user_id: string
}

const OWNER_QUERIES: Record<OwnedResourceType, string> = {
  agent: `
    SELECT a.user_id
      FROM agents AS a
     WHERE a.id = $1
     LIMIT 1`,
  budget_policy: `
    SELECT a.user_id
      FROM budget_policies AS bp
      INNER JOIN agents AS a ON a.id = bp.agent_id
     WHERE bp.id = $1
     LIMIT 1`,
  plan: `
    SELECT a.user_id
      FROM cost_plans AS p
      INNER JOIN agents AS a ON a.id = p.agent_id
     WHERE p.id = $1
     LIMIT 1`,
  cost_item: `
    SELECT a.user_id
      FROM cost_items AS ci
      INNER JOIN cost_plans AS p ON p.id = ci.plan_id
      INNER JOIN agents AS a ON a.id = p.agent_id
     WHERE ci.id = $1
     LIMIT 1`,
  task: `
    SELECT a.user_id
      FROM tasks AS t
      INNER JOIN agents AS a ON a.id = t.agent_id
     WHERE t.id = $1
     LIMIT 1`,
  event: `
    SELECT a.user_id
      FROM execution_events AS e
      INNER JOIN tasks AS t ON t.id = e.task_id
      INNER JOIN agents AS a ON a.id = t.agent_id
     WHERE e.id = $1
     LIMIT 1`,
  transaction: `
    SELECT a.user_id
      FROM transactions AS tr
      INNER JOIN tasks AS t ON t.id = tr.task_id
      INNER JOIN agents AS a ON a.id = t.agent_id
     WHERE tr.id = $1
     LIMIT 1`,
  reconciliation: `
    SELECT a.user_id
      FROM reconciliations AS r
      INNER JOIN tasks AS t ON t.id = r.task_id
      INNER JOIN agents AS a ON a.id = t.agent_id
     WHERE r.id = $1
     LIMIT 1`,
}

/** Resolves persisted ownership without trusting a caller-supplied owner ID. */
export class PostgresOwnershipResolver implements OwnershipResolver {
  constructor(private readonly db: Queryable) {}

  async resolveOwner(
    resourceType: OwnedResourceType,
    resourceId: string,
  ): Promise<ResourceOwner | null> {
    const query = OWNER_QUERIES[resourceType]
    if (!query) {
      throw new UnavailableError('Ownership for this resource is not available.')
    }

    try {
      const result = await this.db.query<OwnerRow>(query, [resourceId])
      const row = result.rows[0]
      return row ? { type: 'user', id: row.user_id } : null
    } catch (error) {
      throw new UnavailableError('Resource ownership is temporarily unavailable.', error)
    }
  }
}

export function createPostgresOwnershipResolver(db: Queryable): OwnershipResolver {
  return new PostgresOwnershipResolver(db)
}
