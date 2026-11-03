import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-raised shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gold-line/25 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
