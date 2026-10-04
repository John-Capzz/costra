import type { RequestHandler } from 'express'
import { AuthenticationError } from '../errors'
import { csrfTokensMatch } from '../auth/browser-session'

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (req.principal?.authMethod !== 'browser_session') return next()
  if (!req.browserSession || !csrfTokensMatch(req.browserSession.csrfToken, req.get('x-csrf-token') ?? null)) {
    return next(new AuthenticationError('A valid CSRF token is required.'))
  }
  next()
}
