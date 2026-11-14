import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
} from 'lucide-react'
import { JobDocumentsPanel } from '../components/documents/JobDocumentsPanel'
import { LocationDetailsModal } from '../components/LocationDetailsModal'
import { PhotoCapturePanel } from '../components/PhotoCapturePanel'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PhotoThumb } from '../components/ui/PhotoThumb'
import { Lightbox } from '../components/ui/Lightbox'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { onJobCompletedDocuments } from '../lib/supabase/documents'
import {
  canManageJobDocuments,
  canPinJobDocuments,
  canPurgeDocuments,
  canSetDocumentLegalHold,
  canUploadJobSubmittals,
} from '../types/auth'
import { isSupabaseConfigured } from '../lib/supabase/client'
import {
  emailHref,
  formatDate,
  formatRelative,
  formatShortDate,
  formatTime,
  fullAddress,
  googleMapsPlaceUrl,
  hasMapCoords,
  phoneHref,
  staticMapPreviewUrl,
} from '../lib/utils'
import type { JobPhoto, JobStatus, MaterialStatus } from '../types'

const statusOptions: JobStatus[] = ['scheduled', 'in_progress', 'on_hold', 'completed']
const materialStatuses: MaterialStatus[] = ['needed', 'ordered', 'delivered', 'missing']

