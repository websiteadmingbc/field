import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Trash2 } from 'lucide-react'
import { JobDocumentsPanel } from '../../components/documents/JobDocumentsPanel'
import { onJobCompletedDocuments } from '../../lib/supabase/documents'
import { useAuth } from '../../context/AuthContext'
import {
  canManageCustomerCommunications,
  canPinJobDocuments,
  canPurgeDocuments,
  canSetDocumentLegalHold,
} from '../../types/auth'
import { PhotoCapturePanel } from '../../components/PhotoCapturePanel'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { Lightbox } from '../../components/ui/Lightbox'
import { PhotoThumb } from '../../components/ui/PhotoThumb'
import {
  APP_ROLE_OPTIONS,
  createProject,
  deleteProject,
  deleteSiteContact,
  emptyProjectInput,
  fetchAssignments,
  fetchProfiles,
  fetchProject,
  fetchSiteContacts,
  JOB_ACTIVE_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  projectToInput,
  setProjectAssignments,
  setProjectStatus,
  updateProject,
  upsertSiteContact,
  type ProjectInput,
  type SiteContactRow,
} from '../../lib/supabase/admin'
import type { Profile } from '../../types/auth'
import { roleLabel } from '../../types/auth'
import { formatShortDate, formatTime, geocodeAddress, statusLabel, todayISO } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import type {
  CommunicationMessageType,
  CommunicationPriority,
  CommunicationVisibility,
  CustomerCommunication,
  JobPhoto,
} from '../../types'

type Tab = 'details' | 'crew' | 'contacts' | 'communications' | 'documents' | 'photos'

const MESSAGE_TYPE_OPTIONS: { value: CommunicationMessageType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone conversation' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS: { value: CommunicationPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const VISIBILITY_OPTIONS: { value: CommunicationVisibility; label: string }[] = [
  { value: 'all', label: 'All (anyone on the job)' },
  { value: 'supervisor', label: 'Supervisor+' },
  { value: 'operations', label: 'Operations (GM / Ops / Admin)' },
]

type CommFormState = {
  recipient_name: string
  sender_name: string
  communicated_on: string
  communicated_at: string
  device_type: string
  message_type: CommunicationMessageType
  priority: CommunicationPriority
  visibility: CommunicationVisibility
  body: string
}

function emptyCommForm(senderName = ''): CommFormState {
  return {
    recipient_name: '',
    sender_name: senderName,
    communicated_on: todayISO(),
    communicated_at: '',
    device_type: '',
    message_type: 'phone',
    priority: 'normal',
    visibility: 'all',
    body: '',
  }
}

function visibilityLabel(v: CommunicationVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
}

function messageTypeLabel(v: CommunicationMessageType): string {
  return MESSAGE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v
}

function priorityLabel(v: CommunicationPriority): string {
  return PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? v
}

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line'
const areaClass =
  'mt-1.5 min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

