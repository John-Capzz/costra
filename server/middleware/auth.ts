// ============================================================
// COSTRA — API key authentication middleware
// Keys stored as SHA-256 hashes in DB — never plaintext
// ============================================================

import type { Request, Response, NextFunction } from 'express'
import { createHash } from 'node:crypto'

// Demo mode: accept any key starting with "costra_"
// Production: compare hash against database
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!apiKey) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Missing Authorization header. Use: Authorization: Bearer <api_key>',
    })
  }

  // In production: hash the key and look it up in the api_keys table
  const _keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Demo: allow any non-empty key
  if (apiKey.length < 8) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid API key format.' })
  }

  // Attach agent context (in production: fetch from DB by hash)
  ;(req as { agentId?: string }).agentId = 'agent_demo'
  next()
}
