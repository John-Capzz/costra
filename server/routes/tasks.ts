// ============================================================
// COSTRA API — tasks routes
// ============================================================

import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { computeVariance } from '../../src/lib/budget-engine'

// In-memory store — replace with PostgreSQL in production
const taskStore = new Map<string, object>()

export function createTasksRouter() {
  const router = Router()

  // POST /api/v1/tasks
  router.post('/', (req, res) => {
    const { description, agentId, network, currency, budget, estimated, planId } = req.body
    if (!description) return res.status(400).json({ error: 'validation', message: 'description required' })
    if (!budget)      return res.status(400).json({ error: 'validation', message: 'budget required' })

    const task = {
      id:           `task_${randomUUID().slice(0, 8)}`,
      description,
      agentId:      agentId ?? 'unknown',
      network:      network ?? 'Arc Testnet',
      currency:     currency ?? 'USDC',
      status:       'pending',
      budget:       parseFloat(budget),
      estimated:    parseFloat(estimated ?? '0'),
      currentSpend: 0,
      events:       [],
      planId:       planId ?? null,
      spendingMode: 'guarded',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }
    taskStore.set(task.id, task)
    res.status(201).json(task)
  })

  // GET /api/v1/tasks/:id
  router.get('/:id', (req, res) => {
    const task = taskStore.get(req.params.id)
    if (!task) return res.status(404).json({ error: 'not_found' })
    res.json(task)
  })

  // POST /api/v1/tasks/:id/events
  router.post('/:id/events', (req, res) => {
    const task = taskStore.get(req.params.id) as Record<string, unknown> | undefined
    if (!task) return res.status(404).json({ error: 'not_found' })

    const { type, cost, description: desc, provider, txHash } = req.body
    if (!type) return res.status(400).json({ error: 'validation', message: 'event type required' })

    const event = {
      id:          `ev_${randomUUID().slice(0, 8)}`,
      type,
      timestamp:   new Date().toISOString(),
      cost:        cost ? parseFloat(cost) : undefined,
      description: desc,
      provider,
      txHash,
    }

    const events = (task.events as unknown[])
    events.push(event)
    task.currentSpend = (task.currentSpend as number) + (event.cost ?? 0)
    task.updatedAt    = new Date().toISOString()

    res.status(201).json(event)
  })

  // POST /api/v1/tasks/:id/reconcile
  router.post('/:id/reconcile', (req, res) => {
    const task = taskStore.get(req.params.id) as Record<string, unknown> | undefined
    if (!task) return res.status(404).json({ error: 'not_found' })

    const actualCost = task.currentSpend as number
    const estimated  = task.estimated as number
    const { variance, variancePct } = computeVariance(estimated, actualCost)

    task.status    = 'completed'
    task.updatedAt = new Date().toISOString()

    res.json({
      taskId:        task.id,
      estimatedCost: estimated,
      budget:        task.budget,
      actualCost,
      variance,
      variancePct,
      completedAt:   task.updatedAt,
    })
  })

  return router
}
