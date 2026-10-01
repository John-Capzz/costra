import { ValidationError } from './errors'
import { CostItemValidationError, validateCostItem, type ExactCostItem } from '../src/lib/cost-item'
import type { CostItemEstimateInput } from '../src/lib/estimation-engine'
import { Money } from '../src/lib/money'

export const SUPPORTED_NETWORKS = ['Arc Testnet'] as const
export const SUPPORTED_CURRENCIES = ['USDC'] as const
export const TASK_EVENT_TYPES = [
  'TASK_CREATED',
  'PLAN_GENERATED',
  'BUDGET_APPROVED',
  'TASK_BUDGETED',
  'TASK_EXECUTING',
  'TASK_TRACKED',
  'TASK_RECONCILED',
  'API_CALL',
  'SERVICE_PAYMENT',
  'ARC_TRANSACTION',
  'RETRY',
  'SPEND_BLOCKED',
  'TASK_COMPLETED',
  'TASK_FAILED',
] as const

const MAX_MONEY = 1_000_000_000
const MAX_DECIMAL_PLACES = 6
const MONEY_PATTERN = new RegExp(`^\\d+(?:\\.\\d{1,${MAX_DECIMAL_PLACES}})?$`)
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bodyRecord(value: unknown): RecordValue {
  if (!isRecord(value)) {
    throw new ValidationError('Request body must be a JSON object.')
  }
  return value
}

function stringValue(value: unknown, field: string, maxLength: number, required = true): string | undefined {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string.`)
  }

  if (value.trim().length === 0) {
    throw new ValidationError(`${field} must not be empty.`)
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or fewer.`)
  }

  return value
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  return stringValue(value, field, maxLength, false)
}

export function parseMoney(value: unknown, field: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ValidationError(`${field} must be a non-negative decimal amount.`)
  }

  const text = typeof value === 'number' ? String(value) : value
  if (!MONEY_PATTERN.test(text)) {
    throw new ValidationError(
      `${field} must be a non-negative finite amount with no more than ${MAX_DECIMAL_PLACES} decimal places.`,
    )
  }

  const amount = Number(text)
  if (!Number.isFinite(amount) || amount > MAX_MONEY) {
    throw new ValidationError(`${field} must not exceed ${MAX_MONEY}.`)
  }

  return amount
}

/** Validates at the HTTP boundary while preserving the caller's decimal text for exact domain processing. */
export function parseMoneyString(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new ValidationError(`${field} must be a non-negative decimal amount.`)
  const text = typeof value === 'number' ? String(value) : value
  if (!MONEY_PATTERN.test(text)) throw new ValidationError(`${field} must be a non-negative finite amount with no more than ${MAX_DECIMAL_PLACES} decimal places.`)
  try {
    const amount = Money.from(text)
    if (amount.compare(Money.from(String(MAX_MONEY))) > 0) throw new Error('range')
  } catch {
    throw new ValidationError(`${field} must not exceed ${MAX_MONEY}.`)
  }
  return text
}

function optionalMoney(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined
  return parseMoney(value, field)
}

function enumValue<T extends readonly string[]>(value: unknown, field: string, allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`)
  }
  return value
}

function optionalEnum<T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
): T[number] | undefined {
  if (value === undefined) return undefined
  return enumValue(value, field, allowed)
}

export function validateTransactionHash(value: unknown, field = 'txHash'): string {
  if (typeof value !== 'string' || !TRANSACTION_HASH_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be a 32-byte hexadecimal transaction hash.`)
  }
  return value
}

export function validateIdentifier(value: unknown, field: string): string {
  return stringValue(value, field, 128) as string
}

export interface ValidatedPlanBody {
  agentId: string
  agentName: string
  task: string
  network: string
  currency: string
  maxBudget: string
}

export interface ValidatedExactPlanBody {
  agentId: string
  task: string
  network: 'Arc Testnet'
  currency: 'USDC'
  maxBudget: string
  safetyMargin: { type: 'fixed' | 'percentage'; value: string }
  items: CostItemEstimateInput[]
}

function validateExactCostItem(value: unknown, index: number): CostItemEstimateInput {
  try {
    const item = validateCostItem({
      ...(typeof value === 'object' && value !== null ? value : {}),
      estimated: '0.000000',
    })
    const exact: ExactCostItem = item
    return {
      id: exact.id,
      type: exact.type,
      label: exact.label,
      provider: exact.provider,
      unitPrice: exact.unitPrice,
      quantity: exact.quantity,
      confidence: exact.confidence,
      source: exact.source,
      currency: exact.currency,
    }
  } catch (error) {
    if (error instanceof CostItemValidationError) {
      throw new ValidationError(`items[${index}]: ${error.message}`)
    }
    throw error
  }
}

