import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatShortDate, formatTime } from '../lib/utils'
import type { CustomerCommunication } from '../types'
import { Button } from './ui/Button'

const MESSAGE_TYPE_LABELS: Record<CustomerCommunication['messageType'], string> = {
  text: 'Text',
  email: 'Email',
  phone: 'Phone conversation',
  other: 'Other',
}

const PRIORITY_LABELS: Record<CustomerCommunication['priority'], string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

const VISIBILITY_LABELS: Record<CustomerCommunication['visibility'], string> = {
  all: 'All (anyone on the job)',
  supervisor: 'Supervisor+',
  operations: 'Operations (GM / Ops / Admin)',
}

export function CustomerCommunicationViewModal({
  communication,
  onClose,
}: {
  communication: CustomerCommunication | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!communication) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [communication, onClose])

  if (!communication || typeof document === 'undefined') return null

  const c = communication

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-comm-view-title"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl dark:border-gold-line/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Customer communication
            </p>
            <h2
              id="customer-comm-view-title"
              className="mt-1 font-display text-2xl font-bold tracking-wide text-ink"
            >
              {c.recipientName}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {formatShortDate(c.communicatedOn)}
              {c.communicatedAt ? ` · ${formatTime(c.communicatedAt.slice(0, 5))}` : ''}
              {' · '}
              {PRIORITY_LABELS[c.priority]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-ink-muted hover:bg-surface hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Sender
              </dt>
              <dd className="mt-1 text-ink">{c.senderName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Message type
              </dt>
              <dd className="mt-1 text-ink">{MESSAGE_TYPE_LABELS[c.messageType]}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Device
              </dt>
              <dd className="mt-1 text-ink">{c.deviceType || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Visibility
              </dt>
              <dd className="mt-1 text-ink">{VISIBILITY_LABELS[c.visibility]}</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Message
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{c.body}</p>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
