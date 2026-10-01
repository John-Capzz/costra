import { describe, expect, test } from 'bun:test'
import { privateKeyToAccount } from 'viem/accounts'
import { ArcAdapterConfigurationError, readArcTestnetExecutionConfig } from '../src/lib/arc-adapter'

const privateKey = `0x${'1'.repeat(64)}` as `0x${string}`
const address = privateKeyToAccount(privateKey).address

describe('Phase 6.4 controlled wallet boundary', () => {
  test('requires HTTPS Arc RPC and validates the configured signer address', () => {
    const config = readArcTestnetExecutionConfig({
      ARC_TESTNET_RPC_URL: 'https://rpc.example.test',
      ARC_TESTNET_CHAIN_ID: '5042002',
      ARC_TESTNET_EXECUTION_PRIVATE_KEY: privateKey,
      ARC_TESTNET_EXECUTION_ADDRESS: address,
    })
    expect(config.executionAddress).toBe(address)
    expect(() => readArcTestnetExecutionConfig({
      ARC_TESTNET_RPC_URL: 'http://rpc.example.test',
      ARC_TESTNET_CHAIN_ID: '5042002',
      ARC_TESTNET_EXECUTION_PRIVATE_KEY: privateKey,
      ARC_TESTNET_EXECUTION_ADDRESS: address,
    })).toThrow(ArcAdapterConfigurationError)
  })

  test('rejects a signer/address mismatch before any RPC call', () => {
    expect(() => readArcTestnetExecutionConfig({
      ARC_TESTNET_RPC_URL: 'https://rpc.example.test',
      ARC_TESTNET_CHAIN_ID: '5042002',
      ARC_TESTNET_EXECUTION_PRIVATE_KEY: privateKey,
      ARC_TESTNET_EXECUTION_ADDRESS: `0x${'2'.repeat(40)}`,
    })).toThrow('does not match')
  })
})