export function validateExactPlanBody(value: unknown): ValidatedExactPlanBody {
  const body = bodyRecord(value)
  const rawItems = body.items
  if (!Array.isArray(rawItems) || rawItems.length > 100) {
    throw new ValidationError('items must be an array containing no more than 100 cost items.')
  }

  const margin = body.safetyMargin
  if (!isRecord(margin)) {
    throw new ValidationError('safetyMargin must include a type and value.')
  }
  const marginType = enumValue(margin.type, 'safetyMargin.type', ['fixed', 'percentage'] as const)
  const marginValue = typeof margin.value === 'string'
    ? margin.value
    : (() => { throw new ValidationError('safetyMargin.value must be a decimal string.') })()
  parseMoneyString(marginValue, 'safetyMargin.value')
  if (marginType === 'percentage' && Money.from(marginValue).compare(Money.from('100')) > 0) {
    throw new ValidationError('safetyMargin.value must not exceed 100 for a percentage margin.')
  }

  return {
    agentId: stringValue(body.agentId, 'agentId', 128) as string,
    task: stringValue(body.task, 'task', 2_000) as string,
    network: enumValue(body.network ?? 'Arc Testnet', 'network', SUPPORTED_NETWORKS),
    currency: enumValue(body.currency ?? 'USDC', 'currency', SUPPORTED_CURRENCIES),
    maxBudget: typeof body.maxBudget === 'string'
      ? (parseMoneyString(body.maxBudget, 'maxBudget'), body.maxBudget)
      : (() => { throw new ValidationError('maxBudget must be a decimal string for exact planning.') })(),
    safetyMargin: { type: marginType, value: marginValue },
    items: rawItems.map(validateExactCostItem),
  }
}

export function validatePlanBody(value: unknown): ValidatedPlanBody {
  const body = bodyRecord(value)
  return {
    agentId: optionalString(body.agentId, 'agentId', 128) ?? 'unknown',
    agentName: optionalString(body.agentName, 'agentName', 200) ?? 'Agent',
    task: stringValue(body.task, 'task', 2_000) as string,
    network: optionalEnum(body.network, 'network', SUPPORTED_NETWORKS) ?? 'Arc Testnet',
    currency: optionalEnum(body.currency, 'currency', SUPPORTED_CURRENCIES) ?? 'USDC',
    maxBudget: parseMoneyString(body.maxBudget, 'maxBudget'),
  }
}

export interface ValidatedTaskBody {
  description: string
  agentId: string
  network: string
  currency: string
  budget: string
  estimated: string
  planId?: string
}

export function validateTaskBody(value: unknown): ValidatedTaskBody {
  const body = bodyRecord(value)
  return {
    description: stringValue(body.description, 'description', 2_000) as string,
    agentId: optionalString(body.agentId, 'agentId', 128) ?? 'unknown',
    network: optionalEnum(body.network, 'network', SUPPORTED_NETWORKS) ?? 'Arc Testnet',
    currency: optionalEnum(body.currency, 'currency', SUPPORTED_CURRENCIES) ?? 'USDC',
    budget: parseMoneyString(body.budget, 'budget'),
    estimated: body.estimated === undefined ? '0' : parseMoneyString(body.estimated, 'estimated'),
    planId: optionalString(body.planId, 'planId', 128),
  }
}

export interface ValidatedTaskEventBody {
  type: string
  cost?: string
  description?: string
  provider?: string
  txHash?: string
  idempotencyKey?: string
}

export function validateTaskEventBody(value: unknown): ValidatedTaskEventBody {
  const body = bodyRecord(value)
  const txHash = body.txHash === undefined ? undefined : validateTransactionHash(body.txHash)

  return {
    type: enumValue(body.type, 'type', TASK_EVENT_TYPES),
    cost: body.cost === undefined ? undefined : parseMoneyString(body.cost, 'cost'),
    description: optionalString(body.description, 'description', 2_000),
    provider: optionalString(body.provider, 'provider', 200),
    txHash,
    idempotencyKey: optionalString(body.idempotencyKey, 'idempotencyKey', 128),
  }
}

export interface ValidatedBudgetCheckBody {
  current: string
  limit: string
  proposedSpend: string
}

export function validateBudgetCheckBody(value: unknown): ValidatedBudgetCheckBody {
  const body = bodyRecord(value)
  return {
    current: parseMoneyString(body.current, 'current'),
    limit: parseMoneyString(body.limit, 'limit'),
    proposedSpend: parseMoneyString(body.proposedSpend, 'proposedSpend'),
  }
}

function queryString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    throw new ValidationError(`${field} must be provided once.`)
  }
  return stringValue(value, field, maxLength)
}

function queryInteger(value: unknown, field: string, minimum: number, maximum: number): number | undefined {
  const text = queryString(value, field, 10)
  if (text === undefined || !/^\d+$/.test(text)) {
    if (text === undefined) return undefined
    throw new ValidationError(`${field} must be an integer.`)
  }

  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ValidationError(`${field} must be between ${minimum} and ${maximum}.`)
  }
  return parsed
}

function validDate(value: string, field: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new ValidationError(`${field} must be a valid date in YYYY-MM-DD format.`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    month < 1 || month > 12 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${field} must be a valid date in YYYY-MM-DD format.`)
  }

  return value
}

export interface ValidatedSpendingQuery {
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export function validateSpendingQuery(value: unknown): ValidatedSpendingQuery {
  if (!isRecord(value)) {
    throw new ValidationError('Query parameters are invalid.')
  }

  const from = queryString(value.from, 'from', 10)
  const to = queryString(value.to, 'to', 10)
  return {
    from: from ? validDate(from, 'from') : undefined,
    to: to ? validDate(to, 'to') : undefined,
    limit: queryInteger(value.limit, 'limit', 1, 100),
    offset: queryInteger(value.offset, 'offset', 0, 1_000_000),
  }
}
