import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { scrypt as nodeScrypt } from 'node:crypto'
import type { AuthenticatedPrincipal } from './contracts'

function scrypt(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => nodeScrypt(password, salt, keyLength, options, (error, derived) => error ? reject(error) : resolve(derived)))
}
const SCRYPT_COST = 16_384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELISM = 1
const PASSWORD_HASH_BYTES = 64
const SESSION_BYTES = 32

export interface BrowserSessionRecord {
  id: string
  userId: string
  email: string
  name: string | null
  expiresAt: Date
  revokedAt: Date | null
  csrfToken: string
}

export interface BrowserSessionStore {
  findSessionByTokenHash(tokenHash: string, now: Date): Promise<BrowserSessionRecord | null>
  createSession(input: { userId: string; tokenHash: string; csrfToken: string; expiresAt: Date; userAgent?: string; ipAddress?: string }): Promise<{ id: string; expiresAt: Date }>
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>
  findUserPassword(email: string): Promise<{ id: string; email: string; name: string | null; passwordHash: string | null } | null>
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createSessionToken(): string {
  return randomBytes(SESSION_BYTES).toString('base64url')
}

export function createCsrfToken(): string {
  return randomBytes(SESSION_BYTES).toString('base64url')
}

export function csrfTokensMatch(expected: string, presented: string | null): boolean {
  if (!presented) return false
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest()
  const presentedHash = createHash('sha256').update(presented, 'utf8').digest()
  return timingSafeEqual(expectedHash, presentedHash)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, PASSWORD_HASH_BYTES, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
  }) as Buffer
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELISM}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) return false
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nText, rText, pText, saltText, hashText] = parts
  const n = Number(nText)
  const r = Number(rText)
  const p = Number(pText)
  if (n !== SCRYPT_COST || r !== SCRYPT_BLOCK_SIZE || p !== SCRYPT_PARALLELISM) return false
  try {
    const expected = Buffer.from(hashText, 'base64url')
    const derived = await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, { N: n, r, p }) as Buffer
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

export function buildBrowserPrincipal(record: BrowserSessionRecord, authenticatedAt: Date): AuthenticatedPrincipal {
  return {
    authMethod: 'browser_session',
    sessionId: record.id,
    userId: record.userId,
    email: record.email,
    name: record.name,
    authenticatedAt,
  }
}
