/**
 * Exact USDC money arithmetic for domain and persistence boundaries.
 *
 * Values are represented as integer micro-USDC units. JavaScript numbers are
 * intentionally not accepted as authoritative monetary input.
 */

export const USDC_SCALE = 6
const UNIT = 10n ** BigInt(USDC_SCALE)
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/

export type MoneyRounding = 'reject' | 'half-up'

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

function productToUnits(left: { units: bigint; scale: number }, right: { units: bigint; scale: number }, rounding: MoneyRounding): bigint {
  const denominator = 10n ** BigInt(left.scale + right.scale)
  const numerator = left.units * right.units * UNIT
  const quotient = numerator / denominator
  const remainder = numerator % denominator

  if (remainder !== 0n && rounding === 'reject') {
    throw new MoneyError('Multiplication result exceeds USDC precision.')
  }

  const absoluteRemainder = remainder < 0n ? -remainder : remainder
  const rounded = rounding === 'half-up' && absoluteRemainder * 2n >= denominator
    ? quotient + (numerator < 0n ? -1n : 1n)
    : quotient

  return rounded
}

function divideToUnits(numerator: bigint, denominator: bigint, rounding: MoneyRounding): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  if (remainder !== 0n && rounding === 'reject') {
    throw new MoneyError('Division result exceeds USDC precision.')
  }
  const absoluteRemainder = remainder < 0n ? -remainder : remainder
  return rounding === 'half-up' && absoluteRemainder * 2n >= denominator
    ? quotient + (numerator < 0n ? -1n : 1n)
    : quotient
}

function parseScaled(value: string, allowNegative: boolean, maxScale: number): { units: bigint; scale: number } {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    throw new MoneyError('Money must be a decimal string without exponent notation.')
  }

  const negative = value.startsWith('-')
  if (negative && !allowNegative) {
    throw new MoneyError('Money must not be negative.')
  }

  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction = ''] = unsigned.split('.')
  if (fraction.length > maxScale) {
    throw new MoneyError(`Money supports no more than ${maxScale} decimal places.`)
  }

  const units = BigInt(whole) * (10n ** BigInt(fraction.length)) + BigInt(fraction || '0')
  return { units: negative ? -units : units, scale: fraction.length }
}

function formatUnits(units: bigint): string {
  const negative = units < 0n
  const absolute = negative ? -units : units
  const whole = absolute / UNIT
  const fraction = (absolute % UNIT).toString().padStart(USDC_SCALE, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export class Money {
  private constructor(private readonly units: bigint) {}

  static zero(): Money {
    return new Money(0n)
  }

  static from(value: string, options: { allowNegative?: boolean } = {}): Money {
    const parsed = parseScaled(value, options.allowNegative ?? false, USDC_SCALE)
    return new Money(parsed.units * (10n ** BigInt(USDC_SCALE - parsed.scale)))
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce((total, value) => total.add(value), Money.zero())
  }

  static multiplyDecimal(left: string, right: string, rounding: MoneyRounding = 'half-up'): Money {
    return new Money(productToUnits(parseScaled(left, false, 18), parseScaled(right, false, 18), rounding))
  }

  static percentage(value: Money, percentage: string, rounding: MoneyRounding = 'half-up'): Money {
    const parsed = parseScaled(percentage, false, 6)
    return new Money(divideToUnits(value.units * parsed.units, 10n ** BigInt(parsed.scale) * 100n, rounding))
  }

  static percentOf(part: Money, whole: Money, decimals = 2): string {
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 6) throw new MoneyError('Invalid percentage precision.')
    if (whole.units === 0n) return '0'.padEnd(decimals ? decimals + 2 : 1, '0')
    const scale = 10n ** BigInt(decimals)
    const numerator = part.units * 100n * scale
    const denominator = whole.units
    let quotient = numerator / denominator
    const remainder = numerator % denominator
    const absoluteRemainder = remainder < 0n ? -remainder : remainder
    const absoluteDenominator = denominator < 0n ? -denominator : denominator
    if (absoluteRemainder * 2n >= absoluteDenominator) quotient += numerator < 0n ? -1n : 1n
    const negative = quotient < 0n
    const absolute = negative ? -quotient : quotient
    const wholePart = absolute / scale
    const fraction = decimals ? `.${(absolute % scale).toString().padStart(decimals, '0')}` : ''
    return `${negative ? '-' : ''}${wholePart}${fraction}`
  }

  add(other: Money): Money {
    return new Money(this.units + other.units)
  }

  subtract(other: Money): Money {
    return new Money(this.units - other.units)
  }

  multiply(multiplier: string, rounding: MoneyRounding = 'reject'): Money {
    const parsed = parseScaled(multiplier, true, 18)
    return new Money(productToUnits({ units: this.units, scale: USDC_SCALE }, parsed, rounding))
  }

  divideInteger(divisor: number, rounding: MoneyRounding = 'reject'): Money {
    if (!Number.isSafeInteger(divisor) || divisor <= 0) throw new MoneyError('Divisor must be a positive safe integer.')
    return new Money(divideToUnits(this.units, BigInt(divisor), rounding))
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.units < other.units) return -1
    if (this.units > other.units) return 1
    return 0
  }

  isZero(): boolean {
    return this.units === 0n
  }

  toString(): string {
    return formatUnits(this.units)
  }
}
