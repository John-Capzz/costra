import { AppError, AuthenticationError, AuthorizationError, UnavailableError } from '../errors'
import type { AuthenticatedPrincipal } from './contracts'

export type OwnedResourceType =
  | 'agent'
  | 'budget_policy'
  | 'plan'
  | 'cost_item'
  | 'task'
  | 'event'
  | 'transaction'
  | 'reconciliation'

export type ResourceOwner =
  | { type: 'user'; id: string }
  | { type: 'agent'; id: string }

export interface OwnershipCheck {
  resourceType: string
  resourceId: string
  owner: ResourceOwner | null
}

export interface OwnershipResolver {
  resolveOwner(resourceType: OwnedResourceType, resourceId: string): Promise<ResourceOwner | null>
}

export function requireAuthenticatedPrincipal(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new AuthenticationError('An authenticated principal is required.')
  }
  return principal
}

export function assertOwnership(
  principal: AuthenticatedPrincipal | undefined,
  owner: ResourceOwner | null | undefined,
): void {
  const authenticatedPrincipal = requireAuthenticatedPrincipal(principal)
  if (!owner) {
    throw new UnavailableError('Resource ownership is not available.')
  }

  const ownsResource = owner.type === 'user'
    ? owner.id === authenticatedPrincipal.userId
    : owner.id === authenticatedPrincipal.agentId

  if (!ownsResource) {
    throw new AuthorizationError('You are not authorized to access this resource.')
  }
}

export async function authorizeOwnedResource(
  principal: AuthenticatedPrincipal | undefined,
  resolver: OwnershipResolver,
  resourceType: OwnedResourceType,
  resourceId: string,
): Promise<void> {
  let owner: ResourceOwner | null
  try {
    owner = await resolver.resolveOwner(resourceType, resourceId)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new UnavailableError('Resource ownership is temporarily unavailable.', error)
  }
  assertOwnership(principal, owner)
}

export function assertRequestedAgentAccess(
  principal: AuthenticatedPrincipal | undefined,
  requestedAgentId: unknown,
): void {
  if (requestedAgentId === undefined) return

  const authenticatedPrincipal = requireAuthenticatedPrincipal(principal)
  if (!authenticatedPrincipal.agentId) {
    throw new UnavailableError('Agent ownership is not available for this API key.')
  }
  if (authenticatedPrincipal.agentId !== requestedAgentId) {
    throw new AuthorizationError('You are not authorized to use this agent.')
  }
}
