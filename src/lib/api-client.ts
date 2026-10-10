export interface ApiClientConfig {
  baseUrl?: string
  apiKey?: string
  fetch?: typeof globalThis.fetch
}

interface RawApiResponse {
  status: number
  requestId: string | null
  payload: unknown
}

interface BrowserXhr {
  open(method: string, url: string, asynchronous: boolean): void
  setRequestHeader(name: string, value: string): void
  send(body: unknown): void
  getResponseHeader(name: string): string | null
  withCredentials: boolean
  status: number
  responseText: string
  onload: (() => void) | null
  onerror: (() => void) | null
  ontimeout: (() => void) | null
}

interface BrowserXhrConstructor {
  new(): BrowserXhr
}

function getBrowserXhrConstructor(): BrowserXhrConstructor | undefined {
  return (globalThis as typeof globalThis & { XMLHttpRequest?: BrowserXhrConstructor }).XMLHttpRequest
}

export interface AuthUser { id: string; email: string | null; name: string | null }
export interface AuthSessionResponse { user: AuthUser; expiresAt?: string; authMethod?: 'api_key' | 'browser_session'; csrfToken?: string }

export interface ApiErrorPayload {
  error: string
  message: string
  requestId?: string
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(input: { status: number; code: string; message: string; requestId?: string | null }) {
    super(input.message)
    this.name = 'ApiClientError'
    this.status = input.status
    this.code = input.code
    this.requestId = input.requestId ?? null
  }
}

export interface ApiClientRuntimeConfig {
  baseUrl: string
  apiKey?: string
}

export type ApiMoney = string

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://costra-api.onrender.com/api/v1'
    : '/api/v1')

function trimBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '')
}

export function getApiClientRuntimeConfig(
  environment: Record<string, string | undefined> = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env ?? {},
): ApiClientRuntimeConfig {
  const configuredBaseUrl = environment.VITE_API_BASE_URL
  return { baseUrl: trimBaseUrl(configuredBaseUrl || DEFAULT_API_BASE_URL) }
}

export interface AgentApiRecord {
  id: string
  userId: string
  name: string
  description: string | null
  status: 'active' | 'idle' | 'paused' | 'error'
  spendingMode: 'observe' | 'guarded'
  budgetLimit: ApiMoney
  planningAccuracy: ApiMoney | null
  totalSpend: ApiMoney
  createdAt: string
  updatedAt: string
}

export interface CostPlanApiRecord {
  id: string
  agentId: string
  taskDescription: string
  network: 'Arc Testnet'
  currency: 'USDC'
  maxBudget: ApiMoney
  estimatedCost: ApiMoney | null
  safetyBuffer: ApiMoney | null
  recommendedBudget: ApiMoney | null
  confidence: ApiMoney | null
  status: 'draft' | 'approved' | 'executing' | 'completed'
  createdAt: string
  updatedAt: string
  items?: CostItemApiRecord[]
}

export interface CostItemApiRecord {
  id: string
  planId: string
  type: string
  label: string
  providerId: string | null
  provider?: string
  unitPrice: ApiMoney
  quantity: ApiMoney
  estimated: ApiMoney
  confidence: ApiMoney | null
  source: 'static' | 'historical' | 'dynamic' | 'estimation'
  createdAt: string
}

export interface TaskEventApiRecord {
  id: string
  taskId?: string
  type: string
  timestamp: string
  cost: ApiMoney | null
  currency?: 'USDC'
  description: string | null
  provider: string | null
  txHash: string | null
  metadata?: Record<string, unknown> | null
  executionMode?: 'simulated' | 'observed' | 'real'
}

export interface TaskApiRecord {
  id: string
  agentId: string
  planId: string | null
  description: string
  network: 'Arc Testnet'
  currency: 'USDC'
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'blocked'
  lifecycleStatus: 'planned' | 'budgeted' | 'executing' | 'tracked' | 'reconciled' | 'failed' | 'blocked'
  budget: ApiMoney
  estimated: ApiMoney | null
  currentSpend: ApiMoney
  reservedSpend?: ApiMoney
  spendingMode: 'observe' | 'guarded'
  result: string | null
  idempotencyKey: string | null
  createdAt: string
  updatedAt: string
  events?: TaskEventApiRecord[]
}

export interface TransactionApiRecord {
  id: string
  taskId: string
  txHash: string | null
  network: 'arc-testnet'
  fromAddress: string | null
  toAddress: string | null
  value: string | null
  currency: 'USDC'
  gasUsdc: string | null
  status: 'pending' | 'success' | 'failed'
  blockNumber: string | null
  confirmedAt: string | null
  createdAt: string
  executionMode: 'simulated' | 'observed' | 'real'
  idempotencyKey: string | null
}

