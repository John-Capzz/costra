// ============================================================
// COSTRA — Badge primitive
// ============================================================

import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'accent'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const VARIANT_STYLES: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
  success: { color: 'var(--success)',  bg: 'var(--success-soft)',  border: 'transparent' },
  warning: { color: 'var(--warning)',  bg: 'var(--warning-soft)',  border: 'transparent' },
  danger:  { color: 'var(--danger)',   bg: 'var(--danger-soft)',   border: 'transparent' },
  info:    { color: 'var(--info)',     bg: 'var(--info-soft)',     border: 'transparent' },
  muted:   { color: 'var(--muted)',    bg: 'var(--surface-muted)', border: 'var(--border)' },
  accent:  { color: 'var(--accent)',   bg: 'var(--accent-soft)',   border: 'transparent' },
}

export function Badge({ variant = 'muted', size = 'sm', className, children, ...rest }: BadgeProps) {
  const s = VARIANT_STYLES[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[4px] font-semibold uppercase tracking-[0.06em]',
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1',
        className,
      )}
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
      {...rest}
    >
      {children}
    </span>
  )
}
