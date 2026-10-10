import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { AgentRepository } from '../repositories/agents'
import { ExecutionEventRepository } from '../repositories/events'
import { PlanRepository } from '../repositories/plans'
import { TaskRepository } from '../repositories/tasks'
import type { DatabasePool, ExecutionEventRecord, TaskRecord } from '../repositories/types'
import { NotFoundError, ValidationError } from '../errors'
import { publicDemoUserId, runPublicDemoAgent } from '../services/public-demo-agent'

function serializeTask(task: TaskRecord) {
  return { ...task, budget: task.budget, estimated: task.estimated, currentSpend: task.currentSpend }
}

function serializeEvent(event: ExecutionEventRecord) {
  return { ...event, cost: event.cost }
}

function description(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2_000) {
    throw new ValidationError('description must be a non-empty string of 2000 characters or fewer.')
  }
  return value.trim()
}

export function createPublicDemoRouter(db?: DatabasePool) {
  const router = Router()

  router.post('/tasks', async (req, res, next) => {
    try {
      const pool = db ?? getDefaultDatabasePool()
      const userId = publicDemoUserId()
      const taskDescription = description(req.body?.description)
      const agent = await new AgentRepository(pool).createForUser(userId, { name: 'Public Groq Research Agent', description: 'COSTRA public research demo agent.' })
      const plan = await new PlanRepository(pool).createForUser(userId, {
        agentId: agent.id,
        taskDescription,
        maxBudget: '1.000000',
        estimatedCost: '0.000000',
        safetyBuffer: '0.000000',
        recommendedBudget: '1.000000',
        confidence: '0.0000',
        status: 'approved',
      })
      if (!plan) throw new NotFoundError('Public demo plan could not be created.')
      const task = await new TaskRepository(pool).createForUser(userId, {
        agentId: agent.id,
        planId: plan.id,
        description: taskDescription,
        budget: '1.000000',
        estimated: '0.000000',
      })
      if (!task) throw new NotFoundError('Public demo task could not be created.')
      void runPublicDemoAgent(pool, { taskId: task.id, userId, taskDescription })
      res.status(202).json(serializeTask(task))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })

  router.get('/tasks/:id', async (req, res, next) => {
    try {
      const pool = db ?? getDefaultDatabasePool()
      const userId = publicDemoUserId()
      const task = await new TaskRepository(pool).findByIdForUser(req.params.id, userId)
      if (!task) throw new NotFoundError('Public demo task not found.')
      const events = await new ExecutionEventRepository(pool).listForTask(task.id, userId)
      res.json({ ...serializeTask(task), events: events.map(serializeEvent) })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })

  return router
}
