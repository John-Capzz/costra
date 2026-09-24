// ============================================================
// COSTRA — Card primitive
// ============================================================

import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const PADDING = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
}

export function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] overflow-hidden',
        PADDING[padding],
        className,
      )}
      style={{
        background:  'var(--surface-strong)',
        border:      '1px solid var(--border)',
        boxShadow:   'var(--shadow-sm)',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
