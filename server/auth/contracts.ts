export interface ApiKeyRecord {
  id: string
  userId: string
  agentId?: string | null
  keyHash: string
  revokedAt?: Date | null
  lastUsedAt?: Date | null
}

export interface ApiKeyStore {
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>
  markLastUsed(apiKeyId: string, usedAt: Date): Promise<void>
}

export interface AuthenticatedPrincipal {
  authMethod: 'api_key' | 'browser_session'
  apiKeyId?: string
  sessionId?: string
  userId: string
  email?: string
  name?: string | null
  agentId?: string
  authenticatedAt: Date
}
