import type { Request, Response, NextFunction } from 'express'
import type { ApiKeyStore } from '../auth/contracts'
import { createPostgresApiKeyStore } from '../auth/postgres-store'
import { authenticateApiKey, extractBearerToken } from '../auth/service'
import type { BrowserSessionStore } from '../auth/browser-session'
import { buildBrowserPrincipal, hashSessionToken } from '../auth/browser-session'
import { getCookie, SESSION_COOKIE } from './cookies'
import { createPostgresBrowserSessionStore } from '../auth/postgres-browser-store'
import { AuthenticationError, UnavailableError } from '../errors'

export function createAuthMiddleware(store?: ApiKeyStore, sessionStore?: BrowserSessionStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const bearer = extractBearerToken(req)
      if (bearer) {
        req.principal = await authenticateApiKey(bearer, store)
        next()
        return
      }

      const sessionToken = getCookie(req, SESSION_COOKIE)
      if (!sessionToken) {
        req.principal = undefined
        next()
        return
      }
      const sessions = sessionStore ?? createPostgresBrowserSessionStore()
      let record
      try {
        record = await sessions.findSessionByTokenHash(hashSessionToken(sessionToken), new Date())
      } catch (error) {
        throw new UnavailableError('Browser authentication is temporarily unavailable.', error)
      }
      if (!record) throw new AuthenticationError('Your browser session is invalid or expired.')
      req.principal = buildBrowserPrincipal(record, new Date())
      req.browserSession = { sessionId: record.id, token: sessionToken, csrfToken: record.csrfToken }
      next()
    } catch (error) {
      next(error)
    }
  }
}

// The store is lazy: missing configuration or an unavailable database is reported
// through the structured authentication boundary instead of breaking /health.
export const authMiddleware = createAuthMiddleware(createPostgresApiKeyStore())