export function AdminProjectFormPage() {
  const { projectId } = useParams()
  const isNew = !projectId || projectId === 'new'
  const navigate = useNavigate()
  const {
    refreshRemote,
    remote,
    data,
    saveCustomerCommunication,
    deleteCustomerCommunication,
  } = useApp()
  const { profile } = useAuth()
  const purgeDocs = canPurgeDocuments(profile?.app_role)
  const holdDocs = canSetDocumentLegalHold(profile?.app_role)
  const pinDocs = canPinJobDocuments(profile?.app_role)
  const canManageComms = canManageCustomerCommunications(profile?.app_role)

  const [tab, setTab] = useState<Tab>('details')
  const [form, setForm] = useState<ProjectInput>(emptyProjectInput())
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [assignmentRoles, setAssignmentRoles] = useState<Record<string, string>>({})
  const [contacts, setContacts] = useState<SiteContactRow[]>([])
  const [contactForm, setContactForm] = useState({
    full_name: '',
    contact_role: '',
    phone: '',
    email: '',
    is_primary: false,
  })
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [commForm, setCommForm] = useState<CommFormState>(() =>
    emptyCommForm(profile?.full_name ?? ''),
  )
  const [editingCommId, setEditingCommId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null)
  const [statusAtLoad, setStatusAtLoad] = useState<ProjectInput['status'] | null>(null)

  const projectPhotos = useMemo(
    () =>
      !projectId || isNew
        ? []
        : data.photos
            .filter((p) => p.jobId === projectId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.photos, projectId, isNew],
  )

  const projectCommunications = useMemo(
    () =>
      !projectId || isNew
        ? []
        : data.customerCommunications
            .filter((c) => c.jobId === projectId)
            .sort((a, b) => {
              const byDate = b.communicatedOn.localeCompare(a.communicatedOn)
              if (byDate !== 0) return byDate
              return b.createdAt.localeCompare(a.createdAt)
            }),
    [data.customerCommunications, projectId, isNew],
  )

  useEffect(() => {
    if (!editingCommId && profile?.full_name) {
      setCommForm((f) => (f.sender_name ? f : { ...f, sender_name: profile.full_name }))
    }
  }, [profile?.full_name, editingCommId])

  const title = useMemo(
    () => (isNew ? 'New Job' : form.name || 'Edit job'),
    [isNew, form.name],
  )

  const load = useCallback(async () => {
    if (isNew || !projectId) {
      setForm(emptyProjectInput())
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [project, assignments, siteContacts, people] = await Promise.all([
        fetchProject(projectId),
        fetchAssignments(projectId),
        fetchSiteContacts(projectId),
        fetchProfiles(),
      ])
      if (!project) throw new Error('Job not found')
      const input = projectToInput(project)
      setForm(input)
      setStatusAtLoad(input.status)
      setAssignedIds(assignments.map((a) => a.user_id))
      setAssignmentRoles(
        Object.fromEntries(assignments.map((a) => [a.user_id, a.assignment_role])),
      )
      setContacts(siteContacts)
      setProfiles(people.filter((p) => p.active))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job')
    } finally {
      setLoading(false)
    }
  }, [isNew, projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isNew) return
    void fetchProfiles()
      .then((people) => setProfiles(people.filter((p) => p.active)))
      .catch(() => undefined)
  }, [isNew])

  function setField<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (!form.job_number.trim() || !form.name.trim()) {
        throw new Error('Job number and name are required.')
      }
      const payload = {
        ...form,
        job_number: form.job_number.trim(),
        name: form.name.trim(),
        scheduled_date: form.scheduled_date || null,
      }
      // Fill map pins from the street address when coords are missing
      if ((payload.lat == null || payload.lng == null || (payload.lat === 0 && payload.lng === 0)) &&
          payload.address.trim()) {
        const coords = await geocodeAddress(
          `${payload.address}, ${payload.city}, ${payload.state} ${payload.zip}`,
        )
        if (coords) {
          payload.lat = coords.lat
          payload.lng = coords.lng
          setForm((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }))
        }
      }
      if (isNew) {
        const created = await createProject(payload)
        if (remote) await refreshRemote()
        navigate(`/admin/projects/${created.id}`, { replace: true })
        setNotice('Job created. Assign crew and site contacts next.')
      } else if (projectId) {
        await updateProject(projectId, payload)
        if (remote) await refreshRemote()
        let extra = ''
        if (payload.status === 'completed' && statusAtLoad !== 'completed') {
          const archiveWorking = confirm(
            'Job marked completed. Set retention on documents and archive working docs (RFIs, submittals, logs, correspondence, photos)? Closeout and drawings stay active.',
          )
          try {
            const result = await onJobCompletedDocuments(projectId, { archiveWorking })
            extra = archiveWorking
              ? ` Retention set on ${result.retentionUpdated}; archived ${result.archived} working docs.`
              : ` Retention set on ${result.retentionUpdated} docs.`
          } catch (docErr) {
            extra = ` Document retention failed: ${docErr instanceof Error ? docErr.message : 'error'}`
          }
        }
        setStatusAtLoad(payload.status)
        setNotice(`Job saved.${extra}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveCrew() {
    if (!projectId || isNew) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await setProjectAssignments(projectId, assignedIds, assignmentRoles)
      if (remote) await refreshRemote()
      setNotice('Crew assignments saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save assignments')
    } finally {
      setSaving(false)
    }
  }

  function startEditContact(c: SiteContactRow) {
    setEditingContactId(c.id)
    setContactForm({
      full_name: c.full_name,
      contact_role: c.contact_role,
      phone: c.phone,
      email: c.email ?? '',
      is_primary: c.is_primary,
    })
    setNotice(null)
  }

  function cancelEditContact() {
    setEditingContactId(null)
    setContactForm({
      full_name: '',
      contact_role: '',
      phone: '',
      email: '',
      is_primary: false,
    })
  }

  async function onAddContact(e: FormEvent) {
    e.preventDefault()
    if (!projectId || isNew) return
    setSaving(true)
    setError(null)
    try {
      if (!contactForm.full_name.trim()) throw new Error('Contact name is required.')
      const wasEditing = Boolean(editingContactId)
      await upsertSiteContact({
        id: editingContactId ?? undefined,
        project_id: projectId,
        full_name: contactForm.full_name.trim(),
        contact_role: contactForm.contact_role.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim() || null,
        is_primary: contactForm.is_primary,
      })
      cancelEditContact()
      setContacts(await fetchSiteContacts(projectId))
      if (remote) await refreshRemote()
      setNotice(wasEditing ? 'Site contact updated.' : 'Site contact saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contact')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteContact(id: string) {
    if (!projectId || !confirm('Remove this site contact?')) return
    setSaving(true)
    try {
      await deleteSiteContact(id)
      setContacts(await fetchSiteContacts(projectId))
      if (remote) await refreshRemote()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  function startEditComm(c: CustomerCommunication) {
    setEditingCommId(c.id)
    setCommForm({
      recipient_name: c.recipientName,
      sender_name: c.senderName,
      communicated_on: c.communicatedOn,
      communicated_at: c.communicatedAt ? c.communicatedAt.slice(0, 5) : '',
      device_type: c.deviceType,
      message_type: c.messageType,
      priority: c.priority,
      visibility: c.visibility,
      body: c.body,
    })
    setNotice(null)
    setError(null)
  }

  function cancelEditComm() {
    setEditingCommId(null)
    setCommForm(emptyCommForm(profile?.full_name ?? ''))
  }

  async function onSaveComm(e: FormEvent) {
    e.preventDefault()
    if (!projectId || isNew || !canManageComms) return
    setSaving(true)
    setError(null)
    try {
      if (!commForm.recipient_name.trim()) throw new Error('Recipient name is required.')
      if (!commForm.sender_name.trim()) throw new Error('Sender name is required.')
      if (!commForm.body.trim()) throw new Error('Message / notes are required.')
      const wasEditing = Boolean(editingCommId)
      await saveCustomerCommunication({
        id: editingCommId ?? undefined,
        jobId: projectId,
        recipientName: commForm.recipient_name.trim(),
        senderName: commForm.sender_name.trim(),
        communicatedOn: commForm.communicated_on || todayISO(),
        communicatedAt: commForm.communicated_at
          ? `${commForm.communicated_at}:00`.slice(0, 8)
          : null,
        deviceType: commForm.device_type.trim(),
        messageType: commForm.message_type,
        priority: commForm.priority,
        visibility: commForm.visibility,
        body: commForm.body.trim(),
      })
      cancelEditComm()
      setNotice(wasEditing ? 'Customer communication updated.' : 'Customer communication submitted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save communication')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteComm(id: string) {
    if (!canManageComms || !confirm('Delete this customer communication?')) return
    setSaving(true)
    setError(null)
    try {
      await deleteCustomerCommunication(id)
      if (editingCommId === id) cancelEditComm()
      setNotice('Customer communication deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onArchiveProject() {
    if (!projectId || isNew) return
    if (!confirm('Archive this job? It will leave My Jobs lists but stay available in All Jobs when showing archived.'))
      return
    setSaving(true)
    setError(null)
    try {
      const updated = await setProjectStatus(projectId, 'archived')
      setForm(projectToInput(updated))
      if (remote) await refreshRemote()
      setNotice('Job archived.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setSaving(false)
    }
  }

  async function onUnarchiveProject() {
    if (!projectId || isNew) return
    setSaving(true)
    setError(null)
    try {
      const updated = await setProjectStatus(projectId, 'on_hold')
      setForm(projectToInput(updated))
      if (remote) await refreshRemote()
      setNotice('Job restored to On Hold. Update status as needed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteProject() {
    if (!projectId || isNew) return
    if (!confirm('Delete this job and its logs/photos/notices? This cannot be undone.')) return
    setSaving(true)
    try {
      await deleteProject(projectId)
      if (remote) await refreshRemote()
      navigate('/admin/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
  }

  return (
    <div className="space-y-5 animate-fade-up stagger-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/projects"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-teal hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Jobs
          </Link>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{title}</h2>
        </div>
        {!isNew && (
          <div className="flex flex-wrap gap-2">
            {form.status === 'archived' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void onUnarchiveProject()}
              >
                <Archive className="h-4 w-4" />
                Unarchive
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void onArchiveProject()}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={saving}
              onClick={() => void onDeleteProject()}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {!isNew && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['details', 'Details'],
              ['crew', 'Crew assignments'],
              ['contacts', 'Site contacts'],
              ['communications', 'Communications'],
              ['documents', 'Documents'],
              ['photos', 'Photos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'rounded-md bg-teal-fill px-3 py-2 text-sm font-semibold uppercase tracking-wide text-on-teal'
                  : 'rounded-md border border-gold-line/40 bg-surface-raised px-3 py-2 text-sm font-semibold uppercase tracking-wide text-ink-muted'
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald">
          {notice}
        </p>
      )}

      {(isNew || tab === 'details') && (
        <form onSubmit={onSaveDetails} className="space-y-4">
          <Card className="space-y-4 p-5">
            <SectionHeader title="Job details" subtitle="Visible to assigned crew in the field app" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Job number
                <input
                  required
                  value={form.job_number}
                  onChange={(e) => setField('job_number', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Job name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Client
                <input
                  value={form.client}
                  onChange={(e) => setField('client', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Job type
                <select
                  value={form.job_type}
                  onChange={(e) => setField('job_type', e.target.value)}
                  className={fieldClass}
                >
                  {JOB_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Status
                <select
                  value={form.status === 'archived' ? 'archived' : form.status}
                  onChange={(e) => setField('status', e.target.value as ProjectInput['status'])}
                  className={fieldClass}
                  disabled={form.status === 'archived'}
                >
                  {form.status === 'archived' ? (
                    <option value="archived">{statusLabel('archived')}</option>
                  ) : (
                    JOB_ACTIVE_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Scheduled date
                <input
                  type="date"
                  value={form.scheduled_date ?? ''}
                  onChange={(e) => setField('scheduled_date', e.target.value || null)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Start time
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setField('start_time', e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className={areaClass}
              />
            </label>
          </Card>

          <Card className="space-y-4 p-5">
            <SectionHeader title="Location" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">
                Address
                <input
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                City
                <input value={form.city} onChange={(e) => setField('city', e.target.value)} className={fieldClass} />
              </label>
              <label className="text-sm font-semibold">
                State
                <input
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                ZIP
                <input value={form.zip} onChange={(e) => setField('zip', e.target.value)} className={fieldClass} />
              </label>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <SectionHeader title="Site instructions" />
            {(
              [
                ['parking_instructions', 'Parking'],
                ['entrance_info', 'Entrance'],
                ['access_instructions', 'Access'],
                ['scope_of_work', 'Scope of work'],
                ['important_instructions', 'Important instructions'],
                ['required_materials', 'Required materials'],
                ['safety_considerations', 'Safety'],
                ['site_notes', 'Site notes'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <textarea
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  className={areaClass}
                />
              </label>
            ))}
          </Card>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create job' : 'Save job'}
          </Button>
        </form>
      )}

      {!isNew && tab === 'crew' && (
        <Card className="space-y-4 p-5">
          <SectionHeader
            title="Crew assignments"
            subtitle="Who can see and work this job (crew & supervisors)"
          />
          <ul className="divide-y divide-border rounded-xl border border-border">
            {profiles.map((p) => {
              const checked = assignedIds.includes(p.id)
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAssignedIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        )
                        if (e.target.checked && !assignmentRoles[p.id]) {
                          setAssignmentRoles((prev) => ({
                            ...prev,
                            [p.id]: p.app_role === 'crew' ? 'crew' : p.app_role,
                          }))
                        }
                      }}
                      className="h-4 w-4 accent-[var(--bf-gold-fill)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{p.full_name}</span>
                      <span className="block text-xs text-ink-muted">
                        {p.title || roleLabel(p.app_role)} · {p.email}
                      </span>
                    </span>
                  </label>
                  {checked && (
                    <select
                      value={assignmentRoles[p.id] || 'crew'}
                      onChange={(e) =>
                        setAssignmentRoles((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="h-9 rounded-md border border-border bg-surface px-2 text-xs font-semibold"
                    >
                      {APP_ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
          <Button type="button" disabled={saving} onClick={() => void onSaveCrew()}>
            {saving ? 'Saving…' : 'Save assignments'}
          </Button>
        </Card>
      )}

      {!isNew && tab === 'contacts' && (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <SectionHeader title="Site contacts" subtitle="Customer / GC / inspector for this job" />
            {contacts.length === 0 ? (
              <p className="text-sm text-ink-muted">No site contacts yet.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-ink">
                        {c.full_name}
                        {c.is_primary ? (
                          <span className="ml-2 text-xs uppercase tracking-wider text-teal">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {c.contact_role || 'Contact'}
                        {c.phone ? ` · ${c.phone}` : ''}
                        {c.email ? ` · ${c.email}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditContact(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDeleteContact(c.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <form onSubmit={onAddContact} className="space-y-3">
              <SectionHeader
                title={editingContactId ? 'Edit site contact' : 'Add site contact'}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Name
                  <input
                    required
                    value={contactForm.full_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, full_name: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Role
                  <input
                    value={contactForm.contact_role}
                    onChange={(e) => setContactForm((f) => ({ ...f, contact_role: e.target.value }))}
                    placeholder="Owner, GC, Inspector…"
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Phone
                  <input
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Email
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) => setContactForm((f) => ({ ...f, is_primary: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--bf-gold-fill)]"
                />
                Primary contact
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingContactId ? 'Save changes' : 'Add contact'}
                </Button>
                {editingContactId && (
                  <Button type="button" variant="outline" onClick={cancelEditContact}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}

      {!isNew && tab === 'communications' && projectId && (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <SectionHeader
              title="Customer communication"
              subtitle="Conversations with the customer for this job. Visibility controls who can see each entry in the field app."
            />
            {projectCommunications.length === 0 ? (
              <p className="text-sm text-ink-muted">No customer communications yet.</p>
            ) : (
              <ul className="space-y-2">
                {projectCommunications.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-3 py-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-ink">
                        {c.recipientName}
                        <span className="ml-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                          {priorityLabel(c.priority)}
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatShortDate(c.communicatedOn)}
                        {c.communicatedAt ? ` · ${formatTime(c.communicatedAt.slice(0, 5))}` : ''}
                        {' · '}
                        {messageTypeLabel(c.messageType)}
                        {c.deviceType ? ` · ${c.deviceType}` : ''}
                        {' · '}
                        From {c.senderName}
                      </p>
                      <p className="text-xs text-ink-subtle">Visible: {visibilityLabel(c.visibility)}</p>
                      <p className="text-sm text-ink-muted line-clamp-2">{c.body}</p>
                    </div>
                    {canManageComms && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEditComm(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => void onDeleteComm(c.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManageComms ? (
            <Card className="p-5">
              <form onSubmit={(e) => void onSaveComm(e)} className="space-y-3">
                <SectionHeader
                  title={editingCommId ? 'Edit communication' : 'Log customer communication'}
                  subtitle="Submit once — entry appears on this job for roles allowed by visibility"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Recipient name
                    <input
                      required
                      value={commForm.recipient_name}
                      onChange={(e) =>
                        setCommForm((f) => ({ ...f, recipient_name: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Sender name
                    <input
                      required
                      value={commForm.sender_name}
                      onChange={(e) => setCommForm((f) => ({ ...f, sender_name: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Date
                    <input
                      type="date"
                      required
                      value={commForm.communicated_on}
                      onChange={(e) =>
                        setCommForm((f) => ({ ...f, communicated_on: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Time
                    <input
                      type="time"
                      value={commForm.communicated_at}
                      onChange={(e) =>
                        setCommForm((f) => ({ ...f, communicated_at: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Device type
                    <input
                      value={commForm.device_type}
                      onChange={(e) => setCommForm((f) => ({ ...f, device_type: e.target.value }))}
                      placeholder="iPhone / Desktop"
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Message type
                    <select
                      value={commForm.message_type}
                      onChange={(e) =>
                        setCommForm((f) => ({
                          ...f,
                          message_type: e.target.value as CommunicationMessageType,
                        }))
                      }
                      className={fieldClass}
                    >
                      {MESSAGE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Priority
                    <select
                      value={commForm.priority}
                      onChange={(e) =>
                        setCommForm((f) => ({
                          ...f,
                          priority: e.target.value as CommunicationPriority,
                        }))
                      }
                      className={fieldClass}
                    >
                      {PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Visibility
                    <select
                      value={commForm.visibility}
                      onChange={(e) =>
                        setCommForm((f) => ({
                          ...f,
                          visibility: e.target.value as CommunicationVisibility,
                        }))
                      }
                      className={fieldClass}
                    >
                      {VISIBILITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-semibold">
                  Message / notes
                  <textarea
                    required
                    value={commForm.body}
                    onChange={(e) => setCommForm((f) => ({ ...f, body: e.target.value }))}
                    rows={4}
                    className={areaClass}
                    placeholder="What was discussed or sent…"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : editingCommId ? 'Save changes' : 'Submit'}
                  </Button>
                  {editingCommId && (
                    <Button type="button" variant="outline" onClick={cancelEditComm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          ) : (
            <p className="text-sm text-ink-muted">
              Only Operations (Admin, GM, Ops Manager) can log customer communications.
            </p>
          )}
        </div>
      )}

      {!isNew && tab === 'documents' && projectId && (
        <JobDocumentsPanel
          jobId={projectId}
          jobNumber={form.job_number}
          jobName={form.name}
          canManage
          canPurge={purgeDocs}
          canHold={holdDocs}
          canPin={pinDocs}
        />
      )}

      {!isNew && tab === 'photos' && projectId && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader
              title="Job photos"
              subtitle="Same master library as Photos — filtered to this job"
              action={
                <Link
                  to={`/photos?job=${projectId}`}
                  className="text-sm font-semibold text-teal hover:underline"
                >
                  Open library
                </Link>
              }
            />
            <PhotoCapturePanel
              jobId={projectId}
              jobName={form.name}
              lockedJob
              defaultCategory="estimation"
              onUploaded={() => {
                if (remote) void refreshRemote()
              }}
            />
          </Card>
          {projectPhotos.length === 0 ? (
            <p className="text-sm text-ink-muted">No photos linked to this job yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {projectPhotos.map((p) => (
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
          <Lightbox
            key={lightbox?.id ?? 'closed'}
            photo={lightbox}
            onClose={() => setLightbox(null)}
          />
        </div>
      )}
    </div>
  )
}
