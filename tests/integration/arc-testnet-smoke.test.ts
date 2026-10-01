import { describe, expect, test } from 'bun:test'
import { createPublicClient, decodeEventLog, http, parseUnits } from 'viem'
import { arcTestnet } from 'viem/chains'
import { ArcAdapter, ARC_TESTNET_USDC_ADDRESS, readArcTestnetExecutionConfig } from '../../src/lib/arc-adapter'

const TRANSFER_EVENT_ABI = [{
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ],
  anonymous: false,
}] as const

const enabled = process.env.RUN_ARC_TESTNET_SMOKE === 'true'
  && Boolean(process.env.ARC_TESTNET_RPC_URL)
  && Boolean(process.env.ARC_TESTNET_EXECUTION_PRIVATE_KEY)
  && Boolean(process.env.ARC_TESTNET_SMOKE_DESTINATION)
  && Boolean(process.env.ARC_TESTNET_SMOKE_AMOUNT)

const smoke = enabled ? describe : describe.skip

smoke('opt-in Arc Testnet live smoke test', () => {
  test('submits and retrieves one explicitly requested testnet transfer', async () => {
    const adapter = new ArcAdapter(readArcTestnetExecutionConfig())
    const config = readArcTestnetExecutionConfig()
    const destination = process.env.ARC_TESTNET_SMOKE_DESTINATION as string
    const amount = process.env.ARC_TESTNET_SMOKE_AMOUNT as string
    const hash = await adapter.submitUsdcTransfer({ destination, amount })
    const receipt = await adapter.getReceipt(hash)
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) })
    const rawReceipt = await publicClient.getTransactionReceipt({ hash })
    const expectedAmount = parseUnits(amount, 6)
    const matchingTransfer = rawReceipt.logs.find((log) => {
      if (log.address.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) return false
      try {
        const decoded = decodeEventLog({ abi: TRANSFER_EVENT_ABI, data: log.data, topics: log.topics })
        return decoded.eventName === 'Transfer'
          && decoded.args.to.toLowerCase() === destination.toLowerCase()
          && decoded.args.value === expectedAmount
      } catch {
        return false
      }
    })

    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(receipt.hash).toBe(hash)
    expect(receipt.status).toBe('success')
    expect(matchingTransfer).toBeDefined()
    expect(matchingTransfer?.address.toLowerCase()).toBe(ARC_TESTNET_USDC_ADDRESS.toLowerCase())
  }, 120_000)
})
