import { ConflictError, NotFoundError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { ExecutionEventRepository, type AppendEventInput } from '../repositories/events'
import { TaskRepository } from '../repositories/tasks'
import type { Queryable, ExecutionEventRecord, TaskRecord } from '../repositories/types'
import type { Pool } from 'pg'

export type TaskLifecycleStatus = TaskRecord['lifecycleStatus']

const LEGAL_TRANSITIONS: Record<TaskLifecycleStatus, readonly TaskLifecycleStatus[]> = {
  planned: ['budgeted', 'failed', 'blocked'],
  budgeted: ['executing', 'failed', 'blocked'],
  executing: ['tracked', 'failed', 'blocked'],
  tracked: ['reconciled', 'failed', 'blocked'],
  reconciled: [],
  failed: [],
  blocked: [],
}

const TRANSITION_EVENTS: Record<string, string> = {
  'planned:budgeted': 'TASK_BUDGETED',
  'budgeted:executing': 'TASK_EXECUTING',
  'executing:tracked': 'TASK_TRACKED',
  'tracked:reconciled': 'TASK_RECONCILED',
  'planned:failed': 'TASK_FAILED',
  'budgeted:failed': 'TASK_FAILED',
  'executing:failed': 'TASK_FAILED',
  'tracked:failed': 'TASK_FAILED',
  'planned:blocked': 'SPEND_BLOCKED',
  'budgeted:blocked': 'SPEND_BLOCKED',
  'executing:blocked': 'SPEND_BLOCKED',
  'tracked:blocked': 'SPEND_BLOCKED',
}

export interface TransitionTaskInput {
  taskId: string
  userId: string
  to: TaskLifecycleStatus
  idempotencyKey?: string | null
  event?: Omit<AppendEventInput, 'type' | 'idempotencyKey'>
}

export interface TransitionTaskResult {
  task: TaskRecord
  event: ExecutionEventRecord
  duplicate: boolean
}

function transitionEvent(from: TaskLifecycleStatus, to: TaskLifecycleStatus): string {
  const type = TRANSITION_EVENTS[`${from}:${to}`]
  if (!type) throw new ConflictError(`Invalid task lifecycle transition: ${from} → ${to}.`)
  return type
}

export async function transitionTask(
  pool: Pick<Pool, 'connect'>,
  input: TransitionTaskInput,
): Promise<TransitionTaskResult> {
  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const db = client as Queryable
      const tasks = new TaskRepository(db)
      const events = new ExecutionEventRepository(db)
      const current = await tasks.findByIdForUser(input.taskId, input.userId)
      if (!current) throw new NotFoundError('Task was not found.')

      if (input.idempotencyKey) {
        const existing = await events.findByIdempotencyKey(
          input.taskId,
          input.userId,
          input.idempotencyKey,
        )
        if (existing) {
          const expectedType = TRANSITION_EVENTS[`${current.lifecycleStatus}:${input.to}`]
          if (existing.type !== expectedType) {
            throw new ConflictError('The idempotency key was already used for another lifecycle event.')
          }
          await client.query('COMMIT')
          return { task: current, event: existing, duplicate: true }
        }
      }

      if (!LEGAL_TRANSITIONS[current.lifecycleStatus].includes(input.to)) {
        throw new ConflictError(
          `Invalid task lifecycle transition: ${current.lifecycleStatus} → ${input.to}.`,
        )
      }

      const eventType = transitionEvent(current.lifecycleStatus, input.to)
      const updated = await tasks.transitionLifecycleForUser(
        input.taskId,
        input.userId,
        current.lifecycleStatus,
        input.to,
      )
      if (!updated) {
        throw new ConflictError('The task lifecycle changed before this transition was committed.')
      }

      const event = await events.appendForTask(input.taskId, input.userId, {
        ...input.event,
        type: eventType,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      if (!event) throw new ConflictError('The lifecycle event could not be persisted.')

      await client.query('COMMIT')
      return { task: updated, event, duplicate: false }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
