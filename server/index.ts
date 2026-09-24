// ============================================================
// COSTRA — REST API Server
// Express + TypeScript backend
// ============================================================

import express from 'express'
import cors from 'cors'
import { createPlansRouter }   from './routes/plans'
import { createTasksRouter }   from './routes/tasks'
import { createAgentsRouter }  from './routes/agents'
import { createSpendingRouter } from './routes/spending'
import { createBudgetRouter }  from './routes/budget'
import { errorHandler }        from './middleware/error'
import { rateLimiter }         from './middleware/rateLimit'
import { authMiddleware }      from './middleware/auth'

const app  = express()
const PORT = process.env.PORT ?? 3001

// ---- Middleware -------------------------------------------
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '256kb' }))
app.use(rateLimiter)

// ---- Health ----------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))

// ---- API v1 ----------------------------------------------
const v1 = express.Router()
v1.use(authMiddleware)
v1.use('/plans',    createPlansRouter())
v1.use('/tasks',    createTasksRouter())
v1.use('/agents',   createAgentsRouter())
v1.use('/spending', createSpendingRouter())
v1.use('/budget',   createBudgetRouter())

app.use('/api/v1', v1)

// ---- Error handler (must be last) -----------------------
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[COSTRA API] Listening on port ${PORT}`)
})

export default app
