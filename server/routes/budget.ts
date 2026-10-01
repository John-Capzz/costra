import { Router } from 'express'
import { checkBudget } from '../../src/lib/budget-engine'
import { validateBudgetCheckBody } from '../validation'

export function createBudgetRouter() {
  const router = Router()

  // POST /api/v1/budget/check
  router.post('/check', (req, res) => {
    const { current, limit, proposedSpend } = validateBudgetCheckBody(req.body)
    const result = checkBudget(current, limit, proposedSpend)
    res.status(result.allowed ? 200 : 403).json(result)
  })

  return router
}