export interface ExecutionApiRecord {
  id?: string
  executionId?: string
  userId?: string
  agentId: string
  taskId: string
  planId: string
  amount: string
  reservedAmount?: string
  currency: 'USDC'
  network: 'arc-testnet'
  destination: string
  mode: 'guarded'
  status?: 'approved' | 'submitted' | 'confirmed' | 'failed' | 'rejected'
  idempotencyKey?: string
  txHash?: string | null
  duplicate?: boolean
  createdAt?: string
  updatedAt?: string
  transaction?: TransactionApiRecord | null
}

export interface ReconciliationApiRecord {
  id?: string
  taskId: string
  estimatedCost: string
  budget: string
  actualCost: string
  variance: string | null
  variancePct: string | null
  items: Record<string, unknown> | null
  completedAt: string
  status: 'pending' | 'completed' | 'failed'
}

export interface ExecutionInput {
  agentId: string
  taskId: string
  planId: string
  amount: string
  destination: string
  idempotencyKey: string
  currency?: 'USDC'
  network?: 'Arc Testnet'
  mode?: 'guarded'
  reason?: string
}

export interface ExactPlanInput {
  agentId: string
  task: string
  network?: 'Arc Testnet'
  currency?: 'USDC'
  maxBudget: string
  safetyMargin: { type: 'fixed' | 'percentage'; value: string }
  items: Array<{
    id: string
    type: string
    label: string
    provider: string
    unitPrice: string
    quantity: string
    confidence: string
    source: 'static' | 'historical' | 'dynamic' | 'estimation'
    currency: 'USDC'
  }>
}

export interface CreateTaskInput {
  description: string
  agentId: string
  network?: 'Arc Testnet'
  currency?: 'USDC'
  budget: string
  estimated?: string
  planId?: string
}

export interface CreateTaskEventInput {
  type: string
  amount?: string
  currency?: 'USDC'
  description?: string
  txHash?: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string
  executionMode?: 'simulated' | 'observed' | 'real'
}

export class CostraApiClient {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly requestFetch: typeof globalThis.fetch
  private readonly useXhr: boolean
  private csrfToken: string | null = null

