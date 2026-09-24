import { Router } from 'express'
import { DEMO_SPENDING_SERIES } from '../../src/lib/demo-data'

export function createSpendingRouter() {
  const router = Router()
  router.get('/', (req, res) => {
    const { from, to } = req.query
    let series = DEMO_SPENDING_SERIES
    if (from) series = series.filter((d) => d.date >= (from as string))
    if (to)   series = series.filter((d) => d.date <= (to as string))
    res.json({ series, total: series.reduce((s, d) => s + d.amount, 0) })
  })
  return router
}
