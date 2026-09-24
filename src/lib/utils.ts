// ============================================================
// COSTRA — Utility helpers
// ============================================================

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as USD with 2 decimal places, e.g. $1.06 */
export function formatUsd(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`
}

/** Format a percent value, e.g. +11.32% */
export function formatPct(value: number, forceSign = false): string {
  const sign = forceSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/** Short relative time from ISO string */
export function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** Format ISO string as short date, e.g. Sep 20, 2026 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/** Format ISO string as date + time, e.g. Sep 20 · 08:03 */
export function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Truncate an address or hash for display */
export function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2 + 2) return hash
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
