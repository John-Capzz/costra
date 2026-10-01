// ============================================================
// COSTRA — Arc Chain Adapter
//
// Arc Testnet is the only active adapter in V1. The legacy planning
// methods remain simulation-only; explicit execution methods below are
// configuration-gated and never fall back to simulation.
// ============================================================

import type { Task } from '@/types'
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseUnits, type Address, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '../onchain-facts'
import { Money, MoneyError } from './money'

export const ARC_TESTNET_CHAIN_ID = 5042002 as const
export const ARC_TESTNET_USDC_DECIMALS = 6 as const
export const ARC_TESTNET_NATIVE_GAS_DECIMALS = 18 as const
export const ARC_TESTNET_USDC_ADDRESS = getUsdc(ARC_TESTNET_CHAIN_ID)?.address as Address

const ERC20_TRANSFER_ABI = [{
  name: 'transfer', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: 'success', type: 'bool' }],
}] as const

export class ArcAdapterConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArcAdapterConfigurationError'
  }
}

export interface ArcTestnetExecutionConfig {
  rpcUrl: string
  chainId: typeof ARC_TESTNET_CHAIN_ID
  executionPrivateKey: `0x${string}`
  executionAddress: Address
}

export interface ArcTestnetEnvironment {
  ARC_TESTNET_RPC_URL?: string
  ARC_TESTNET_CHAIN_ID?: string
  ARC_TESTNET_EXECUTION_PRIVATE_KEY?: string
  ARC_TESTNET_EXECUTION_ADDRESS?: string
}

export function readArcTestnetExecutionConfig(
  environment: ArcTestnetEnvironment = process.env,
): ArcTestnetExecutionConfig {
  const rpcUrl = environment.ARC_TESTNET_RPC_URL?.trim()
  const configuredChainId = environment.ARC_TESTNET_CHAIN_ID?.trim()
  const privateKey = environment.ARC_TESTNET_EXECUTION_PRIVATE_KEY?.trim()
  const expectedAddress = environment.ARC_TESTNET_EXECUTION_ADDRESS?.trim()

  if (!rpcUrl) throw new ArcAdapterConfigurationError('ARC_TESTNET_RPC_URL is required for Arc execution.')
  try {
    if (new URL(rpcUrl).protocol !== 'https:') throw new Error('protocol')
  } catch {
    throw new ArcAdapterConfigurationError('ARC_TESTNET_RPC_URL must be a valid HTTPS URL.')
  }
  if (configuredChainId !== undefined && configuredChainId !== String(ARC_TESTNET_CHAIN_ID)) {
    throw new ArcAdapterConfigurationError('ARC_TESTNET_CHAIN_ID must be 5042002.')
  }
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new ArcAdapterConfigurationError('ARC_TESTNET_EXECUTION_PRIVATE_KEY must be a configured testnet key.')
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  if (expectedAddress && expectedAddress.toLowerCase() !== account.address.toLowerCase()) {
    throw new ArcAdapterConfigurationError('ARC_TESTNET_EXECUTION_ADDRESS does not match the configured execution key.')
  }

  return {
    rpcUrl,
    chainId: ARC_TESTNET_CHAIN_ID,
    executionPrivateKey: privateKey as `0x${string}`,
    executionAddress: account.address,
  }
}

export interface UsdcTransferRequest {
  destination: string
  amount: string
}

export interface PreparedUsdcTransfer {
  chainId: typeof ARC_TESTNET_CHAIN_ID
  token: Address
  tokenDecimals: typeof ARC_TESTNET_USDC_DECIMALS
  destination: Address
  amount: string
  amountBaseUnits: bigint
  data: `0x${string}`
  value: bigint
}

export interface ArcTransactionReceipt {
  hash: Hash
  status: 'success' | 'failed'
  blockNumber: string
  gasUsed: string
  effectiveGasPrice: string
  feeUsdc: string
}

export function nativeGasUnitsToUsdc(nativeUnits: bigint): string {
  const divisor = 10n ** 12n
  const whole = nativeUnits / divisor
  const remainder = nativeUnits % divisor
  const roundedWhole = remainder * 2n >= divisor ? whole + 1n : whole
  return `${roundedWhole / 1_000_000n}.${(roundedWhole % 1_000_000n).toString().padStart(6, '0')}`
}

export interface TransactionCostEstimate {
  estimatedCost: string
  currency: string
  unit: 'USDC'
  confidence: number
  note: string
}

export interface TransactionRecord {
  hash: string
  network: string
  from?: string
  to?: string
  value: string
  currency: string
  status: 'pending' | 'success' | 'failed'
  timestamp: string
  gasUsedUSDC: string
}

export interface BalanceResult {
  address: string
  amount: string
  currency: 'USDC'
  network: string
  source: 'simulated' | 'live'
}

export interface ChainAdapter {
  name: string
  chainId: number
  currency: 'USDC'
  estimateTransactionCost(options?: {
    complexity?: 'simple' | 'moderate' | 'complex'
    calldata?: string
  }): TransactionCostEstimate | Promise<TransactionCostEstimate>
  getTransaction(hash: string): TransactionRecord | null | Promise<TransactionRecord | null>
  getBalance(address: string): BalanceResult | Promise<BalanceResult>
  trackTransaction(task: Task, hash: string): void | Promise<void>
  isValidAddress(address: string): boolean
}

