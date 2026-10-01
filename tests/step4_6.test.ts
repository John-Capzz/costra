import { afterEach, describe, expect, test } from 'bun:test'
import type { RequestHandler } from 'express'
import { createApp } from '../server/app'

const principalAuth: RequestHandler = (req, _res, next) => {
  req.principal = {
    authMethod: 'api_key',
    apiKeyId: 'api-key-4-6',
    userId: 'user-4-6',
    agentId: 'agent-4-6',
    authenticatedAt: new Date(),
  }
  next()
}

const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = []

async function request(auth: RequestHandler, body: object, headers: Record<string, string> = {}) {
  const server = createApp({ auth }).listen(0)
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.')
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/executions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return response
}

afterEach(() => {
  while (servers.length > 0) servers.pop()?.close()
})

describe('Phase 4.6 execution API boundary', () => {
  test('rejects unauthenticated execution requests', async () => {
    const response = await request((_req, _res, next) => next(), {})
    const body = await response.json() as { error: string; requestId: string }
    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
    expect(body.requestId).toBeTruthy()
  })

  test('validates execution capability inputs and preserves request IDs', async () => {
    const response = await request(principalAuth, {
      agentId: 'agent-4-6', taskId: 'task-4-6', planId: 'plan-4-6', amount: '0.10',
      destination: `0x${'1'.repeat(40)}`, network: 'Ethereum', currency: 'USDC',
      mode: 'guarded', idempotencyKey: 'phase4-6-validation',
    }, { 'x-request-id': 'phase4.6-test' })
    const body = await response.json() as { error: string; requestId: string; message: string }
    expect(response.status).toBe(400)
    expect(body.error).toBe('validation')
    expect(body.requestId).toBe('phase4.6-test')
    expect(response.headers.get('x-request-id')).toBe('phase4.6-test')
    expect(body.message).not.toContain('stack')
  })
})
