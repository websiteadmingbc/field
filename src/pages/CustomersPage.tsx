import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Mail, Pencil, Phone } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  fetchSiteContact,
  upsertSiteContact,
  type SiteContactRow,
} from '../lib/supabase/admin'
import { emailHref, phoneHref } from '../lib/utils'
import { canAccessAdminConsole } from '../types/auth'
import type { Contact, Job } from '../types'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-gold-line'

/**
 * Customer contacts = project site contacts (homeowners, GCs, inspectors).
 * Kept separate from Team Directory (internal crew).
 */
export function CustomersPage() {
  const { data, getJob, refreshRemote, remote } = useApp()
  const { profile } = useAuth()
  const canEdit = canAccessAdminConsole(profile?.app_role)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<SiteContactRow | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    contact_role: '',
    phone: '',
    email: '',
    is_primary: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const customers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.contacts
      .filter((c) => !c.isCrew)
      .map((c) => {
        const jobs = (c.associatedJobIds ?? []).map((id) => getJob(id)).filter(Boolean) as Job[]
        return { contact: c, jobs }
      })
      .filter(({ contact, jobs }) => {
        if (!q) return true
        const jobText = jobs.map((j) => `${j.name} ${j.jobNumber} ${j.customer}`).join(' ')
        return `${contact.name} ${contact.role} ${contact.phone} ${contact.email ?? ''} ${jobText}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name))
  }, [data.contacts, getJob, query])

  async function openEdit(contact: Contact) {
    if (!canEdit) return
    setError(null)
    setNotice(null)
    try {
      const row = await fetchSiteContact(contact.id)
      if (!row) {
        setError('Contact not found.')
        return
      }
      setEditing(row)
      setForm({
        full_name: row.full_name,
        contact_role: row.contact_role,
        phone: row.phone,
        email: row.email ?? '',
        is_primary: row.is_primary,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contact')
    }
  }

  function closeEdit() {
    setEditing(null)
    setError(null)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!editing || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      if (!form.full_name.trim()) throw new Error('Name is required.')
      await upsertSiteContact({
        id: editing.id,
        project_id: editing.project_id,
        full_name: form.full_name.trim(),
        contact_role: form.contact_role.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        is_primary: form.is_primary,
      })
      if (remote) await refreshRemote()
      setNotice(`${form.full_name.trim()} updated.`)
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Customers</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Homeowners, clients, and other site contacts tied to jobs — not Great Britton crew.
        </p>
      </header>

      {notice && (
        <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald">
          {notice}
        </p>
      )}
      {error && !editing && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      <div className="animate-fade-up stagger-1">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, role, or job…"
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={query ? 'No matches' : 'No customer contacts yet'}
          description={
            query
              ? 'Try another search term.'
              : 'Add site contacts on a job in Operations → Projects.'
          }
        />
      ) : (
        <ul className="space-y-3 animate-fade-up stagger-2">
          {customers.map(({ contact, jobs }) => {
            const primaryJob = jobs[0]
            return (
              <li key={contact.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-ink">
                          {contact.name}
                        </h2>
                        <span className="text-xs font-semibold uppercase tracking-wider text-teal">
                          {contact.role || 'Customer'}
                        </span>
                      </div>

                      {primaryJob && (
                        <p className="mt-2 text-sm text-ink-muted">
                          <span className="font-semibold text-ink">
                            {primaryJob.customer || contact.name}
                          </span>
                          {primaryJob.customer && primaryJob.customer !== contact.name
                            ? ` · contact on file`
                            : null}
                        </p>
                      )}

                      <div className="mt-3 space-y-1.5">
                        {jobs.map((job) => (
                          <div key={job.id} className="text-sm">
                            <Link
                              to={`/jobs/${job.id}`}
                              className="font-semibold text-teal hover:underline"
                            >
                              {job.jobNumber} — {job.name}
                            </Link>
                            {(job.address || job.city) && (
                              <p className="text-ink-muted">
                                {[job.address, job.city, job.state].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      {canEdit && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => void openEdit(contact)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      {contact.phone && (
                        <a href={phoneHref(contact.phone)} className="sm:text-right">
                          <Button size="sm" variant="outline" className="w-full sm:w-auto">
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </Button>
                        </a>
                      )}
                      {contact.email && (
                        <a href={emailHref(contact.email)}>
                          <Button size="sm" variant="ghost" className="w-full sm:w-auto">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-title"
        >
          <Card className="w-full max-w-lg space-y-4 p-5">
            <SectionHeader title="Edit customer contact" subtitle="Updates this job’s site contact" />
            <p id="edit-customer-title" className="sr-only">
              Edit {editing.full_name}
            </p>
            <form onSubmit={onSave} className="space-y-3">
              {error && (
                <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
                  {error}
                </p>
              )}
              <label className="block text-sm font-semibold">
                Name
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-semibold">
                Role
                <input
                  value={form.contact_role}
                  onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))}
                  placeholder="Homeowner, GC, Inspector…"
                  className={fieldClass}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--bf-gold-fill)]"
                />
                Primary contact for this job
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
