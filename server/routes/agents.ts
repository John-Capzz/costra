import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { AgentRepository } from '../repositories/agents'
import type { DatabasePool } from '../repositories/types'
import { NotFoundError, ValidationError } from '../errors'

function validateCreateAgentBody(value: unknown): { name: string; description?: string; walletAddress?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Request body must be a JSON object.')
  }

  const body = value as Record<string, unknown>
  if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
    throw new ValidationError('name must be a non-empty string of 100 characters or fewer.')
  }

  let description: string | undefined
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 1000) {
      throw new ValidationError('description must be a string of 1000 characters or fewer.')
    }
    description = body.description
  }

  let walletAddress: string | undefined
  if (body.walletAddress !== undefined) {
    if (typeof body.walletAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(body.walletAddress)) {
      throw new ValidationError('walletAddress must be a valid EVM address.')
    }
    walletAddress = body.walletAddress
  }

  return { name: body.name.trim(), description, walletAddress }
}

export function createAgentsRouter(db?: DatabasePool) {
  const router = Router()
  router.post('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const input = validateCreateAgentBody(req.body)
      const agent = await new AgentRepository(db ?? getDefaultDatabasePool()).createForUser(principal.userId, input)
      res.status(201).json(agent)
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })

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
