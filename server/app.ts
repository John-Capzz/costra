import express from 'express'
import cors from 'cors'
import { createPlansRouter }   from './routes/plans'
import { createTasksRouter }   from './routes/tasks'
import { createAgentsRouter }  from './routes/agents'
import { createSpendingRouter } from './routes/spending'
import { createBudgetRouter }  from './routes/budget'
import { errorHandler }        from './middleware/error'
import { createRateLimiter }   from './middleware/rateLimit'
import { authMiddleware }      from './middleware/auth'
import { requestIdMiddleware } from './middleware/requestId'
import { NotFoundError }       from './errors'
import { requireAuthenticatedPrincipal } from './auth/authorization'
import { createExecutionsRouter, createExecutionRelatedRouter } from './routes/executions'
import { createApiKeysRouter } from './routes/api-keys'
import { getDefaultDatabasePool } from './db/pool'
import { UnavailableError } from './errors'
import { MetricsRegistry, observabilityMiddleware } from './observability'
import { createAuthRouter } from './routes/auth'
import { csrfProtection } from './middleware/csrf'
import { createPostgresBrowserSessionStore } from './auth/postgres-browser-store'
import type { RequestHandler } from 'express'
import type { DatabasePool } from './repositories/types'
import type { BrowserSessionStore } from './auth/browser-session'

export interface AppOptions {
  db?: DatabasePool
  auth?: RequestHandler
  browserSessionStore?: BrowserSessionStore
}

export function createApp(options: AppOptions = {}) {
  const app = express()
  const metrics = new MetricsRegistry()
  app.locals.metrics = metrics

  app.use(requestIdMiddleware)
  app.use(observabilityMiddleware(metrics))
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
  app.use(cors({ origin: corsOrigin, credentials: true }))
  app.use(express.json({ limit: '256kb' }))
  app.use(createRateLimiter())

  app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))
  app.get('/ready', async (_req, res, next) => {
    if (process.env.COSTRA_ENV !== 'staging' && process.env.COSTRA_ENV !== 'production') {
      return res.json({ status: 'ready', dependencies: 'development-mode' })
    }
    try {
      await (options.db ?? getDefaultDatabasePool()).query('SELECT 1')
      return res.json({ status: 'ready', dependencies: { postgres: 'ok' } })
    } catch (error) {
      return next(new UnavailableError('Required staging dependencies are unavailable.', error))
    }
  })

  const auth = options.auth ?? authMiddleware
  app.use('/api/v1/auth', createAuthRouter(auth, options.browserSessionStore ?? createPostgresBrowserSessionStore({ pool: options.db })))

  const v1 = express.Router()
  v1.use(auth)
  v1.use(csrfProtection)
  v1.use((req, _res, next) => {
    try {
      requireAuthenticatedPrincipal(req.principal)
      next()
    } catch (error) {
      next(error)
    }
  })
  v1.use(createRateLimiter({
    maxRequests: 120,
    prefix: 'principal',
    key: (req) => req.principal?.userId ?? 'unknown',
  }))
  v1.use('/plans',    createPlansRouter(options.db))
  v1.use('/tasks',    createTasksRouter(options.db))
  v1.use('/agents',   createAgentsRouter(options.db))
  v1.use('/spending', createSpendingRouter(options.db))
  v1.use('/budget',   createBudgetRouter())
  v1.use('/executions', createExecutionsRouter(options.db))
  v1.use('/api-keys', createApiKeysRouter(options.db))
  v1.use(createExecutionRelatedRouter(options.db))

  app.use('/api/v1', v1)
  app.use((_req, _res, next) => next(new NotFoundError()))
  app.use(errorHandler)

  return app
}
