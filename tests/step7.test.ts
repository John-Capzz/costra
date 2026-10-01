import { describe, expect, test } from 'bun:test'
import {
  assertOwnership,
  assertRequestedAgentAccess,
  authorizeOwnedResource,
  requireAuthenticatedPrincipal,
} from '../server/auth/authorization'
import type { AuthenticatedPrincipal } from '../server/auth/contracts'
import { AuthenticationError, AuthorizationError, UnavailableError } from '../server/errors'

const principal: AuthenticatedPrincipal = {
  authMethod: 'api_key',
  apiKeyId: 'key-1',
  userId: 'user-1',
  agentId: 'agent-1',
  authenticatedAt: new Date('2026-09-28T10:00:00.000Z'),
}

describe('authorization contracts', () => {
  test('accepts an authenticated principal', () => {
    expect(requireAuthenticatedPrincipal(principal)).toBe(principal)
  })

  test('rejects an unauthenticated request', () => {
    expect(() => requireAuthenticatedPrincipal(undefined)).toThrow(AuthenticationError)
  })

  test('accepts a matching user or agent owner', () => {
    expect(() => assertOwnership(principal, { type: 'user', id: 'user-1' })).not.toThrow()
    expect(() => assertOwnership(principal, { type: 'agent', id: 'agent-1' })).not.toThrow()
  })

  test('rejects an owner mismatch', () => {
    expect(() => assertOwnership(principal, { type: 'user', id: 'other-user' })).toThrow(AuthorizationError)
    expect(() => assertOwnership(principal, { type: 'agent', id: 'other-agent' })).toThrow(AuthorizationError)
  })

  test('fails closed when ownership cannot be established', () => {
    expect(() => assertOwnership(principal, null)).toThrow(UnavailableError)
  })

  test('authorizes a resource through a resolved owner', async () => {
    const resolver = {
      resolveOwner: async () => ({ type: 'user' as const, id: 'user-1' }),
    }

    await expect(authorizeOwnedResource(principal, resolver, 'plan', 'plan-1')).resolves.toBeUndefined()
  })
})

describe('request-supplied agent ownership', () => {
  test('accepts a matching verified agent context', () => {
    expect(() => assertRequestedAgentAccess(principal, 'agent-1')).not.toThrow()
    expect(() => assertRequestedAgentAccess(principal, undefined)).not.toThrow()
  })

  test('rejects a mismatch', () => {
    expect(() => assertRequestedAgentAccess(principal, 'other-agent')).toThrow(AuthorizationError)
  })

  test('fails closed instead of trusting a supplied agent ID without verified context', () => {
    const userOnlyPrincipal = { ...principal, agentId: undefined }
    expect(() => assertRequestedAgentAccess(userOnlyPrincipal, 'agent-1')).toThrow(UnavailableError)
  })
})
