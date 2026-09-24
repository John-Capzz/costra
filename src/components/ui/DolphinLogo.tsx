// ============================================================
// COSTRA — Dolphin Logo (geometric / abstract mark)
// Refined, minimal — NOT cartoon.
// ============================================================

import { cn } from '@/lib/utils'

interface DolphinMarkProps {
  size?:      number
  className?: string
  color?:     string
}

/**
 * Pure SVG dolphin mark — reusable at any scale.
 * Uses a geometric arc-and-leap silhouette.
 */
export function DolphinMark({ size = 32, className, color }: DolphinMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('flex-shrink-0', className)}
      aria-label="COSTRA dolphin mark"
    >
      {/* Body — main arc leap */}
      <path
        d="M6 28 C6 28 8 20 14 15 C20 10 28 10 33 13 C36 14.5 37 16 35 18 C33 20 29 19 26 17 C22 14.5 18 15 15 18 C12 21 10 26 11 31 C12 34 14 35 16 34"
        stroke={color ?? 'currentColor'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dorsal fin */}
      <path
        d="M22 13 C23 9 27 7 30 9 C28 10.5 27 12 26 13"
        stroke={color ?? 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tail flukes */}
      <path
        d="M14 34 C12 37 9 38 7 36 C10 35 11 33 11 31"
        stroke={color ?? 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 34 C16 36 18 38 21 37 C19 36 17 35 16 34"
        stroke={color ?? 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eye */}
      <circle cx="29" cy="15" r="1.2" fill={color ?? 'currentColor'} />
      {/* Speed lines — minimal, precise */}
      <path
        d="M3 22 L9 22"
        stroke={color ?? 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M2 26 L6 26"
        stroke={color ?? 'currentColor'}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.25"
      />
    </svg>
  )
}

interface DolphinLogoProps {
  size?:      'sm' | 'md' | 'lg'
  variant?:   'full' | 'mark-only' | 'stacked'
  dark?:      boolean
  className?: string
}

/**
 * Full COSTRA logotype with optional dolphin mark.
 */
export function DolphinLogo({
  size = 'md',
  variant = 'full',
  dark = false,
  className,
}: DolphinLogoProps) {
  const markSize  = size === 'sm' ? 20 : size === 'md' ? 26 : 34
  const textClass = size === 'sm' ? 'text-[15px]' : size === 'md' ? 'text-[18px]' : 'text-[24px]'
  const color     = dark ? '#c89060' : 'var(--sidebar-accent, #7a4830)'

  if (variant === 'mark-only') {
    return <DolphinMark size={markSize} className={className} color={color} />
  }

  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <DolphinMark size={markSize} color={color} />
        <span
          className={cn('display font-700 tracking-tight', textClass)}
          style={{ color: dark ? '#e8dbd0' : 'var(--ink)', fontWeight: 700 }}
        >
          COSTRA
        </span>
      </div>
    )
  }

  // full
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <DolphinMark size={markSize} color={color} />
      <span
        className={cn('display font-700 tracking-tight', textClass)}
        style={{ color: dark ? '#e8dbd0' : 'var(--ink)', fontWeight: 700, letterSpacing: '-0.03em' }}
      >
        COSTRA
      </span>
    </div>
  )
}
