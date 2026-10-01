import { describe, expect, test } from 'bun:test'
import { ApiClientError, CostraApiClient, getApiClientRuntimeConfig } from '../src/lib/api-client'

describe('Phase 5.1 frontend API client', () => {
  test('normalizes runtime configuration without inventing credentials', () => {
    expect(getApiClientRuntimeConfig({
      VITE_COSTRA_API_BASE_URL: 'http://api.test/api/v1/',
    })).toEqual({ baseUrl: 'http://api.test/api/v1' })
  })

  test('sends authenticated requests and parses typed responses', async () => {
    let request: Request | undefined
    const client = new CostraApiClient({
      baseUrl: 'http://api.test/api/v1',
      apiKey: 'test-api-key',
      fetch: async (input, init) => {
        request = new Request(input, init)
        return new Response(JSON.stringify({ plans: [], total: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await expect(client.plans).resolves.toEqual({ plans: [], total: 0 })
    expect(request?.url).toBe('http://api.test/api/v1/plans')
    expect(request?.headers.get('authorization')).toBe('Bearer test-api-key')
    expect(request?.headers.get('accept')).toBe('application/json')
  })

  test('preserves structured error code and request ID', async () => {
    const client = new CostraApiClient({
      fetch: async () => new Response(JSON.stringify({
        error: 'forbidden', message: 'Not allowed.', requestId: 'request-123',
      }), {
        status: 403,
        headers: { 'content-type': 'application/json', 'x-request-id': 'request-123' },
      }),
    })

    try {
      await client.getTask('task-1')
      throw new Error('Expected the API client to reject.')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError)
      expect((error as ApiClientError).status).toBe(403)
      expect((error as ApiClientError).code).toBe('forbidden')
      expect((error as ApiClientError).requestId).toBe('request-123')
    }
  })

  test('does not leak network or response internals for unavailable APIs', async () => {
    const client = new CostraApiClient({ fetch: async () => { throw new Error('secret connection detail') } })

    try {
      await client.getTask('task-1')
      throw new Error('Expected the API client to reject.')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError)
      expect((error as ApiClientError).code).toBe('unavailable')
      expect((error as ApiClientError).message).toBe('COSTRA API is unavailable.')
      expect((error as ApiClientError).message).not.toContain('secret')
    }
  })
})