export class ArcAdapter implements ChainAdapter {
  readonly name = 'Arc Testnet'
  readonly chainId = ARC_TESTNET_CHAIN_ID
  readonly currency = 'USDC' as const
  readonly usdcAddress = ARC_TESTNET_USDC_ADDRESS
  readonly usdcDecimals = ARC_TESTNET_USDC_DECIMALS
  readonly nativeGasDecimals = ARC_TESTNET_NATIVE_GAS_DECIMALS

  constructor(private readonly executionConfig?: ArcTestnetExecutionConfig) {}

  private readonly baseFeeUSDC = '0.006000'

  estimateTransactionCost(options: {
    complexity?: 'simple' | 'moderate' | 'complex'
    calldata?: string
  } = {}): TransactionCostEstimate {
    const multiplier = options.complexity === 'complex' ? '2.5' : options.complexity === 'moderate' ? '1.5' : '1'
    return {
      estimatedCost: Money.multiplyDecimal(this.baseFeeUSDC, multiplier, 'half-up').toString(),
      currency: 'USDC',
      unit: 'USDC',
      confidence: 0.94,
      note: 'Simulated Arc Testnet estimate; live fee and finality reads are deferred.',
    }
  }

  getTransaction(_hash: string): TransactionRecord | null {
    return null
  }

  getBalance(address: string): BalanceResult {
    return { address, amount: '0.000000', currency: 'USDC', network: this.name, source: 'simulated' }
  }

  trackTransaction(task: Task, hash: string): void {
    console.info(`[ArcAdapter] Simulated tracking only; no live receipt lookup for tx ${hash} on task ${task.id}`)
  }

  isValidAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address)
  }

  prepareUsdcTransfer(request: UsdcTransferRequest): PreparedUsdcTransfer {
    if (!this.isValidAddress(request.destination)) {
      throw new ArcAdapterConfigurationError('USDC destination must be a valid EVM address.')
    }
    let amountBaseUnits: bigint
    let normalizedAmount: string
    try {
      const amount = Money.from(request.amount)
      if (amount.isZero()) throw new ArcAdapterConfigurationError('USDC amount must be greater than zero.')
      normalizedAmount = amount.toString()
      amountBaseUnits = parseUnits(normalizedAmount, ARC_TESTNET_USDC_DECIMALS)
    } catch (error) {
      if (error instanceof ArcAdapterConfigurationError) throw error
      if (error instanceof MoneyError) throw new ArcAdapterConfigurationError(`USDC amount: ${error.message}`)
      throw error
    }

    return {
      chainId: ARC_TESTNET_CHAIN_ID,
      token: this.usdcAddress,
      tokenDecimals: ARC_TESTNET_USDC_DECIMALS,
      destination: request.destination as Address,
      amount: normalizedAmount,
      amountBaseUnits,
      data: encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: 'transfer', args: [request.destination as Address, amountBaseUnits] }),
      // Native Arc gas uses 18-decimal USDC; it is intentionally not mixed
      // into this 6-decimal ERC-20 transfer amount.
      value: 0n,
    }
  }

  private requireExecutionConfig(): ArcTestnetExecutionConfig {
    if (!this.executionConfig) throw new ArcAdapterConfigurationError('Arc execution is not configured.')
    return this.executionConfig
  }

  getExecutionAddress(): Address {
    return this.requireExecutionConfig().executionAddress
  }

  executionFeeReserveUsdc(): string {
    return '0.006000'
  }

  private async assertConnectedChain(client: { getChainId: () => Promise<number> }): Promise<void> {
    if (await client.getChainId() !== ARC_TESTNET_CHAIN_ID) {
      throw new ArcAdapterConfigurationError('Connected RPC is not Arc Testnet.')
    }
  }

  async submitUsdcTransfer(request: UsdcTransferRequest): Promise<Hash> {
    const config = this.requireExecutionConfig()
    const prepared = this.prepareUsdcTransfer(request)
    const account = privateKeyToAccount(config.executionPrivateKey)
    if (account.address.toLowerCase() !== config.executionAddress.toLowerCase()) {
      throw new ArcAdapterConfigurationError('The runtime execution identity does not match its configured address.')
    }
    const client = createWalletClient({ account, chain: arcTestnet, transport: http(config.rpcUrl) })
    await this.assertConnectedChain(client)
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) })
    await this.assertConnectedChain(publicClient)
    const bytecode = await publicClient.getBytecode({ address: prepared.token })
    if (!bytecode || bytecode === '0x') {
      throw new ArcAdapterConfigurationError('The configured Arc Testnet USDC contract was not found.')
    }
    return client.writeContract({
      address: prepared.token,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [prepared.destination, prepared.amountBaseUnits],
      chain: arcTestnet,
      account,
    })
  }

  async getReceipt(hash: Hash): Promise<ArcTransactionReceipt> {
    const config = this.requireExecutionConfig()
    const client = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) })
    await this.assertConnectedChain(client)
    const receipt = await client.waitForTransactionReceipt({ hash })
    const feeNativeUnits = receipt.gasUsed * receipt.effectiveGasPrice
    return {
      hash: receipt.transactionHash,
      status: receipt.status === 'success' ? 'success' : 'failed',
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      feeUsdc: nativeGasUnitsToUsdc(feeNativeUnits),
    }
  }
}

const adapters: Record<string, ChainAdapter> = { 'arc-testnet': new ArcAdapter() }

export function getAdapter(network: string): ChainAdapter | undefined {
  return adapters[network.toLowerCase().replace(' ', '-')]
}

export function registerAdapter(key: string, adapter: ChainAdapter): void {
  adapters[key] = adapter
}
