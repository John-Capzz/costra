import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { AgentRepository } from '../repositories/agents'
import { ExecutionEventRepository } from '../repositories/events'
import { PlanRepository } from '../repositories/plans'
import { TaskRepository } from '../repositories/tasks'
import type { DatabasePool, ExecutionEventRecord, TaskRecord } from '../repositories/types'
import { persistReconciliation } from '../services/reconciliation'
import { recordTaskEvent } from '../services/task-events'
import { validateIdentifier, validateTaskBody, validateTaskEventBody } from '../validation'
import { NotFoundError, ValidationError } from '../errors'

function serializeTask(task: TaskRecord) {
  return { ...task, budget: task.budget, estimated: task.estimated, currentSpend: task.currentSpend }
}
function serializeEvent(event: ExecutionEventRecord) {
  return { ...event, cost: event.cost }
}
function serializeReconciliation(record: { taskId: string; estimatedCost: string; budget: string; actualCost: string; variance: string | null; variancePct: string | null; completedAt: Date }) {
  return { ...record, estimatedCost: record.estimatedCost, budget: record.budget, actualCost: record.actualCost, variance: record.variance, variancePct: record.variancePct, completedAt: record.completedAt.toISOString() }
}

export function createTasksRouter(db?: DatabasePool) {
  const router = Router()
  router.get('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const agentId = req.query.agentId === undefined ? undefined : validateIdentifier(req.query.agentId, 'agentId')
      const tasks = await new TaskRepository(db ?? getDefaultDatabasePool()).listForUser(principal.userId, agentId)
      res.json({ tasks: tasks.map(serializeTask), total: tasks.length })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.post('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const input = validateTaskBody(req.body)
      const pool = db ?? getDefaultDatabasePool()
      const agent = await new AgentRepository(pool).findByIdForUser(input.agentId, principal.userId)
      if (!agent) throw new NotFoundError('Agent not found.')
      if (input.planId) {
        const plan = await new PlanRepository(pool).findByIdForUser(input.planId, principal.userId)
        if (!plan || plan.agentId !== agent.id) throw new NotFoundError('Plan not found.')
      }
      const task = await new TaskRepository(pool).createForUser(principal.userId, { agentId: agent.id, planId: input.planId ?? null, description: input.description, budget: input.budget, estimated: input.estimated, spendingMode: 'observe' })
      if (!task) throw new NotFoundError('Task could not be created.')
      res.status(201).json(serializeTask(task))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.get('/:id', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const pool = db ?? getDefaultDatabasePool()
      const task = await new TaskRepository(pool).findByIdForUser(id, principal.userId)
      if (!task) throw new NotFoundError('Task not found.')
      const events = await new ExecutionEventRepository(pool).listForTask(id, principal.userId)
      res.json({ ...serializeTask(task), events: events.map(serializeEvent) })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.post('/:id/events', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const taskId = validateIdentifier(req.params.id, 'id')
      const input = validateTaskEventBody(req.body)
      const result = await recordTaskEvent(db ?? getDefaultDatabasePool(), { taskId, userId: principal.userId, event: { type: input.type, cost: input.cost ?? null, description: input.description ?? null, provider: input.provider ?? null, txHash: input.txHash ?? null, metadata: input.metadata ?? null, idempotencyKey: input.idempotencyKey ?? null, executionMode: input.executionMode ?? 'simulated' } })
      res.status(result.duplicate ? 200 : 201).json(serializeEvent(result.event))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.patch('/:id/result', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const taskId = validateIdentifier(req.params.id, 'id')
      if (typeof req.body?.result !== 'string' || req.body.result.trim().length === 0 || req.body.result.length > 200_000) {
        throw new ValidationError('result must be a non-empty string of 200000 characters or fewer.')
      }
      const task = await new TaskRepository(db ?? getDefaultDatabasePool()).updateResultForUser(taskId, principal.userId, req.body.result)
      if (!task) throw new NotFoundError('Task not found.')
      res.json(serializeTask(task))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.post('/:id/reconcile', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const taskId = validateIdentifier(req.params.id, 'id')
      const pool = db ?? getDefaultDatabasePool()
      const task = await new TaskRepository(pool).findByIdForUser(taskId, principal.userId)
      if (!task) throw new NotFoundError('Task not found.')
      const record = await persistReconciliation(pool, { taskId, userId: principal.userId, estimatedCost: task.estimated ?? '0.000000', budget: task.budget, actualCost: task.currentSpend })
      res.json(serializeReconciliation(record))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  return router
}
