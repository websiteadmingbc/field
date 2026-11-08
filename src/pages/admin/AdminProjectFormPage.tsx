import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
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
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  projectToInput,
  setProjectAssignments,
  updateProject,
  upsertSiteContact,
  type ProjectInput,
  type SiteContactRow,
} from '../../lib/supabase/admin'
import type { Profile } from '../../types/auth'
import { roleLabel } from '../../types/auth'
import { geocodeAddress, statusLabel } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import type { JobPhoto } from '../../types'

type Tab = 'details' | 'crew' | 'contacts' | 'photos'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line'
const areaClass =
  'mt-1.5 min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

export function AdminProjectFormPage() {
  const { projectId } = useParams()
  const isNew = !projectId || projectId === 'new'
  const navigate = useNavigate()
  const { refreshRemote, remote, data } = useApp()

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
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null)

  const projectPhotos = useMemo(
    () =>
      !projectId || isNew
        ? []
        : data.photos
            .filter((p) => p.jobId === projectId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.photos, projectId, isNew],
  )

  const title = useMemo(
    () => (isNew ? 'New project' : form.name || 'Edit project'),
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
      if (!project) throw new Error('Project not found')
      setForm(projectToInput(project))
      setAssignedIds(assignments.map((a) => a.user_id))
      setAssignmentRoles(
        Object.fromEntries(assignments.map((a) => [a.user_id, a.assignment_role])),
      )
      setContacts(siteContacts)
      setProfiles(people.filter((p) => p.active))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project')
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
        setNotice('Project created. Assign crew and site contacts next.')
      } else if (projectId) {
        await updateProject(projectId, payload)
        if (remote) await refreshRemote()
        setNotice('Project saved.')
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

  async function onDeleteProject() {
    if (!projectId || isNew) return
    if (!confirm('Delete this project and its logs/photos/notices? This cannot be undone.')) return
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
            All projects
          </Link>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{title}</h2>
        </div>
        {!isNew && (
          <Button type="button" variant="danger" size="sm" onClick={() => void onDeleteProject()}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      {!isNew && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['details', 'Details'],
              ['crew', 'Crew assignments'],
              ['contacts', 'Site contacts'],
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
            <SectionHeader title="Project details" subtitle="Visible to assigned crew in the field app" />
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
                Project name
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
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as ProjectInput['status'])}
                  className={fieldClass}
                >
                  {JOB_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
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
            {saving ? 'Saving…' : isNew ? 'Create project' : 'Save project'}
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

      {!isNew && tab === 'photos' && projectId && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader
              title="Project photos"
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
            <p className="text-sm text-ink-muted">No photos linked to this project yet.</p>
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
