import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { SpendingRepository } from '../repositories/spending'
import type { DatabasePool } from '../repositories/types'
import { validateSpendingQuery } from '../validation'
import { Money } from '../../src/lib/money'

function requireMoney(value: string): Money { return Money.from(value) }

export function createSpendingRouter(db?: DatabasePool) {
  const router = Router()
  router.get('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const query = validateSpendingQuery(req.query)
      const points = await new SpendingRepository(db ?? getDefaultDatabasePool()).listDailyForUser(principal.userId, query.from, query.to)
      const total = points.reduce((sum, point) => sum.add(requireMoney(point.amount)), requireMoney('0'))
      res.json({ series: points.map((point) => ({ date: point.date, amount: point.amount })), total: total.toString() })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  return router
}
