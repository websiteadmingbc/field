import type { JobStatus } from '../../types'
import { cn, statusLabel, statusTone } from '../../lib/utils'

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
        statusTone(status),
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