export function JobDetailPage() {
  const { jobId } = useParams()
  const {
    getJob,
    getContact,
    updateJobStatus,
    toggleChecklistItem,
    addNote,
    addMaterial,
    updateMaterialStatus,
    data,
    remote,
    refreshRemote,
  } = useApp()
  const { profile } = useAuth()
  const manageDocs = canManageJobDocuments(profile?.app_role)
  const purgeDocs = canPurgeDocuments(profile?.app_role)
  const holdDocs = canSetDocumentLegalHold(profile?.app_role)
  const uploadSubmittals = canUploadJobSubmittals(profile?.app_role)
  const pinDocs = canPinJobDocuments(profile?.app_role)
  const job = getJob(jobId ?? '')

  async function handleStatusChange(next: JobStatus) {
    if (!job) return
    updateJobStatus(job.id, next)
    if (next === 'completed' && manageDocs && isSupabaseConfigured()) {
      const archiveWorking = confirm(
        'Job completed. Set retention dates on documents and archive working docs (RFIs, submittals, logs, correspondence, photos)? Closeout and drawings stay active.',
      )
      try {
        const result = await onJobCompletedDocuments(job.id, { archiveWorking })
        if (archiveWorking) {
          alert(
            `Retention updated on ${result.retentionUpdated} doc(s). Archived ${result.archived} working doc(s).`,
          )
        } else {
          alert(`Retention updated on ${result.retentionUpdated} doc(s). Working docs left active.`)
        }
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : 'Could not update document retention')
      }
    }
  }
  const [noteText, setNoteText] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [materialQty, setMaterialQty] = useState('')
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null)
  const [directionsOpen, setDirectionsOpen] = useState(false)

  const activity = useMemo(
    () =>
      data.activity
        .filter((a) => a.jobId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.activity, job?.id],
  )

  const photos = useMemo(
    () =>
      data.photos
        .filter((p) => p.jobId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.photos, job?.id],
  )

  const notes = useMemo(
    () => data.notes.filter((n) => n.jobId === job?.id),
    [data.notes, job?.id],
  )

  if (!job) {
    return (
      <EmptyState
        icon={<MapPin className="h-6 w-6" />}
        title="Job not found"
        description="This job may have been removed or the link is incorrect."
        action={
          <Link to="/jobs" className="text-sm font-semibold text-teal hover:underline">
            Back to My Jobs
          </Link>
        }
      />
    )
  }

  const primary = getContact(job.primaryContactId)
  const pm = getContact(job.projectManagerId)
  const supervisor = getContact(job.siteSupervisorId)
  const others = job.otherContactIds.map((id) => getContact(id)).filter(Boolean)
  const crew = job.assignedCrewIds.map((id) => getContact(id)).filter(Boolean)

  const contacts = [
    primary && { ...primary, label: 'Primary contact' },
    pm && { ...pm, label: 'Project manager' },
    supervisor && { ...supervisor, label: 'Site supervisor' },
    ...others.map((c) => c && { ...c, label: c.role }),
  ].filter(Boolean) as Array<NonNullable<typeof primary> & { label: string }>

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <Link
          to="/jobs"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-teal"
        >
          <ArrowLeft className="h-4 w-4" />
          My Jobs
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal">
              {job.jobNumber}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              {job.name}
            </h1>
            <p className="mt-1 text-ink-muted">
              {job.customer} · {job.type}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={job.status} />
            <select
              value={job.status}
              onChange={(e) => void handleStatusChange(e.target.value as JobStatus)}
              className="h-10 rounded-xl border border-border bg-surface-raised px-3 text-sm font-medium capitalize outline-none focus:border-teal-bright"
              aria-label="Update job status"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === 'in_progress' ? 'In Progress' : s === 'on_hold' ? 'On Hold' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-ink-muted">{job.description}</p>
        <p className="mt-2 text-sm text-ink-subtle">
          Scheduled {formatDate(job.scheduledDate, { month: 'long', day: 'numeric', year: 'numeric' })} ·{' '}
          {formatTime(job.startTime)}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 animate-fade-up stagger-1">
        <Button onClick={() => setDirectionsOpen(true)}>
          <Navigation className="h-4 w-4" />
          Get Directions
        </Button>
        {primary && (
          <a href={phoneHref(primary.phone)}>
            <Button variant="outline">
              <Phone className="h-4 w-4" />
              Call Site Contact
            </Button>
          </a>
        )}
        <Link to={`/photos?job=${job.id}`}>
          <Button variant="outline">
            <Camera className="h-4 w-4" />
            Add Photo
          </Button>
        </Link>
        <Link to={`/log?job=${job.id}`}>
          <Button variant="outline">
            <ClipboardList className="h-4 w-4" />
            Add Daily Note
          </Button>
        </Link>
        <Link to={`/log?job=${job.id}&issue=1`}>
          <Button variant="outline">
            Report an Issue
          </Button>
        </Link>
      </div>

      {/* Location */}
      <section className="animate-fade-up stagger-2">
        <SectionHeader
          title="Location & directions"
          action={
            <Button size="sm" variant="outline" onClick={() => setDirectionsOpen(true)}>
              Location details
            </Button>
          }
        />
        <Card className="overflow-hidden">
          <div className="relative aspect-[16/9] w-full bg-charcoal-muted sm:aspect-[21/9]">
            {hasMapCoords(job) && staticMapPreviewUrl(job) ? (
              <iframe
                title="Map preview"
                src={staticMapPreviewUrl(job)!}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <MapPin className="h-8 w-8 text-teal" />
                <p className="text-sm font-semibold text-white">Map preview unavailable</p>
                <p className="max-w-sm text-xs text-white/60">
                  This job is missing map coordinates. Use Open in Maps, or edit the job address in
                  Admin so we can place it on the map.
                </p>
              </div>
            )}
            <a
              href={googleMapsPlaceUrl(job)}
              target="_blank"
              rel="noreferrer"
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-teal shadow-sm"
            >
              Open in Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
              <div>
                <p className="font-bold text-ink">{fullAddress(job)}</p>
                <p className="mt-0.5 text-ink-muted">{job.entranceInfo}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3 dark:border-gold-line/25">
              <p className="text-sm font-bold text-ink">Parking tip</p>
              <p className="mt-1 text-sm text-ink-muted">{job.parkingInstructions}</p>
            </div>
            <Button onClick={() => setDirectionsOpen(true)}>
              <Navigation className="h-4 w-4" />
              Get Directions
            </Button>
            <p className="text-xs text-ink-subtle">
              Directions open in your maps app when you choose. Britton Field does not track your location.
            </p>
          </div>
        </Card>
      </section>

      {/* Contacts */}
      <section>
        <SectionHeader title="Contacts" />
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => (
            <Card key={c.id + c.label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {c.label}
              </p>
              <p className="mt-1 font-semibold text-ink">{c.name}</p>
              <p className="text-sm text-ink-muted">{c.role}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={phoneHref(c.phone)}>
                  <Button size="sm" variant="outline">
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone}
                  </Button>
                </a>
                {c.email && (
                  <a href={emailHref(c.email)}>
                    <Button size="sm" variant="ghost">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </Button>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
        {crew.length > 0 && (
          <p className="mt-3 text-sm text-ink-muted">
            Assigned crew: {crew.map((c) => c!.name).join(', ')}
          </p>
        )}
      </section>

      {/* Job info */}
      <section>
        <SectionHeader title="Job information" />
        <div className="grid gap-3">
          <InfoCard title="Scope of work" body={job.scopeOfWork} />
          <InfoCard title="Important instructions" body={job.importantInstructions} />
          <InfoCard title="Required materials" body={job.requiredMaterials} />
          <InfoCard title="Safety considerations" body={job.safetyConsiderations} />
          <InfoCard title="Site-specific notes" body={job.siteNotes} />
        </div>
      </section>

      {/* Checklist */}
      <section>
        <SectionHeader title="Job checklist" subtitle="Simple site activities — not a performance score" />
        <Card className="divide-y divide-border">
          {job.checklist.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 px-5 py-3.5 hover:bg-surface"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleChecklistItem(job.id, item.id)}
                className="h-5 w-5 rounded border-border-strong text-teal accent-teal"
              />
              <span
                className={
                  item.completed ? 'text-sm text-ink-subtle line-through' : 'text-sm font-medium text-ink'
                }
              >
                {item.label}
              </span>
              <CheckSquare className="ml-auto h-4 w-4 text-ink-subtle opacity-40" />
            </label>
          ))}
        </Card>
      </section>

      {/* Materials */}
      <section>
        <SectionHeader title="Materials & supplies" />
        <Card className="p-5">
          <ul className="space-y-3">
            {job.materials.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 text-ink-subtle" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{m.name}</p>
                    <p className="text-xs text-ink-muted">
                      {m.quantity}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </p>
                  </div>
                </div>
                <select
                  value={m.status}
                  onChange={(e) =>
                    updateMaterialStatus(job.id, m.id, e.target.value as MaterialStatus)
                  }
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-xs font-semibold capitalize"
                >
                  {materialStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (!materialName.trim()) return
              addMaterial(job.id, {
                name: materialName.trim(),
                quantity: materialQty.trim() || '1',
                status: 'needed',
              })
              setMaterialName('')
              setMaterialQty('')
            }}
          >
            <input
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="Material name"
              className="h-11 flex-1 rounded-xl border border-border px-3 text-sm outline-none focus:border-teal-bright"
            />
            <input
              value={materialQty}
              onChange={(e) => setMaterialQty(e.target.value)}
              placeholder="Qty"
              className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-teal-bright sm:w-24"
            />
            <Button type="submit" size="md" variant="outline">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </Card>
      </section>

      {/* Document Library — Phase 1 (lives on the job; no global sidebar) */}
      <section>
        <JobDocumentsPanel
          jobId={job.id}
          jobNumber={job.jobNumber}
          jobName={job.name}
          canManage={manageDocs}
          fieldMode={!manageDocs}
          canPurge={purgeDocs}
          canHold={holdDocs}
          canUploadSubmittals={uploadSubmittals}
          canPin={pinDocs || manageDocs}
        />
      </section>

      {/* Notes */}
      <section>
        <SectionHeader title="Job notes" subtitle="Shared between crews" />
        <Card className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!noteText.trim()) return
              addNote(job.id, noteText)
              setNoteText('')
            }}
            className="space-y-3"
          >
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Add a note for the next crew or visit…"
              className="w-full rounded-xl border border-border px-3 py-3 text-sm outline-none focus:border-teal-bright"
            />
            <Button type="submit" disabled={!noteText.trim()}>
              Add note
            </Button>
          </form>
          <ul className="mt-5 space-y-3">
            {notes.map((n) => {
              const author = getContact(n.authorId)
              return (
                <li key={n.id} className="rounded-xl bg-surface px-4 py-3">
                  <p className="text-sm text-ink">{n.content}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {author?.name ?? 'Crew'} · {formatRelative(n.createdAt)}
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>

      {/* Photos from master library for this job */}
      <section className="space-y-4">
        <SectionHeader
          title="Job photos"
          subtitle={`${photos.length} in library for this job`}
          action={
            <Link
              to={`/photos?job=${job.id}`}
              className="text-sm font-semibold text-teal hover:underline"
            >
              Open library
            </Link>
          }
        />
        <Card className="p-5">
          <PhotoCapturePanel
            jobId={job.id}
            jobName={job.name}
            lockedJob
            defaultCategory="progress"
            onUploaded={() => {
              if (remote) void refreshRemote()
            }}
          />
        </Card>
        {photos.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No photos linked yet. Capture above — they are saved to the master library and this job
            automatically.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="space-y-1">
                <PhotoThumb photo={p} onClick={() => setLightbox(p)} />
                <p className="truncate px-0.5 text-xs capitalize text-ink-muted">
                  {p.category}
                  {p.caption ? ` · ${p.caption}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity */}
      <section>
        <SectionHeader title="Activity" subtitle="Recent updates, photos, and notes" />
        <Card className="divide-y divide-border">
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">No activity yet.</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {formatShortDate(item.createdAt)}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      <Lightbox
        key={lightbox?.id ?? 'closed'}
        photo={lightbox}
        onClose={() => setLightbox(null)}
      />
      <LocationDetailsModal
        job={directionsOpen ? job : null}
        onClose={() => setDirectionsOpen(false)}
      />
    </div>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </Card>
  )
}
