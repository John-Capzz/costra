import { Router } from 'express'
import { checkBudget } from '../../src/lib/budget-engine'

export function createBudgetRouter() {
  const router = Router()

  // POST /api/v1/budget/check
  router.post('/check', (req, res) => {
    const { current, limit, proposedSpend } = req.body
    if (current === undefined || limit === undefined || proposedSpend === undefined) {
      return res.status(400).json({ error: 'validation', message: 'current, limit and proposedSpend are required' })
    }
    const result = checkBudget(parseFloat(current), parseFloat(limit), parseFloat(proposedSpend))
    res.status(result.allowed ? 200 : 403).json(result)
  })

  return router
}
