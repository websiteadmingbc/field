import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ExternalLink, Map, MapPin, Phone, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  appleMapsUrl,
  formatTime,
  fullAddress,
  googleMapsPlaceUrl,
  googleMapsUrl,
  phoneHref,
  staticMapPreviewUrl,
} from '../lib/utils'
import type { Job } from '../types'
import { Button } from './ui/Button'

export function LocationDetailsModal({
  job,
  onClose,
}: {
  job: Job | null
  onClose: () => void
}) {
  const { getContact } = useApp()

  useEffect(() => {
    if (!job) return

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
  }, [job, onClose])

  if (!job || typeof document === 'undefined') return null

  const contact = getContact(job.primaryContactId)
  const mapsPlace = googleMapsPlaceUrl(job)
  const mapsDirections = googleMapsUrl(job)

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-details-title"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl dark:border-gold-line/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Location details
            </p>
            <h2
              id="location-details-title"
              className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-ink"
            >
              {job.name}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {job.city}, {job.state}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Map */}
        <div className="relative mx-5 aspect-[16/10] overflow-hidden rounded-xl border border-border bg-charcoal-muted">
          <iframe
            title={`Map of ${job.name}`}
            src={staticMapPreviewUrl(job)}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href={mapsPlace}
            target="_blank"
            rel="noreferrer"
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-teal shadow-sm transition hover:border-gold-line"
          >
            Open in Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Info rows */}
        <div className="space-y-4 overflow-y-auto px-5 py-5">
          <InfoRow
            icon={<MapPin className="h-5 w-5" />}
            title={fullAddress(job)}
            subtitle={`${job.entranceInfo}`}
          />
          <InfoRow
            icon={<Clock className="h-5 w-5" />}
            title="Scheduled start"
            subtitle={`${formatTime(job.startTime)} · ${job.type}`}
          />
          {contact && (
            <InfoRow
              icon={<Phone className="h-5 w-5" />}
              title="Call site contact"
              subtitle={
                <a
                  href={phoneHref(contact.phone)}
                  className="font-semibold text-teal hover:underline"
                >
                  {contact.phone}
                </a>
              }
              detail={`${contact.name} · ${contact.role}`}
            />
          )}

          <div className="rounded-xl border border-border bg-surface px-4 py-3 dark:border-gold-line/25">
            <p className="text-sm font-bold text-ink">Parking tip</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {job.parkingInstructions}
            </p>
            {job.accessInstructions && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink">Access: </span>
                {job.accessInstructions}
              </p>
            )}
          </div>

          <p className="text-xs text-ink-subtle">
            Directions open in your maps app when you choose. Britton Field does not track your
            location.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row">
          <a
            href={mapsDirections}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 text-inherit no-underline"
          >
            <Button className="w-full" size="lg">
              <Map className="h-4 w-4" />
              Get Directions
            </Button>
          </a>
          <a
            href={appleMapsUrl(job)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 text-inherit no-underline"
          >
            <Button className="w-full" size="lg" variant="outline">
              Open in Apple Maps
            </Button>
          </a>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function InfoRow({
  icon,
  title,
  subtitle,
  detail,
}: {
  icon: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  detail?: string
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 text-teal">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        {subtitle && <div className="mt-0.5 text-sm text-ink-muted">{subtitle}</div>}
        {detail && <p className="mt-0.5 text-xs text-ink-subtle">{detail}</p>}
      </div>
    </div>
  )
}
