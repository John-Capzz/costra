// ============================================================
// COSTRA API — POST /plans  GET /plans/:id
// ============================================================

import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { estimateCost, buildCostPlan } from '../../src/lib/cost-engine'

export function createPlansRouter() {
  const router = Router()

  // POST /api/v1/plans — create a cost plan
  router.post('/', (req, res) => {
    const { agentId, agentName, task, network, currency, maxBudget } = req.body

    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return res.status(400).json({ error: 'validation', message: 'task is required' })
    }
    if (!maxBudget || isNaN(parseFloat(maxBudget))) {
      return res.status(400).json({ error: 'validation', message: 'maxBudget must be a number' })
    }

    const estimation = estimateCost({
      agentId:   agentId ?? 'unknown',
      agentName: agentName ?? 'Agent',
      task:      task.trim(),
      network:   network ?? 'Arc Testnet',
      currency:  currency ?? 'USDC',
      maxBudget: parseFloat(maxBudget),
    })

    const planId = `plan_${randomUUID().slice(0, 8)}`
    const plan   = buildCostPlan(
      { agentId: agentId ?? 'unknown', agentName: agentName ?? 'Agent', task, network: network ?? 'Arc Testnet', currency: currency ?? 'USDC', maxBudget: parseFloat(maxBudget) },
      estimation,
      planId,
    )

    res.status(201).json({
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  })

  // GET /api/v1/plans/:id
  router.get('/:id', (req, res) => {
    // In production: fetch from DB
    res.status(404).json({ error: 'not_found', message: `Plan ${req.params.id} not found.` })
  })

  return router
}
