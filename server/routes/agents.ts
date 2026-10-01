import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { AgentRepository } from '../repositories/agents'
import type { DatabasePool } from '../repositories/types'
import { NotFoundError } from '../errors'

export function createAgentsRouter(db?: DatabasePool) {
  const router = Router()
  router.get('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const agents = await new AgentRepository(db ?? getDefaultDatabasePool()).listForUser(principal.userId)
      res.json({ agents, total: agents.length })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.get('/:id', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const agent = await new AgentRepository(db ?? getDefaultDatabasePool()).findByIdForUser(req.params.id, principal.userId)
      if (!agent) throw new NotFoundError('Agent not found.')
      res.json(agent)
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  return router
}
