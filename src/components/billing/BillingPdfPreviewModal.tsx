import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, X } from 'lucide-react'
import type { BuiltPdf } from '../../lib/billing/pdf'
import { triggerDownload } from '../../lib/billing/pdf'
import { Button } from '../ui/Button'

/**
 * In-browser PDF preview: blob URL in an iframe, with download.
 * Pass null to close. Object URL is revoked when the preview clears.
 */
export function BillingPdfPreviewModal({
  pdf,
  title,
  onClose,
}: {
  pdf: BuiltPdf | null
  title: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!pdf) return
    const url = pdf.objectUrl
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [pdf])

  useEffect(() => {
    if (!pdf) return

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
  }, [pdf, onClose])

  if (!pdf || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-pdf-preview-title"
    >
      <div
        className="flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl dark:border-gold-line/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              PDF preview · US Letter
            </p>
            <h2
              id="billing-pdf-preview-title"
              className="mt-1 truncate font-display text-xl font-bold tracking-wide text-ink"
            >
              {title}
            </h2>
            <p className="mt-0.5 truncate text-sm text-ink-muted">{pdf.filename}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" size="sm" onClick={() => triggerDownload(pdf)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe
          title={title}
          src={pdf.objectUrl}
          className="min-h-0 w-full flex-1 bg-ink/5"
        />
      </div>
    </div>,
    document.body,
  )
}
