import { describe, expect, test } from 'bun:test'
import { decodeFunctionData } from 'viem'
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_NATIVE_GAS_DECIMALS,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_USDC_DECIMALS,
  ArcAdapter,
  ArcAdapterConfigurationError,
  readArcTestnetExecutionConfig,
} from '../src/lib/arc-adapter'

describe('Phase 4.2 Arc Testnet adapter', () => {
  test('requires explicit Arc Testnet RPC, chain, and testnet key configuration', () => {
    expect(() => readArcTestnetExecutionConfig({})).toThrow(ArcAdapterConfigurationError)
    expect(() => readArcTestnetExecutionConfig({
      ARC_TESTNET_RPC_URL: 'https://rpc.example.test',
      ARC_TESTNET_CHAIN_ID: '5042',
      ARC_TESTNET_EXECUTION_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    })).toThrow('ARC_TESTNET_CHAIN_ID must be 5042002')

    const config = readArcTestnetExecutionConfig({
      ARC_TESTNET_RPC_URL: 'https://rpc.example.test',
      ARC_TESTNET_CHAIN_ID: String(ARC_TESTNET_CHAIN_ID),
      ARC_TESTNET_EXECUTION_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    })
    expect(config.chainId).toBe(ARC_TESTNET_CHAIN_ID)
    expect(config.rpcUrl).toBe('https://rpc.example.test')
  })

  test('keeps Arc ERC-20 USDC and native gas units explicit', () => {
    const adapter = new ArcAdapter()
    expect(adapter.chainId).toBe(ARC_TESTNET_CHAIN_ID)
    expect(adapter.usdcAddress).toBe(ARC_TESTNET_USDC_ADDRESS)
    expect(adapter.usdcDecimals).toBe(ARC_TESTNET_USDC_DECIMALS)
    expect(adapter.nativeGasDecimals).toBe(ARC_TESTNET_NATIVE_GAS_DECIMALS)
  })

  test('builds an exact ERC-20 USDC transfer without submitting it', () => {
    const adapter = new ArcAdapter()
    const destination = `0x${'b'.repeat(40)}`
    const transfer = adapter.prepareUsdcTransfer({ destination, amount: '0.400000' })
    const decoded = decodeFunctionData({ abi: [{
      name: 'transfer', type: 'function', stateMutability: 'nonpayable',
      inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: [{ name: 'success', type: 'bool' }],
    }] as const, data: transfer.data })

    expect(transfer.chainId).toBe(ARC_TESTNET_CHAIN_ID)
    expect(transfer.token).toBe(ARC_TESTNET_USDC_ADDRESS)
    expect(transfer.amountBaseUnits).toBe(400000n)
    expect(transfer.value).toBe(0n)
    expect(decoded.functionName).toBe('transfer')
    expect(String(decoded.args?.[0]).toLowerCase()).toBe(destination.toLowerCase())
    expect(decoded.args?.[1]).toBe(400000n)
  })

  test('rejects invalid transfer input and never silently falls back to simulation', async () => {
    const adapter = new ArcAdapter()
    expect(() => adapter.prepareUsdcTransfer({ destination: '0x1234', amount: '1' })).toThrow(ArcAdapterConfigurationError)
    expect(() => adapter.prepareUsdcTransfer({ destination: `0x${'b'.repeat(40)}`, amount: '0' })).toThrow(ArcAdapterConfigurationError)
    await expect(adapter.submitUsdcTransfer({ destination: `0x${'b'.repeat(40)}`, amount: '1' })).rejects.toThrow(ArcAdapterConfigurationError)
  })
})
