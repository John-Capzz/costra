import { Router } from 'express'
import { getDefaultDatabasePool } from '../db/pool'
import { asDatabaseUnavailable } from '../db/errors'
import { requireAuthenticatedPrincipal } from '../auth/authorization'
import { AgentRepository } from '../repositories/agents'
import { PlanRepository } from '../repositories/plans'
import type { CostItemRecord, CostPlanRecord, DatabasePool } from '../repositories/types'
import { persistEstimatedPlan } from '../services/plan-persistence'
import { persistExactPlan } from '../services/phase3-plan-persistence'
import { validateExactPlanBody, validateIdentifier, validatePlanBody } from '../validation'
import { BudgetPlanningError } from '../../src/lib/budget-planning'
import { ConflictError, NotFoundError, ValidationError } from '../errors'

function serializePlan(plan: CostPlanRecord, items: CostItemRecord[] = []) {
  return {
    ...plan,
    network: plan.network === 'arc-testnet' ? 'Arc Testnet' : plan.network,
    maxBudget: plan.maxBudget,
    estimatedCost: plan.estimatedCost,
    safetyBuffer: plan.safetyBuffer,
    recommendedBudget: plan.recommendedBudget,
    confidence: plan.confidence,
    items: items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice, quantity: item.quantity,
      estimated: item.estimated, confidence: item.confidence,
    })),
  }
}

function serializeExactPlan(result: Awaited<ReturnType<typeof persistExactPlan>>) {
  if (!result) return null
  return {
    id: result.plan.id,
    agentId: result.plan.agentId,
    taskDescription: result.plan.taskDescription,
    network: 'Arc Testnet',
    currency: result.estimate.currency,
    status: result.plan.status,
    maxBudget: result.budget.maximumBudget,
    estimatedCost: result.estimate.estimatedCost,
    safetyBuffer: result.budget.safetyMargin,
    recommendedBudget: result.budget.recommendedBudget,
    headroom: result.budget.headroom,
    estimateByType: result.estimate.byType,
    items: result.estimate.items.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      provider: item.provider,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      estimated: item.estimated,
      confidence: item.confidence,
      source: item.source,
      currency: item.currency,
    })),
  }
}

export function createPlansRouter(db?: DatabasePool) {
  const router = Router()
  router.get('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const repository = new PlanRepository(db ?? getDefaultDatabasePool())
      const plans = await repository.listForUser(principal.userId)
      const items = await Promise.all(plans.map((plan) => repository.listItemsForUser(plan.id, principal.userId)))
      res.json({ plans: plans.map((plan, index) => serializePlan(plan, items[index])), total: plans.length })
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  router.post('/', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      if (isExactPlanRequest(req.body)) {
        const input = validateExactPlanBody(req.body)
        const persisted = await persistExactPlan(db ?? getDefaultDatabasePool(), {
          userId: principal.userId,
          agentId: input.agentId,
          taskDescription: input.task,
          maximumBudget: input.maxBudget,
          safetyMargin: input.safetyMargin,
          items: input.items,
        })
        if (!persisted) throw new NotFoundError('Agent not found.')
        res.status(201).json(serializeExactPlan(persisted))
        return
      }
      const input = validatePlanBody(req.body)
      const pool = db ?? getDefaultDatabasePool()
      const agent = await new AgentRepository(pool).findByIdForUser(input.agentId, principal.userId)
      if (!agent) throw new NotFoundError('Agent not found.')
      const persisted = await persistEstimatedPlan(pool, {
        userId: principal.userId, agentId: agent.id, agentName: agent.name,
        taskDescription: input.task, maxBudget: input.maxBudget,
      })
      if (!persisted) throw new NotFoundError('Agent not found.')
      res.status(201).json(serializePlan(persisted.plan, persisted.items))
    } catch (error) {
      next(error instanceof BudgetPlanningError ? new ValidationError(error.message) : asDatabaseUnavailable(error))
    }
  })
  router.patch('/:id', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body) || req.body.status !== 'approved') {
        throw new ValidationError('Only status: approved is supported.')
      }
      const repository = new PlanRepository(db ?? getDefaultDatabasePool())
      const existing = await repository.findByIdForUser(id, principal.userId)
      if (!existing) throw new NotFoundError('Plan not found.')
      if (existing.status !== 'draft') throw new ConflictError('Only draft plans can be approved.')
      const approved = await repository.approveForUser(id, principal.userId)
      if (!approved) throw new ConflictError('The plan could not be approved.')
      res.json(serializePlan(approved, await repository.listItemsForUser(id, principal.userId)))
    } catch (error) {
      console.error('PATCH plans error:', error)
      next(asDatabaseUnavailable(error))
    }
  })
  router.get('/:id', async (req, res, next) => {
    try {
      const principal = requireAuthenticatedPrincipal(req.principal)
      const id = validateIdentifier(req.params.id, 'id')
      const repository = new PlanRepository(db ?? getDefaultDatabasePool())
      const plan = await repository.findByIdForUser(id, principal.userId)
      if (!plan) throw new NotFoundError('Plan not found.')
      res.json(serializePlan(plan, await repository.listItemsForUser(id, principal.userId)))
    } catch (error) { next(asDatabaseUnavailable(error)) }
  })
  return router
}

function isExactPlanRequest(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'items' in value
}
