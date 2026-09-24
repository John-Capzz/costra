import { Router } from 'express'
import { DEMO_AGENTS } from '../../src/lib/demo-data'

export function createAgentsRouter() {
  const router = Router()
  router.get('/', (_req, res) => res.json({ agents: DEMO_AGENTS, total: DEMO_AGENTS.length }))
  router.get('/:id', (req, res) => {
    const agent = DEMO_AGENTS.find((a) => a.id === req.params.id)
    if (!agent) return res.status(404).json({ error: 'not_found' })
    res.json(agent)
  })
  return router
}
