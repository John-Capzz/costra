// ============================================================
// COSTRA — Arc Chain Adapter
//
// ARCHITECTURE: ChainAdapter interface + ArcAdapter implementation.
// Additional chains (Ethereum, Base, Arbitrum…) add their own
// adapter without touching COSTRA core logic.
//
// NOTE: This file contains the interface + a testnet-safe
// simulation layer. Live Arc RPC calls are made via viem
// from the frontend — see onchain-facts / wagmi patterns.
// ============================================================

import type { Task } from '@/types'

// ---- ChainAdapter interface --------------------------------

export interface TransactionCostEstimate {
  estimatedCost: number
  currency:      string
  unit:          'USDC'
  confidence:    number
  note:          string
}

export interface TransactionRecord {
  hash:      string
  network:   string
  from?:     string
  to?:       string
  value:     number
  currency:  string
  status:    'pending' | 'success' | 'failed'
  timestamp: string
  gasUsedUSDC: number
}

export interface BalanceResult {
  address:  string
  amount:   number
  currency: 'USDC'
  network:  string
  source:   'demo' | 'live'
}

export interface ChainAdapter {
  name:          string
  chainId:       number
  currency:      'USDC'

  estimateTransactionCost(options?: {
    complexity?: 'simple' | 'moderate' | 'complex'
    calldata?:   string
  }): TransactionCostEstimate | Promise<TransactionCostEstimate>

  getTransaction(hash: string): TransactionRecord | null | Promise<TransactionRecord | null>

  getBalance(address: string): BalanceResult | Promise<BalanceResult>

  trackTransaction(task: Task, hash: string): void | Promise<void>

  isValidAddress(address: string): boolean
}

// ---- ArcAdapter (testnet) ----------------------------------

export class ArcAdapter implements ChainAdapter {
  readonly name      = 'Arc Testnet'
  readonly chainId   = 5042002
  readonly currency  = 'USDC' as const

  // Flat fee model: Arc gas is priced in USDC, extremely
  // predictable. Real implementation reads from Arc RPC.
  private readonly baseFeeUSDC = 0.006

  estimateTransactionCost(options: {
    complexity?: 'simple' | 'moderate' | 'complex'
    calldata?:   string
  } = {}): TransactionCostEstimate {
    const multiplier =
      options.complexity === 'complex'  ? 2.5 :
      options.complexity === 'moderate' ? 1.5 : 1.0

    return {
      estimatedCost: +(this.baseFeeUSDC * multiplier).toFixed(6),
      currency:      'USDC',
      unit:          'USDC',
      confidence:    0.94,
      note:          'Arc native gas is USDC. Flat fee model, sub-second finality.',
    }
  }

  getTransaction(hash: string): TransactionRecord | null {
    // In production: viem publicClient.getTransaction(hash)
    // Returning null means "not found" — callers handle gracefully.
    if (!this.isValidAddress(hash)) return null
    return {
      hash,
      network:     this.name,
      value:       0,
      currency:    'USDC',
      status:      'success',
      timestamp:   new Date().toISOString(),
      gasUsedUSDC: this.baseFeeUSDC,
    }
  }

  getBalance(address: string): BalanceResult {
    // In production: useReadContract with erc20Abi balanceOf
    // at USDC address from @/onchain-facts getUsdc(5042002)
    return {
      address,
      amount:   0,
      currency: 'USDC',
      network:  this.name,
      source:   'demo',
    }
  }

  trackTransaction(task: Task, hash: string): void {
    // In production: poll viem publicClient.waitForTransactionReceipt
    // and append an ARC_TRANSACTION event to the task via the API.
    console.info(`[ArcAdapter] Tracking tx ${hash} for task ${task.id}`)
  }

  isValidAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40,64}$/.test(address)
  }
}

// ---- Arc Mainnet Adapter ----------------------------------

export class ArcMainnetAdapter implements ChainAdapter {
  readonly name     = 'Arc Mainnet' as const
  readonly chainId  = 5042 as number
  readonly currency = 'USDC' as const
  private readonly base = new ArcAdapter()

  estimateTransactionCost(options?: Parameters<ArcAdapter['estimateTransactionCost']>[0]): TransactionCostEstimate {
    return this.base.estimateTransactionCost(options ?? {})
  }
  getTransaction(hash: string): TransactionRecord | null { return this.base.getTransaction(hash) }
  getBalance(address: string): BalanceResult             { return this.base.getBalance(address)  }
  trackTransaction(task: Task, hash: string): void       { this.base.trackTransaction(task, hash) }
  isValidAddress(address: string): boolean               { return this.base.isValidAddress(address) }
}

// ---- Adapter registry -------------------------------------

const adapters: Record<string, ChainAdapter> = {
  'arc-testnet': new ArcAdapter(),
  'arc':         new ArcMainnetAdapter(),
}

export function getAdapter(network: string): ChainAdapter | undefined {
  return adapters[network.toLowerCase().replace(' ', '-')]
}

export function registerAdapter(key: string, adapter: ChainAdapter): void {
  adapters[key] = adapter
}