  constructor(config: ApiClientConfig = {}) {
    const runtime = getApiClientRuntimeConfig()
    this.baseUrl = trimBaseUrl(config.baseUrl ?? runtime.baseUrl)
    this.apiKey = config.apiKey ?? runtime.apiKey
    this.requestFetch = config.fetch ?? globalThis.fetch
    this.useXhr = config.fetch === undefined
      && Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)
      && getBrowserXhrConstructor() !== undefined
  }

  get plans(): Promise<{ plans: CostPlanApiRecord[]; total: number }> {
    return this.get('/plans')
  }

  async getCsrf(): Promise<string> {
    const response = await this.request<{ csrfToken: string }>('/auth/csrf', { method: 'GET' })
    this.csrfToken = response.csrfToken
    return response.csrfToken
  }

  async login(email: string, password: string): Promise<AuthSessionResponse> {
    const response = await this.request<AuthSessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    this.csrfToken = response.csrfToken ?? null
    return response
  }

  async logout(): Promise<void> {
    const csrfToken = this.csrfToken ?? await this.getCsrf()
    this.csrfToken = csrfToken
    await this.request('/auth/logout', { method: 'POST' })
    this.csrfToken = null
  }

  getCurrentUser(): Promise<AuthSessionResponse> {
    return this.get('/auth/me')
  }

  get agents(): Promise<{ agents: AgentApiRecord[]; total: number }> {
    return this.get('/agents')
  }

  getTasks(): Promise<{ tasks: TaskApiRecord[]; total: number }> {
    return this.get('/tasks')
  }

  createExactPlan(input: ExactPlanInput): Promise<CostPlanApiRecord> {
    return this.post('/plans', input)
  }

  updatePlanStatus(id: string, status: 'approved'): Promise<CostPlanApiRecord> {
    return this.request<CostPlanApiRecord>(`/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  createTask(input: CreateTaskInput): Promise<TaskApiRecord> {
    return this.post('/tasks', input)
  }

  recordTaskEvent(taskId: string, input: CreateTaskEventInput): Promise<TaskEventApiRecord> {
    return this.post(`/tasks/${encodeURIComponent(taskId)}/events`, input)
  }

  updateTaskResult(taskId: string, result: string): Promise<TaskApiRecord> {
    return this.request<TaskApiRecord>(`/tasks/${encodeURIComponent(taskId)}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ result }),
    })
  }

  createPublicTask(description: string): Promise<TaskApiRecord> {
    return this.request<TaskApiRecord>('/public/tasks', {
      method: 'POST',
      body: JSON.stringify({ description }),
    })
  }

  getPublicTask(id: string): Promise<TaskApiRecord> {
    return this.get(`/public/tasks/${encodeURIComponent(id)}`)
  }

  getPlan(id: string): Promise<CostPlanApiRecord> {
    return this.get(`/plans/${encodeURIComponent(id)}`)
  }

  getAgent(id: string): Promise<AgentApiRecord> {
    return this.get(`/agents/${encodeURIComponent(id)}`)
  }

  getSpending(query: { from?: string; to?: string; limit?: number; offset?: number } = {}): Promise<{ series: Array<{ date: string; amount: string }>; total: string }> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const suffix = params.toString() ? `?${params.toString()}` : ''
    return this.get(`/spending${suffix}`)
  }

  getTask(id: string): Promise<TaskApiRecord> {
    return this.get(`/tasks/${encodeURIComponent(id)}`)
  }

  getTaskTransactions(taskId: string): Promise<{ transactions: TransactionApiRecord[]; total: number }> {
    return this.get(`/tasks/${encodeURIComponent(taskId)}/transactions`)
  }

  getPlanReconciliation(planId: string): Promise<ReconciliationApiRecord> {
    return this.get(`/plans/${encodeURIComponent(planId)}/reconciliation`)
  }

  execute(input: ExecutionInput): Promise<ExecutionApiRecord> {
    return this.post('/executions', {
      ...input,
      currency: input.currency ?? 'USDC',
      network: input.network ?? 'Arc Testnet',
      mode: input.mode ?? 'guarded',
    })
  }

  getExecution(id: string): Promise<ExecutionApiRecord> {
    return this.get(`/executions/${encodeURIComponent(id)}`)
  }

  trackExecution(id: string): Promise<{ executionId: string; transaction: TransactionApiRecord }> {
    return this.post(`/executions/${encodeURIComponent(id)}/track`, {})
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' })
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body !== undefined) headers.set('Content-Type', 'application/json')
    if (this.apiKey) headers.set('Authorization', `Bearer ${this.apiKey}`)
    const method = (init.method ?? 'GET').toUpperCase()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) {
      headers.set('X-CSRF-Token', this.csrfToken)
    }

    const response = this.useXhr
      ? await this.requestWithXhr(`${this.baseUrl}${path}`, init, headers)
      : await this.requestWithFetch(`${this.baseUrl}${path}`, init, headers)

    if (response.status < 200 || response.status >= 300) {
      const errorPayload = isApiErrorPayload(response.payload)
        ? response.payload
        : { error: 'unavailable', message: 'COSTRA API returned an invalid error response.' }
      throw new ApiClientError({
        status: response.status,
        code: errorPayload.error,
        message: errorPayload.message,
        requestId: errorPayload.requestId ?? response.requestId,
      })
    }

    return response.payload as T
  }

  private async requestWithFetch(url: string, init: RequestInit, headers: Headers): Promise<RawApiResponse> {
    let response: Response
    try {
      response = await this.requestFetch(url, { ...init, headers, credentials: 'include' })
    } catch {
      throw new ApiClientError({
        status: 0,
        code: 'unavailable',
        message: 'COSTRA API is unavailable.',
        requestId: null,
      })
    }

    return {
      status: response.status,
      requestId: response.headers.get('x-request-id'),
      payload: await response.json().catch(() => null) as unknown,
    }
  }

  private requestWithXhr(url: string, init: RequestInit, headers: Headers): Promise<RawApiResponse> {
    return new Promise((resolve, reject) => {
      const Xhr = getBrowserXhrConstructor()
      if (!Xhr) {
        reject(new ApiClientError({
          status: 0,
          code: 'unavailable',
          message: 'COSTRA API is unavailable.',
          requestId: null,
        }))
        return
      }
      const xhr = new Xhr()
      xhr.open(init.method ?? 'GET', url, true)
      xhr.withCredentials = true
      headers.forEach((value, key) => xhr.setRequestHeader(key, value))
      xhr.onload = () => {
        let payload: unknown = null
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) as unknown : null
        } catch {
          payload = null
        }
        resolve({
          status: xhr.status,
          requestId: xhr.getResponseHeader('x-request-id'),
          payload,
        })
      }
      xhr.onerror = () => reject(new ApiClientError({
        status: 0,
        code: 'unavailable',
        message: 'COSTRA API is unavailable.',
        requestId: null,
      }))
      xhr.ontimeout = xhr.onerror
      xhr.send(init.body === undefined ? null : init.body)
    })
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).error === 'string'
    && typeof (value as Record<string, unknown>).message === 'string'
}

export const costraApi = new CostraApiClient()
