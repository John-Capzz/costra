import { Router } from 'express'
import { asDatabaseUnavailable } from '../db/errors'
import { getDefaultDatabasePool } from '../db/pool'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { createApiKeyInput, PostgresApiKeyManagementStore } from '../auth/api-key-management'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import { validateIdentifier } from '../validation'
import type { DatabasePool } from '../repositories/types'

function validateLabel(body: unknown): string | undefined {
  if (body === undefined) return undefined
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.')
  }
  const value = (body as Record<string, unknown>).label
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) {
    throw new ValidationError('label must be a non-empty string of 100 characters or fewer.')
  }
  return value.trim()
}

function serializeKey(record: Awaited<ReturnType<PostgresApiKeyManagementStore['listForUser']>>[number]) {
  return {
    id: record.id,
    label: record.label,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}

export function createApiKeysRouter(db?: DatabasePool) {
  const router = Router()
  const store = () => new PostgresApiKeyManagementStore(db ?? getDefaultDatabasePool())

  router.get('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const keys = await store().listForUser(principal.userId)
      res.json({ apiKeys: keys.map(serializeKey) })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const label = validateLabel(req.body)
      const { secret, input } = createApiKeyInput(label)
      const record = await store().createForUser(principal.userId, input)
      res.status(201).json({ apiKey: secret, record: serializeKey(record) })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.post('/:id/revoke', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const revoked = await store().revokeForUser(principal.userId, id)
      if (!revoked) throw new NotFoundError('API key was not found.')
      res.status(204).send()
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  router.post('/:id/rotate', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const label = validateLabel(req.body)
      const { secret, input } = createApiKeyInput(label)
      const record = await store().rotateForUser(principal.userId, id, input)
      if (!record) throw new ConflictError('API key was not found or is already revoked.')
      res.status(201).json({ apiKey: secret, record: serializeKey(record) })
    } catch (error) {
      next(asDatabaseUnavailable(error))
    }
  })

  return router
}
