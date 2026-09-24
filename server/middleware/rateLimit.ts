// ============================================================
// COSTRA — Simple in-memory rate limiter
// Production: use Redis + sliding-window algorithm
// ============================================================

import type { Request, Response, NextFunction } from 'express'

const WINDOW_MS    = 60_000   // 1 minute
const MAX_REQUESTS = 120       // per IP per window

const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip    = req.ip ?? 'unknown'
  const now   = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      error:   'rate_limited',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    })
  }

  next()
}
