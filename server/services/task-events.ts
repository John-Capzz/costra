import { ConflictError, NotFoundError } from '../errors'
import { withDatabaseClient } from '../db/pool'
import { ExecutionEventRepository, type AppendEventInput } from '../repositories/events'
import { TaskRepository } from '../repositories/tasks'
import type { ExecutionEventRecord, Queryable, TaskRecord } from '../repositories/types'
import type { Pool } from 'pg'

export interface RecordTaskEventInput {
  taskId: string
  userId: string
  event: AppendEventInput
}

export interface RecordTaskEventResult {
  task: TaskRecord
  event: ExecutionEventRecord
  duplicate: boolean
}

export async function recordTaskEvent(
  pool: Pick<Pool, 'connect'>,
  input: RecordTaskEventInput,
): Promise<RecordTaskEventResult> {
  return withDatabaseClient(pool, async (client) => {
    await client.query('BEGIN')
    try {
      const db = client as Queryable
      const tasks = new TaskRepository(db)
      const events = new ExecutionEventRepository(db)
      const task = await tasks.findByIdForUser(input.taskId, input.userId)
      if (!task) throw new NotFoundError('Task was not found.')

      if (input.event.idempotencyKey) {
        const existing = await events.findByIdempotencyKey(
          input.taskId,
          input.userId,
          input.event.idempotencyKey,
        )
        if (existing) {
          if (existing.type !== input.event.type) {
            throw new ConflictError('The idempotency key was already used for another event.')
          }
          await client.query('COMMIT')
          return { task, event: existing, duplicate: true }
        }
      }

      const event = await events.appendForTask(input.taskId, input.userId, input.event)
      if (!event) throw new ConflictError('The event could not be persisted.')

      const updatedTask = event.cost
        ? await tasks.incrementSpendForUser(input.taskId, input.userId, event.cost)
        : task
      if (!updatedTask) throw new ConflictError('The task spend could not be updated.')

      await client.query('COMMIT')
      return { task: updatedTask, event, duplicate: false }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}
