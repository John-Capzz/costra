import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { AuthenticationError, UnavailableError } from '../errors'
import type { ApiKeyRecord, ApiKeyStore, AuthenticatedPrincipal } from './contracts'

export function extractBearerToken(req: Request): string | null {
  const authorization = req.get('authorization')
  if (!authorization) return null

  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

export function buildAuthenticatedPrincipal(
  record: ApiKeyRecord,
  authenticatedAt: Date,
): AuthenticatedPrincipal {
  if (!record.id || !record.userId || !record.keyHash) {
    throw new AuthenticationError('The API key identity is incomplete.')
  }
  if (record.revokedAt) {
    throw new AuthenticationError('The API key has been revoked.')
  }

  return {
    authMethod: 'api_key',
    apiKeyId: record.id,
    userId: record.userId,
    agentId: record.agentId ?? undefined,
    authenticatedAt,
  }
}

export async function authenticateApiKey(
  apiKey: string | null,
  store: ApiKeyStore | undefined,
  now: () => Date = () => new Date(),
): Promise<AuthenticatedPrincipal> {
  if (!apiKey) {
    throw new AuthenticationError('Missing Authorization header. Use: Authorization: Bearer <api_key>')
  }
  if (!store) {
    throw new UnavailableError('API-key authentication is not configured.')
  }

  const keyHash = hashApiKey(apiKey)
  let record: ApiKeyRecord | null
  try {
    record = await store.findByHash(keyHash)
  } catch (error) {
    throw new UnavailableError('API-key authentication is temporarily unavailable.', error)
  }

  if (!record) {
    throw new AuthenticationError('Invalid API key.')
  }

  const authenticatedAt = now()
  const principal = buildAuthenticatedPrincipal(record, authenticatedAt)

  try {
    await store.markLastUsed(record.id, authenticatedAt)
  } catch (error) {
    throw new UnavailableError('API-key authentication is temporarily unavailable.', error)
  }

  return principal
}
