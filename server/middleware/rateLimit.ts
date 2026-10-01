import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { UnavailableError } from '../errors'
import { getDefaultDatabasePool, withDatabaseClient } from '../db/pool'
import type { DatabasePool, Queryable } from '../repositories/types'

const WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 120

interface MemoryEntry { count: number; resetAt: number }
const memoryStore = new Map<string, MemoryEntry>()

export interface RateLimitOptions {
  maxRequests?: number
  key?: (req: Request) => string
  prefix?: string
}

export interface RateLimitResult { allowed: boolean; retryAfter: number }

function clientKey(req: Request): string { return req.ip ?? 'unknown' }

function rateLimitResponse(res: Response, result: RateLimitResult): void {
  res.setHeader('Retry-After', String(result.retryAfter))
  res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Please slow down.', retryAfter: result.retryAfter })
}

function createMemoryRateLimiter(options: RateLimitOptions = {}): RequestHandler {
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS
  const key = options.key ?? clientKey
  const prefix = options.prefix ?? 'ip'
  return (req, res, next) => {
    const now = Date.now()
    const bucketKey = `${prefix}:${key(req)}`
    const entry = memoryStore.get(bucketKey)
    if (!entry || now >= entry.resetAt) {
      memoryStore.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS })
      return next()
    }
    entry.count += 1
    const result = { allowed: entry.count <= maxRequests, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
    if (result.allowed) next()
    else rateLimitResponse(res, result)
  }
}

export class PostgresRateLimitStore {
  constructor(private readonly pool: Pick<DatabasePool, 'connect'>) {}

  async consume(bucketKey: string, maxRequests: number, now = new Date()): Promise<RateLimitResult> {
    return withDatabaseClient(this.pool, async (client) => {
      const db = client as Queryable
      await db.query('BEGIN')
      try {
        const current = await db.query<{ window_started_at: Date; request_count: number }>(
          `SELECT window_started_at, request_count FROM rate_limit_buckets WHERE bucket_key = $1 FOR UPDATE`, [bucketKey],
        )
        let count = 1
        let windowStartedAt = now
        if (current.rows[0] && now.getTime() - current.rows[0].window_started_at.getTime() < WINDOW_MS) {
          count = current.rows[0].request_count + 1
          windowStartedAt = current.rows[0].window_started_at
          await db.query(`UPDATE rate_limit_buckets SET request_count = $2, updated_at = NOW() WHERE bucket_key = $1`, [bucketKey, count])
        } else {
          await db.query(
            `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, request_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (bucket_key) DO UPDATE SET window_started_at = EXCLUDED.window_started_at, request_count = 1, updated_at = NOW()`,
            [bucketKey, windowStartedAt],
          )
        }
        await db.query('COMMIT')
        return { allowed: count <= maxRequests, retryAfter: Math.max(1, Math.ceil((windowStartedAt.getTime() + WINDOW_MS - now.getTime()) / 1000)) }
      } catch (error) {
        await db.query('ROLLBACK').catch(() => undefined)
        throw error
      }
    })
  }
}

export function createPostgresRateLimiter(pool: Pick<DatabasePool, 'connect'>, options: RateLimitOptions = {}): RequestHandler {
  const store = new PostgresRateLimitStore(pool)
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS
  const key = options.key ?? clientKey
  const prefix = options.prefix ?? 'ip'
  return async (req, res, next) => {
    try {
      const result = await store.consume(`${prefix}:${key(req)}`, maxRequests)
      if (result.allowed) next()
      else rateLimitResponse(res, result)
    } catch (error) {
      next(new UnavailableError('Rate-limit service is temporarily unavailable.', error))
    }
  }
}

export function createRateLimiter(options: RateLimitOptions = {}): RequestHandler {
  if (process.env.COSTRA_ENV === 'staging' || process.env.COSTRA_ENV === 'production') {
    return createPostgresRateLimiter(getDefaultDatabasePool(), options)
  }
  return createMemoryRateLimiter(options)
}

export const rateLimiter = createRateLimiter()
