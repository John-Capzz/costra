export type CostraEnvironment = 'development' | 'test' | 'staging' | 'production'

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeConfigurationError'
  }
}

export interface RuntimeEnvironment {
  COSTRA_ENV?: string
  PORT?: string
  CORS_ORIGIN?: string
  DATABASE_URL?: string
  PGHOST?: string
  PGPORT?: string
  PGDATABASE?: string
  PGUSER?: string
  PGPASSWORD?: string
  ARC_TESTNET_RPC_URL?: string
  ARC_TESTNET_CHAIN_ID?: string
  ARC_TESTNET_EXECUTION_PRIVATE_KEY?: string
  ARC_TESTNET_EXECUTION_ADDRESS?: string
}

export interface RuntimeConfig {
  environment: CostraEnvironment
  port: number
  corsOrigin: string
  requiresDatabase: boolean
  requiresArcExecution: boolean
}

const ENVIRONMENTS: readonly CostraEnvironment[] = ['development', 'test', 'staging', 'production']

function required(environment: RuntimeEnvironment, name: keyof RuntimeEnvironment): string {
  const value = environment[name]?.trim()
  if (!value) throw new RuntimeConfigurationError(`Missing required runtime configuration: ${name}.`)
  return value
}

function validatePort(value: string | undefined): number {
  const port = value === undefined ? 3001 : Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RuntimeConfigurationError('PORT must be an integer between 1 and 65535.')
  }
  return port
}

function validateDatabase(environment: RuntimeEnvironment): void {
  const hasUrl = Boolean(environment.DATABASE_URL?.trim())
  const hasFields = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']
    .every((name) => Boolean(environment[name as keyof RuntimeEnvironment]?.trim()))
  if (!hasUrl && !hasFields) {
    throw new RuntimeConfigurationError('A staging database connection is required via DATABASE_URL or PG* variables.')
  }
}

function validateArcExecution(environment: RuntimeEnvironment): void {
  const rpcUrl = required(environment, 'ARC_TESTNET_RPC_URL')
  try {
    const parsed = new URL(rpcUrl)
    if (parsed.protocol !== 'https:') throw new Error('protocol')
  } catch {
    throw new RuntimeConfigurationError('ARC_TESTNET_RPC_URL must be a valid HTTPS URL.')
  }

  if (required(environment, 'ARC_TESTNET_CHAIN_ID') !== '5042002') {
    throw new RuntimeConfigurationError('ARC_TESTNET_CHAIN_ID must be 5042002.')
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(required(environment, 'ARC_TESTNET_EXECUTION_PRIVATE_KEY'))) {
    throw new RuntimeConfigurationError('ARC_TESTNET_EXECUTION_PRIVATE_KEY must be a configured Arc Testnet key.')
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(required(environment, 'ARC_TESTNET_EXECUTION_ADDRESS'))) {
    throw new RuntimeConfigurationError('ARC_TESTNET_EXECUTION_ADDRESS must be a valid EVM address.')
  }
}

export function readRuntimeConfig(environment: RuntimeEnvironment = process.env): RuntimeConfig {
  const requested = (environment.COSTRA_ENV?.trim() || 'development') as CostraEnvironment
  if (!ENVIRONMENTS.includes(requested)) {
    throw new RuntimeConfigurationError('COSTRA_ENV must be development, test, staging, or production.')
  }

  const requiresStagingConfiguration = requested === 'staging' || requested === 'production'
  if (requiresStagingConfiguration) {
    validateDatabase(environment)
    const corsOrigin = required(environment, 'CORS_ORIGIN')
    if (corsOrigin === '*') throw new RuntimeConfigurationError('CORS_ORIGIN cannot be wildcard in staging or production.')
    validateArcExecution(environment)
    return {
      environment: requested,
      port: validatePort(environment.PORT),
      corsOrigin,
      requiresDatabase: true,
      requiresArcExecution: true,
    }
  }

  return {
    environment: requested,
    port: validatePort(environment.PORT),
    corsOrigin: environment.CORS_ORIGIN?.trim() || 'http://localhost:5173',
    requiresDatabase: false,
    requiresArcExecution: false,
  }
}
