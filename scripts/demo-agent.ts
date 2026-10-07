import { randomUUID } from 'node:crypto'
import { CostraApiClient } from '../src/lib/api-client'
import { ArcAdapter, readArcTestnetExecutionConfig } from '../src/lib/arc-adapter'
import { Money } from '../src/lib/money'

const PAYMENT_AMOUNT = '0.010000'
const API_CALL_COST = '0.410000'
const INFERENCE_COST = '0.310000'
const STEP_DELAY_MS = 2_500

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required and must be supplied through the environment.`)
  return value
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS))
}

async function main(): Promise<void> {
  const taskId = process.argv[2]?.trim()
  if (!taskId) throw new Error('Usage: bun run demo:agent TASK_ID')

  const api = new CostraApiClient({
    baseUrl: process.env.COSTRA_API_BASE_URL?.trim() || 'http://localhost:3001/api/v1',
    apiKey: required('COSTRA_API_KEY'),
  })
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

  console.log('Step 2 — API research calls')
  console.log('Agent: making 233 API calls for DeFi research...')
  await api.recordTaskEvent(taskId, {
    type: 'API_CALL',
    amount: API_CALL_COST,
    currency: 'USDC',
    description: 'DeFi protocol data — 233 API calls',
    idempotencyKey: idempotency('research'),
  })
  await delay()

  console.log('Step 3 — Agent inference')
  console.log('Agent: running inference on collected data...')
  await api.recordTaskEvent(taskId, {
    type: 'API_CALL',
    amount: INFERENCE_COST,
    currency: 'USDC',
    description: 'LLM inference — 100k tokens',
    idempotencyKey: idempotency('inference'),
  })
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
  const expectedSpend = Money.from(API_CALL_COST).add(Money.from(INFERENCE_COST)).add(Money.from(PAYMENT_AMOUNT))
  console.log('Demo agent complete.')
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
