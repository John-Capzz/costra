import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import express from 'express'
import type { Server } from 'node:http'
import { errorHandler } from '../server/middleware/error'
import { requestIdMiddleware } from '../server/middleware/requestId'
import { ValidationError } from '../server/errors'
import {
  parseMoney,
  validatePlanBody,
  validateSpendingQuery,
  validateTaskEventBody,
  validateTransactionHash,
} from '../server/validation'

let server: Server
let baseUrl: string

function expectValidation(action: () => unknown): void {
  try {
    action()
    throw new Error('Expected validation to fail.')
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
  }
}

beforeAll(async () => {
  const app = express()
  app.use(requestIdMiddleware)
  app.use(express.json())

  app.post('/plans', (req, res) => res.json(validatePlanBody(req.body)))
  app.get('/spending', (req, res) => res.json(validateSpendingQuery(req.query)))
  app.use(errorHandler)

  server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP address.')
  }
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

describe('monetary validation', () => {
  test('accepts valid decimal amounts without rounding', () => {
    expect(parseMoney('12.345678', 'amount')).toBe(12.345678)
    expect(parseMoney(0, 'amount')).toBe(0)
  })

  test('rejects malformed, negative, non-finite, over-precise, and excessive amounts', () => {
    for (const value of ['12abc', '', '-1', '1.1234567', '1e3', '1000000001']) {
      expectValidation(() => parseMoney(value, 'amount'))
    }
    expectValidation(() => parseMoney(Number.NaN, 'amount'))
    expectValidation(() => parseMoney(Number.POSITIVE_INFINITY, 'amount'))
  })
})

describe('body and field validation', () => {
  test('accepts an existing plan payload and applies existing defaults', () => {
    expect(validatePlanBody({ task: 'Research Arc liquidity', maxBudget: '25.500000' })).toEqual({
      agentId: 'unknown',
      agentName: 'Agent',
      task: 'Research Arc liquidity',
      network: 'Arc Testnet',
      currency: 'USDC',
      maxBudget: '25.500000',
    })
  })

  test('rejects missing required fields and invalid enums', () => {
    expectValidation(() => validatePlanBody({ maxBudget: '1' }))
    expectValidation(() => validatePlanBody({ task: 'Task', maxBudget: '1', network: 'Ethereum' }))
    expectValidation(() => validatePlanBody({ task: 'Task', maxBudget: '1', currency: 'USD' }))
    expectValidation(() => validateTaskEventBody({ type: 'UNKNOWN_EVENT' }))
  })

  test('rejects whitespace-only and oversized strings', () => {
    expectValidation(() => validatePlanBody({ task: '   ', maxBudget: '1' }))
    expectValidation(() => validatePlanBody({ task: 'x'.repeat(2_001), maxBudget: '1' }))
  })
})

describe('transaction hashes and query parameters', () => {
  test('accepts a correctly shaped EVM transaction hash', () => {
    const hash = `0x${'a'.repeat(64)}`
    expect(validateTransactionHash(hash)).toBe(hash)
  })

  test('rejects malformed transaction hashes without checking confirmation', () => {
    for (const hash of ['0x1234', '1234', `0x${'g'.repeat(64)}`, `0x${'a'.repeat(63)}`]) {
      expectValidation(() => validateTransactionHash(hash))
    }
  })

  test('validates bounded spending query parameters', () => {
    expect(validateSpendingQuery({ from: '2026-01-01', to: '2026-01-31', limit: '25', offset: '0' })).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      limit: 25,
      offset: 0,
    })
    for (const query of [
      { limit: 'NaN' },
      { limit: 'Infinity' },
      { limit: '0' },
      { limit: '101' },
      { offset: '-1' },
      { from: 'not-a-date' },
    ]) {
      expectValidation(() => validateSpendingQuery(query))
    }
  })
})

describe('structured validation responses', () => {
  test('returns a request-scoped structured validation error at the HTTP boundary', async () => {
    const response = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': 'validation-http-test',
      },
      body: JSON.stringify({ task: 'Valid task', maxBudget: 'not-money' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'validation',
      message: expect.stringContaining('maxBudget'),
      requestId: 'validation-http-test',
    })
  })
})
