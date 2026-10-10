import { randomUUID } from 'node:crypto'
import Groq from 'groq-sdk'
import { ArcAdapter, readArcTestnetExecutionConfig } from '../../src/lib/arc-adapter'
import { Money } from '../../src/lib/money'
import { AgentRepository } from '../repositories/agents'
import { PlanRepository } from '../repositories/plans'
import { TaskRepository } from '../repositories/tasks'
import type { DatabasePool } from '../repositories/types'
import { recordTaskEvent } from './task-events'

const PAYMENT_AMOUNT = '0.010000'

async function generate(groq: Groq, prompt: string): Promise<{ text: string; cost: string }> {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  })
  const text = completion.choices[0]?.message?.content ?? ''
  const tokens = completion.usage?.total_tokens ?? 500
  return {
    text,
    cost: Money.from(String(tokens)).multiply('0.000001', 'half-up').toString(),
  }
}

export async function runPublicDemoAgent(
  pool: DatabasePool,
  input: { taskId: string; userId: string; taskDescription: string },
): Promise<void> {
  const groq = new Groq({ apiKey: required('GROQ_API_KEY') })
  const idempotency = (step: string) => `public-demo:${input.taskId}:${step}:${randomUUID()}`

  try {
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'TASK_EXECUTING', idempotencyKey: idempotency('executing') } })
    const research = await generate(groq, `You are a research agent. Research the following task and provide a detailed report: ${input.taskDescription}`)
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'API_CALL', cost: research.cost, description: 'Groq research inference', idempotencyKey: idempotency('research') } })
    const summary = await generate(groq, `Summarize the following research into concise key points and actionable findings:\n\n${research.text}`)
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'API_CALL', cost: summary.cost, description: 'Groq research summary', idempotencyKey: idempotency('summary') } })

    const adapter = new ArcAdapter(readArcTestnetExecutionConfig())
    const txHash = await adapter.submitUsdcTransfer({ destination: required('ARC_TESTNET_SMOKE_DESTINATION'), amount: PAYMENT_AMOUNT })
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'SERVICE_PAYMENT', cost: PAYMENT_AMOUNT, description: 'Arc Testnet USDC payment', txHash, metadata: { txHash }, executionMode: 'real', idempotencyKey: idempotency('payment') } })

    const result = `${research.text}\n\n## Key findings\n\n${summary.text}`
    await new TaskRepository(pool).updateResultForUser(input.taskId, input.userId, result)
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'TASK_TRACKED', idempotencyKey: idempotency('tracked') } })
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'TASK_RECONCILED', idempotencyKey: idempotency('reconciled') } })
  } catch (error) {
    await recordTaskEvent(pool, { taskId: input.taskId, userId: input.userId, event: { type: 'TASK_FAILED', description: 'Public demo agent failed.', idempotencyKey: idempotency('failed') } }).catch(() => undefined)
    console.error('Public demo agent failed:', error instanceof Error ? error.message : error)
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the public demo.`)
  return value
}

export function publicDemoUserId(): string {
  return required('COSTRA_PUBLIC_DEMO_USER_ID')
}
