import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import express from 'express'
import type { Server } from 'node:http'
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnavailableError,
  ValidationError,
} from '../server/errors'
import { errorHandler } from '../server/middleware/error'
import { isValidRequestId, requestIdMiddleware } from '../server/middleware/requestId'

let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = express()
  app.use(requestIdMiddleware)

  app.get('/ok', (req, res) => {
    res.json({ requestId: req.requestId })
  })

  app.get('/validation', () => {
    throw new ValidationError('Input is invalid.')
  })

  app.get('/unexpected', () => {
    throw new Error('secret internal path')
  })

  app.get('/known/:type', (req) => {
    const errors: Record<string, AppError> = {
      authentication: new AuthenticationError(),
      authorization: new AuthorizationError(),
      conflict: new ConflictError(),
      internal: new InternalServerError('private internal detail'),
      not_found: new NotFoundError(),
      unavailable: new UnavailableError(),
      validation: new ValidationError(),
    }

    throw errors[req.params.type] ?? new NotFoundError()
  })

  app.use((_req, _res, next) => next(new NotFoundError()))
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

describe('request IDs', () => {
  test('generates and propagates a request ID', async () => {
    const response = await fetch(`${baseUrl}/ok`)
    const requestId = response.headers.get('x-request-id')
    const body = await response.json() as { requestId: string }

    expect(response.status).toBe(200)
    expect(requestId).toBeTruthy()
    expect(isValidRequestId(requestId ?? '')).toBe(true)
    expect(body.requestId).toBe(requestId)
  })

  test('preserves a valid incoming request ID', async () => {
    const requestId = 'client.request:123'
    const response = await fetch(`${baseUrl}/ok`, {
      headers: { 'X-Request-ID': requestId },
    })
    const body = await response.json() as { requestId: string }

    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(body.requestId).toBe(requestId)
  })

  test('does not accept an invalid incoming request ID', async () => {
    const response = await fetch(`${baseUrl}/ok`, {
      headers: { 'X-Request-ID': 'contains spaces' },
    })
    const requestId = response.headers.get('x-request-id')

    expect(requestId).toBeTruthy()
    expect(requestId).not.toBe('contains spaces')
    expect(isValidRequestId(requestId ?? '')).toBe(true)
  })
})

describe('structured errors', () => {
  test('returns a consistent known error shape with the request ID', async () => {
    const response = await fetch(`${baseUrl}/validation`, {
      headers: { 'X-Request-ID': 'known-error-test' },
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'validation',
      message: 'Input is invalid.',
      requestId: 'known-error-test',
    })
  })

  test('maps application error types to their public status and code', async () => {
    const cases = [
      ['authentication', 401, 'unauthorized'],
      ['authorization', 403, 'forbidden'],
      ['conflict', 409, 'conflict'],
      ['internal', 500, 'internal_error'],
      ['not_found', 404, 'not_found'],
      ['unavailable', 503, 'unavailable'],
      ['validation', 400, 'validation'],
    ] as const

    for (const [type, status, code] of cases) {
      const response = await fetch(`${baseUrl}/known/${type}`)
      const body = await response.json() as { error: string; requestId: string }

      expect(response.status).toBe(status)
      expect(body.error).toBe(code)
      expect(body.requestId).toBeTruthy()
    }
  })

  test('does not leak unexpected error details', async () => {
    const response = await fetch(`${baseUrl}/unexpected`, {
      headers: { 'X-Request-ID': 'unexpected-error-test' },
    })
    const text = await response.text()
    const body = JSON.parse(text) as { error: string; message: string; requestId: string }

    expect(response.status).toBe(500)
    expect(body).toEqual({
      error: 'internal_error',
      message: 'An unexpected error occurred.',
      requestId: 'unexpected-error-test',
    })
    expect(text).not.toContain('secret internal path')
    expect(text).not.toContain('server\\')
  })

  test('uses the structured not-found response for unmatched routes', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`, {
      headers: { 'X-Request-ID': 'not-found-test' },
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({
      error: 'not_found',
      message: 'The requested resource was not found.',
      requestId: 'not-found-test',
    })
  })
})
