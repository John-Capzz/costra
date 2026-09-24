import { DolphinMark } from './DolphinLogo'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  useLogo?: boolean
}

export function EmptyState({ title, description, action, className, useLogo = true }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {useLogo && (
        <div className="mb-5 opacity-25">
          <DolphinMark size={40} />
        </div>
      )}
      <h3 className="display text-base font-600 text-[var(--ink)] mb-1.5" style={{ fontWeight: 600 }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--muted)] max-w-sm text-pretty">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
