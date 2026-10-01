import { describe, expect, test } from 'bun:test'
import {
  ExecutionTransitionError,
  ExecutionValidationError,
  canTransitionExecution,
  executionRequestFingerprint,
  transitionExecutionStatus,
  validateExecutionRequest,
} from '../src/lib/execution-domain'

const validRequest = {
  userId: 'user-1',
  agentId: 'agent-1',
  taskId: 'task-1',
  planId: 'plan-1',
  amount: '0.400000',
  currency: 'USDC',
  destination: `0x${'a'.repeat(40)}`,
  network: 'Arc Testnet',
  mode: 'guarded',
  idempotencyKey: 'execution-1',
  reason: 'Pay the approved service provider',
}

describe('Phase 4.1 execution domain', () => {
  test('validates a controlled execution request with exact amount semantics', () => {
    expect(validateExecutionRequest(validRequest)).toEqual({
      ...validRequest,
      amount: '0.400000',
    })
  })

  test('rejects invalid amount, address, network, currency, and mode', () => {
    for (const input of [
      { ...validRequest, amount: '-0.1' },
      { ...validRequest, amount: 'NaN' },
      { ...validRequest, amount: '0' },
      { ...validRequest, destination: '0x1234' },
      { ...validRequest, network: 'Arc Mainnet' },
      { ...validRequest, currency: 'ETH' },
      { ...validRequest, mode: 'automatic' },
    ]) {
      expect(() => validateExecutionRequest(input)).toThrow(ExecutionValidationError)
    }
  })

  test('requires ownership and idempotency context', () => {
    for (const field of ['userId', 'agentId', 'taskId', 'planId', 'idempotencyKey']) {
      const input = { ...validRequest, [field]: '' }
      expect(() => validateExecutionRequest(input)).toThrow(ExecutionValidationError)
    }
  })

  test('models the explicit execution lifecycle', () => {
    expect(canTransitionExecution('requested', 'approved')).toBe(true)
    expect(canTransitionExecution('approved', 'submitted')).toBe(true)
    expect(canTransitionExecution('submitted', 'confirmed')).toBe(true)
    expect(canTransitionExecution('confirmed', 'reconciled')).toBe(true)
    expect(canTransitionExecution('requested', 'confirmed')).toBe(false)
    expect(() => transitionExecutionStatus('requested', 'confirmed')).toThrow(ExecutionTransitionError)
  })

  test('normalizes equivalent destination casing for idempotency fingerprints', () => {
    const upper = validateExecutionRequest(validRequest)
    const lower = validateExecutionRequest({ ...validRequest, destination: `0x${'a'.repeat(40).toUpperCase()}` })
    expect(executionRequestFingerprint(upper)).toBe(executionRequestFingerprint(lower))
  })
})
