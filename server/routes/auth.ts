import { Router, type RequestHandler } from 'express'
import { AuthenticationError, UnavailableError, ValidationError } from '../errors'
import type { BrowserSessionStore } from '../auth/browser-session'
import { createSessionToken, hashSessionToken, verifyPassword } from '../auth/browser-session'
import { createPostgresBrowserSessionStore } from '../auth/postgres-browser-store'
import { clearSessionCookie, csrfMatches, issueCsrfCookie, setSessionCookie } from '../middleware/cookies'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { csrfProtection } from '../middleware/csrf'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function credentials(body: unknown): { email: string; password: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Request body must be a JSON object.')
  const input = body as Record<string, unknown>
  if (typeof input.email !== 'string' || input.email.trim().length < 3 || input.email.length > 320) throw new ValidationError('email must be a valid bounded string.')
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 256) throw new ValidationError('password must be between 8 and 256 characters.')
  return { email: input.email.trim(), password: input.password }
}

export function createAuthRouter(auth: RequestHandler, store?: BrowserSessionStore) {
  const sessions = store ?? createPostgresBrowserSessionStore()
  const router = Router()

  router.get('/csrf', (_req, res) => res.json({ csrfToken: issueCsrfCookie(res) }))

  router.post('/login', csrfProtection, async (req, res, next) => {
    try {
      if (!csrfMatches(req)) throw new AuthenticationError('A valid CSRF token is required.')
      const input = credentials(req.body)
      const user = await sessions.findUserPassword(input.email)
      const valid = await verifyPassword(input.password, user?.passwordHash ?? null)
      if (!user || !valid) throw new AuthenticationError('Invalid email or password.')
      const token = createSessionToken()
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
      const session = await sessions.createSession({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        userAgent: req.get('user-agent')?.slice(0, 512),
        ipAddress: req.ip,
      })
      setSessionCookie(res, token, session.expiresAt)
      res.json({ user: { id: user.id, email: user.email, name: user.name }, expiresAt: session.expiresAt.toISOString() })
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) return next(error)
      next(new UnavailableError('Authentication service is temporarily unavailable.', error))
    }
  })

  router.use(['/logout', '/me'], auth)
  router.post('/logout', csrfProtection, async (req, res, next) => {
    try {
      requireAuthenticatedPrincipal(req.principal)
      if (!csrfMatches(req)) throw new AuthenticationError('A valid CSRF token is required.')
      if (req.browserSession) await sessions.revokeSession(req.browserSession.sessionId, new Date())
      clearSessionCookie(res)
      res.status(204).send()
    } catch (error) { next(error) }
  })

  router.get('/me', (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      res.json({ user: { id: principal.userId, email: principal.email ?? null, name: principal.name ?? null }, authMethod: principal.authMethod })
    } catch (error) { next(error) }
  })

  return router
}
