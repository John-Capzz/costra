import { cn } from '@/lib/utils'

export function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 16 : size === 'md' ? 24 : 36
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-[var(--accent)]', className)}
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
