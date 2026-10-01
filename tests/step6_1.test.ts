import { describe, expect, test } from 'bun:test'
import { readRuntimeConfig, RuntimeConfigurationError } from '../server/runtime-config'

const baseStaging = {
  COSTRA_ENV: 'staging',
  DATABASE_URL: 'postgresql://staging:secret@example.test/costra',
  CORS_ORIGIN: 'https://staging.example.com',
  ARC_TESTNET_RPC_URL: 'https://rpc.example.test',
  ARC_TESTNET_CHAIN_ID: '5042002',
  ARC_TESTNET_EXECUTION_PRIVATE_KEY: `0x${'a'.repeat(64)}`,
  ARC_TESTNET_EXECUTION_ADDRESS: `0x${'b'.repeat(40)}`,
}

describe('Phase 6.1 staging runtime configuration', () => {
  test('accepts a complete staging configuration without exposing values', () => {
    expect(readRuntimeConfig(baseStaging)).toEqual({
      environment: 'staging',
      port: 3001,
      corsOrigin: 'https://staging.example.com',
      requiresDatabase: true,
      requiresArcExecution: true,
    })
  })

  test('preserves lightweight development startup behavior', () => {
    expect(readRuntimeConfig({ COSTRA_ENV: 'development' }).requiresDatabase).toBe(false)
  })

  test('fails safely when staging configuration is incomplete', () => {
    expect(() => readRuntimeConfig({ COSTRA_ENV: 'staging' })).toThrow(RuntimeConfigurationError)
    expect(() => readRuntimeConfig({ ...baseStaging, DATABASE_URL: undefined })).toThrow('database connection')
  })

  test('rejects unsafe staging capability configuration', () => {
    expect(() => readRuntimeConfig({ ...baseStaging, CORS_ORIGIN: '*' })).toThrow('wildcard')
    expect(() => readRuntimeConfig({ ...baseStaging, ARC_TESTNET_CHAIN_ID: '1' })).toThrow('5042002')
    expect(() => readRuntimeConfig({ ...baseStaging, ARC_TESTNET_RPC_URL: 'http://rpc.example.test' })).toThrow('HTTPS')
  })
})
