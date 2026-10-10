import { randomUUID } from 'node:crypto'
import Groq from 'groq-sdk'
import { CostraApiClient } from '../src/lib/api-client'
import { ArcAdapter, readArcTestnetExecutionConfig } from '../src/lib/arc-adapter'
import { Money } from '../src/lib/money'

const PAYMENT_AMOUNT = '0.010000'
const STEP_DELAY_MS = 2_500

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required and must be supplied through the environment.`)
  return value
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS))
}

async function generateGroq(groq: Groq, prompt: string): Promise<{ text: string; cost: string; tokens: number }> {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  })
  const text = completion.choices[0]?.message?.content ?? ''
  const tokens = completion.usage?.total_tokens ?? 500
  const cost = Money.from(String(tokens)).multiply('0.000001', 'half-up').toString()
  return { text, cost, tokens }
}

async function main(): Promise<void> {
  const taskId = process.argv[2]?.trim()
  if (!taskId) throw new Error('Usage: bun run demo:agent TASK_ID')

  const api = new CostraApiClient({
    baseUrl: process.env.COSTRA_API_BASE_URL?.trim() || 'http://localhost:3001/api/v1',
    apiKey: required('COSTRA_API_KEY'),
  })
  const groq = new Groq({ apiKey: required('GROQ_API_KEY') })
  const destination = required('ARC_TESTNET_SMOKE_DESTINATION')
  const task = await api.getTask(taskId)
  const idempotency = (step: string) => `demo-agent:${taskId}:${step}:${randomUUID()}`

  console.log(`Demo agent starting task ${task.id}: ${task.description}`)

  console.log('Step 1 — Start execution')
  await api.recordTaskEvent(taskId, {
    type: 'TASK_EXECUTING',
    idempotencyKey: idempotency('executing'),
  })
  await delay()

  console.log('Step 2 — Groq research')
  console.log('Agent: researching the task with Groq...')
  const research = await generateGroq(groq, `You are a research agent. Research the following task and provide a detailed report: ${task.description}`)
  console.log(`Groq research used ${research.tokens} tokens.`)
  await api.recordTaskEvent(taskId, {
    type: 'API_CALL',
    amount: research.cost,
    currency: 'USDC',
    description: 'Groq research inference',
    idempotencyKey: idempotency('research'),
  })
  await delay()

  console.log('Step 3 — Groq summary')
  console.log('Agent: summarizing Groq research findings...')
  const summary = await generateGroq(groq, `Summarize the following research into concise key points and actionable findings:\n\n${research.text}`)
  console.log(`Groq summary used ${summary.tokens} tokens.`)
  await api.recordTaskEvent(taskId, {
    type: 'API_CALL',
    amount: summary.cost,
    currency: 'USDC',
    description: 'Groq research summary',
    idempotencyKey: idempotency('inference'),
  })
  await api.updateTaskResult(taskId, `${research.text}\n\n## Key findings\n\n${summary.text}`)
  await delay()

  console.log('Step 4 — Real Arc Testnet transaction')
  console.log('Agent: submitting payment on Arc Testnet...')
  const adapter = new ArcAdapter(readArcTestnetExecutionConfig())
  const txHash = await adapter.submitUsdcTransfer({ destination, amount: PAYMENT_AMOUNT })
  const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`
  console.log(`Transaction hash: ${txHash}`)
  console.log(`ArcScan: ${explorerUrl}`)
  await api.recordTaskEvent(taskId, {
    type: 'SERVICE_PAYMENT',
    amount: PAYMENT_AMOUNT,
    currency: 'USDC',
    description: 'Arc Testnet USDC payment',
    txHash,
    metadata: { txHash },
    executionMode: 'real',
    idempotencyKey: idempotency('payment'),
  })
  await delay()

  console.log('Step 5 — Track and reconcile')
  await api.recordTaskEvent(taskId, {
    type: 'TASK_TRACKED',
    idempotencyKey: idempotency('tracked'),
  })
  await delay()
  await api.recordTaskEvent(taskId, {
    type: 'TASK_RECONCILED',
    idempotencyKey: idempotency('reconciled'),
  })

  const finalTask = await api.getTask(taskId)
  const expectedSpend = Money.from(research.cost).add(Money.from(summary.cost)).add(Money.from(PAYMENT_AMOUNT))
  console.log('Demo agent complete.')
  console.log('\nResearch report:\n')
  console.log(finalTask.result ?? `${research.text}\n\n## Key findings\n\n${summary.text}`)
  console.log(`Planned budget: ${finalTask.budget} USDC`)
  console.log(`Actual spend: ${finalTask.currentSpend} USDC`)
  console.log(`Demo event spend: ${expectedSpend.toString()} USDC`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Demo agent failed.')
  process.exitCode = 1
}
