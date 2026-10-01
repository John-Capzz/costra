import type { RequestHandler } from 'express'
import { AuthenticationError } from '../errors'
import { csrfMatches } from './cookies'

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (req.principal?.authMethod !== 'browser_session') return next()
  if (!csrfMatches(req)) return next(new AuthenticationError('A valid CSRF token is required.'))
  next()
}
