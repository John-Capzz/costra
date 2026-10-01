import { Money, MoneyError } from './money'

export const EXECUTION_NETWORK = 'Arc Testnet' as const
export const EXECUTION_CURRENCY = 'USDC' as const

export type ExecutionMode = 'observe' | 'guarded'
export type ExecutionStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'reconciled'

export interface ExecutionRequest {
  userId: string
  agentId: string
  taskId: string
  planId: string
  amount: string
  currency: typeof EXECUTION_CURRENCY
  destination: string
  network: typeof EXECUTION_NETWORK
  mode: ExecutionMode
  idempotencyKey: string
  reason?: string
}

export interface ExecutionRecord extends ExecutionRequest {
  id: string
  status: ExecutionStatus
  transactionId: string | null
  createdAt: string
  updatedAt: string
}

export class ExecutionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExecutionValidationError'
  }
}

export class ExecutionTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExecutionTransitionError'
  }
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const ID_PATTERN = /^\S+$/
const MAX_AMOUNT = '1000000000.000000'

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ExecutionValidationError(`${field} is required.`)
  }
  if (value.length > maxLength) {
    throw new ExecutionValidationError(`${field} must be ${maxLength} characters or fewer.`)
  }
  if (!ID_PATTERN.test(value) && field.endsWith('Id')) {
    throw new ExecutionValidationError(`${field} must not contain whitespace.`)
  }
  return value
}

function amount(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ExecutionValidationError('amount must be a non-negative decimal string.')
  }
  try {
    const parsed = Money.from(value)
    if (parsed.isZero()) throw new ExecutionValidationError('amount must be greater than zero.')
    if (parsed.compare(Money.from(MAX_AMOUNT)) > 0) {
      throw new ExecutionValidationError(`amount must not exceed ${MAX_AMOUNT}.`)
    }
    return parsed.toString()
  } catch (error) {
    if (error instanceof ExecutionValidationError) throw error
    if (error instanceof MoneyError) throw new ExecutionValidationError(`amount: ${error.message}`)
    throw error
  }
}

export function validateExecutionRequest(value: unknown): ExecutionRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExecutionValidationError('Execution request must be an object.')
  }
  const input = value as Record<string, unknown>
  const network = input.network ?? EXECUTION_NETWORK
  const currency = input.currency ?? EXECUTION_CURRENCY
  const mode = input.mode

  if (network !== EXECUTION_NETWORK) {
    throw new ExecutionValidationError('network must be Arc Testnet.')
  }
  if (currency !== EXECUTION_CURRENCY) {
    throw new ExecutionValidationError('currency must be USDC.')
  }
  if (mode !== 'observe' && mode !== 'guarded') {
    throw new ExecutionValidationError('mode must be observe or guarded.')
  }

  const destination = requiredText(input.destination, 'destination', 42)
  if (!ADDRESS_PATTERN.test(destination)) {
    throw new ExecutionValidationError('destination must be a valid EVM address.')
  }

  const reason = input.reason === undefined ? undefined : requiredText(input.reason, 'reason', 2_000)
  return {
    userId: requiredText(input.userId, 'userId', 128),
    agentId: requiredText(input.agentId, 'agentId', 128),
    taskId: requiredText(input.taskId, 'taskId', 128),
    planId: requiredText(input.planId, 'planId', 128),
    amount: amount(input.amount),
    currency: EXECUTION_CURRENCY,
    destination,
    network: EXECUTION_NETWORK,
    mode,
    idempotencyKey: requiredText(input.idempotencyKey, 'idempotencyKey', 128),
    ...(reason === undefined ? {} : { reason }),
  }
}

const TRANSITIONS: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['submitted', 'rejected'],
  rejected: [],
  submitted: ['confirmed', 'failed'],
  confirmed: ['reconciled'],
  failed: [],
  reconciled: [],
}

export function canTransitionExecution(from: ExecutionStatus, to: ExecutionStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function transitionExecutionStatus(from: ExecutionStatus, to: ExecutionStatus): ExecutionStatus {
  if (!canTransitionExecution(from, to)) {
    throw new ExecutionTransitionError(`Invalid execution lifecycle transition: ${from} → ${to}.`)
  }
  return to
}

export function executionRequestFingerprint(request: ExecutionRequest): string {
  return [
    request.userId,
    request.agentId,
    request.taskId,
    request.planId,
    request.amount,
    request.currency,
    request.destination.toLowerCase(),
    request.network,
    request.mode,
    request.reason ?? '',
  ].join('|')
}
