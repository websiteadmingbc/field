import type { Contact, Job, JobStatus } from '../types'

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function todayISO(): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', opts ?? { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(iso)
}

export function fullAddress(job: Job): string {
  return `${job.address}, ${job.city}, ${job.state} ${job.zip}`
}

export function googleMapsUrl(job: Job): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(job))}`
}

export function googleMapsPlaceUrl(job: Job): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(job))}`
}

export function appleMapsUrl(job: Job): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress(job))}`
}

/** True when the job has real map coordinates (not missing / 0,0 ocean fallback). */
export function hasMapCoords(job: Pick<Job, 'lat' | 'lng'>): boolean {
  return (
    typeof job.lat === 'number' &&
    typeof job.lng === 'number' &&
    Number.isFinite(job.lat) &&
    Number.isFinite(job.lng) &&
    !(job.lat === 0 && job.lng === 0)
  )
}

export function staticMapPreviewUrl(job: Job): string | null {
  if (!hasMapCoords(job)) return null
  const { lat, lng } = job
  // OpenStreetMap embed (no API key)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.008}%2C${lng + 0.01}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`
}

/** Geocode a street address via OpenStreetMap Nominatim (no API key; rate-limited). */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim()
  if (!q) return null
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim requires a valid identifying User-Agent
      'User-Agent': 'BrittonField/1.0 (field.greatbrittongc.com)',
    },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ lat: string; lon: string }>
  const hit = data[0]
  if (!hit) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'on_hold':
      return 'On Hold'
    case 'archived':
      return 'Archived'
  }
}

export function statusTone(status: JobStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-sky-soft text-sky'
    case 'in_progress':
      return 'bg-teal-soft text-teal'
    case 'completed':
      return 'bg-emerald-soft text-emerald'
    case 'on_hold':
      return 'bg-amber-soft text-amber'
    case 'archived':
      return 'bg-surface-raised text-ink-muted'
  }
}

export function greetingForHour(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function contactById(contacts: Contact[], id: string): Contact | undefined {
  return contacts.find((c) => c.id === id)
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function emailHref(email: string): string {
  return `mailto:${email}`
}

export function isToday(isoDate: string): boolean {
  return isoDate === todayISO()
}

export function isUpcoming(isoDate: string): boolean {
  return isoDate > todayISO()
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
