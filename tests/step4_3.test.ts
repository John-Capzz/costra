import { describe, expect, test } from 'bun:test'
import { nativeGasUnitsToUsdc } from '../src/lib/arc-adapter'

describe('Phase 4.3 Arc execution accounting', () => {
  test('converts native 18-decimal gas units to 6-decimal USDC explicitly', () => {
    expect(nativeGasUnitsToUsdc(1_000_000_000_000n)).toBe('0.000001')
    expect(nativeGasUnitsToUsdc(1_500_000_000_000n)).toBe('0.000002')
    expect(nativeGasUnitsToUsdc(2_000_000_000_000_000n)).toBe('0.002000')
  })

  test('does not execute a live transaction in the accounting tests', () => {
    expect(nativeGasUnitsToUsdc(0n)).toBe('0.000000')
  })
})
