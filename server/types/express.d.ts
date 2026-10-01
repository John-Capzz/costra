import type { Request } from 'express'
import type { AuthenticatedPrincipal } from '../auth/contracts'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      principal?: AuthenticatedPrincipal
      browserSession?: { sessionId: string; token: string }
    }
  }
}

export type CostraRequest = Request
