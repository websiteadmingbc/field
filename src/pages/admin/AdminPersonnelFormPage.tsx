import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import {
  createCompany,
  emptyCompanyInput,
  fetchCompanies,
  type CompanyInput,
} from '../../lib/supabase/companies'
import {
  createPersonnel,
  fetchPersonnel,
  fetchPersonnelAffiliations,
  fetchPersonnelList,
  fetchPersonnelSensitive,
  updatePersonnel,
} from '../../lib/supabase/personnel'
import { canManageUsers } from '../../types/auth'
import type {
  Company,
  PersonnelClassification,
  PersonnelInput,
  PersonnelListItem,
  SensitiveInput,
} from '../../types/personnel'
import {
  CLASSIFICATION_LABELS,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPES,
  CONTACT_METHOD_LABELS,
  emptyPersonnelInput,
  emptySensitiveInput,
  PERSONNEL_CLASSIFICATIONS,
  PERSONNEL_STATUSES,
  PREFERRED_CONTACT_METHODS,
  personnelToInput,
  STATUS_LABELS,
} from '../../types/personnel'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line disabled:opacity-60'

const textareaClass =
  'mt-1.5 min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line disabled:opacity-60'

export function AdminPersonnelFormPage() {
  const { personnelId } = useParams()
  const isNew = !personnelId || personnelId === 'new'
  const navigate = useNavigate()
  const { profile, ready } = useAuth()
  const canEdit = canManageUsers(profile?.app_role)

  const [form, setForm] = useState<PersonnelInput>(emptyPersonnelInput())
  const [sensitive, setSensitive] = useState<SensitiveInput>(emptySensitiveInput())
  const [companies, setCompanies] = useState<Company[]>([])
  const [reportsOptions, setReportsOptions] = useState<PersonnelListItem[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [companyForm, setCompanyForm] = useState<CompanyInput>(emptyCompanyInput())
  const [companySaving, setCompanySaving] = useState(false)

  // Browser refresh/close only — useBlocker needs a data router (we use BrowserRouter)
  useEffect(() => {
    if (!dirty || saving) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, saving])

  const load = useCallback(async () => {
    if (isNew) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [person, affs, sens, comps, all] = await Promise.all([
        fetchPersonnel(personnelId!),
        fetchPersonnelAffiliations(personnelId!),
        fetchPersonnelSensitive(personnelId!),
        fetchCompanies(),
        fetchPersonnelList({ includeArchived: true }),
      ])
      if (!person) {
        setError('Personnel record not found')
        return
      }
      const primary = affs.find((a) => a.is_primary) ?? affs[0]
      setForm(personnelToInput(person, primary?.company_id ?? null))
      if (sens) {
        setSensitive({
          personal_email: sens.personal_email,
          emergency_contact_name: sens.emergency_contact_name,
          emergency_contact_relationship: sens.emergency_contact_relationship,
          emergency_contact_phone: sens.emergency_contact_phone,
          internal_notes: sens.internal_notes,
        })
      }
      setCompanies(comps)
      setReportsOptions(all.filter((p) => p.id !== personnelId))
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [isNew, personnelId])

  useEffect(() => {
    void (async () => {
      if (isNew) {
        try {
          const [comps, all] = await Promise.all([
            fetchCompanies(),
            fetchPersonnelList({ includeArchived: true }),
          ])
          setCompanies(comps)
          setReportsOptions(all)
        } catch {
          /* ignore */
        }
      } else {
        await load()
      }
    })()
  }, [isNew, load])

  useEffect(() => {
    if (!ready) return
    if (!canEdit) {
      navigate(isNew ? '/admin/people' : `/admin/people/${personnelId}`, { replace: true })
    }
  }, [ready, canEdit, isNew, navigate, personnelId])

  function patchForm(partial: Partial<PersonnelInput>) {
    setForm((f) => ({ ...f, ...partial }))
    setDirty(true)
  }

  function patchSensitive(partial: Partial<SensitiveInput>) {
    setSensitive((s) => ({ ...s, ...partial }))
    setDirty(true)
  }

  const showEmploymentExtras = useMemo(
    () =>
      form.classification === 'employee' ||
      form.classification === 'administrator' ||
      form.classification === 'project_manager',
    [form.classification],
  )

  const showContractorExtras = useMemo(
    () =>
      form.classification === 'independent_contractor' ||
      form.classification === 'subcontractor' ||
      form.classification === 'consultant' ||
      form.classification === 'vendor_contact',
    [form.classification],
  )

  const showTerritory = form.classification === 'sales_representative'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    if (!form.first_name.trim() || !form.last_name.trim() || !form.job_title.trim()) {
      setError('First name, last name, and job title are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const created = await createPersonnel(form, sensitive, profile?.id)
        setDirty(false)
        navigate(`/admin/people/${created.id}`, { replace: true })
      } else {
        await updatePersonnel(personnelId!, form, sensitive, profile?.id)
        setDirty(false)
        navigate(`/admin/people/${personnelId}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreateCompany(e: FormEvent) {
    e.preventDefault()
    if (!companyForm.name.trim()) return
    setCompanySaving(true)
    try {
      const created = await createCompany(companyForm)
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      patchForm({ company_id: created.id })
      setShowCompanyModal(false)
      setCompanyForm(emptyCompanyInput())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create company')
    } finally {
      setCompanySaving(false)
    }
  }

  if (loading) {
    return (
      <p className="animate-fade-up text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Loading…
      </p>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up stagger-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={isNew ? '/admin/people' : `/admin/people/${personnelId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
          onClick={(e) => {
            if (dirty && !window.confirm('Discard unsaved changes?')) {
              e.preventDefault()
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <SectionHeader
        title={isNew ? 'Add Personnel' : 'Edit Personnel'}
        subtitle="Personnel type is independent of app permissions."
      />

      {dirty && (
        <p className="text-xs font-semibold uppercase tracking-wider text-amber">
          Unsaved changes
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {error && (
          <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        <Card className="space-y-4 p-5">
          <SectionHeader title="Personal & contact" subtitle="Section A" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="First name" required>
              <input
                required
                value={form.first_name}
                onChange={(e) => patchForm({ first_name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Middle name">
              <input
                value={form.middle_name}
                onChange={(e) => patchForm({ middle_name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Last name" required>
              <input
                required
                value={form.last_name}
                onChange={(e) => patchForm({ last_name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Preferred name">
              <input
                value={form.preferred_name}
                onChange={(e) => patchForm({ preferred_name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Work email">
              <input
                type="email"
                value={form.work_email}
                onChange={(e) => patchForm({ work_email: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Mobile phone">
              <input
                value={form.mobile_phone}
                onChange={(e) => patchForm({ mobile_phone: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Work phone">
              <input
                value={form.work_phone}
                onChange={(e) => patchForm({ work_phone: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Preferred contact">
              <select
                value={form.preferred_contact_method ?? ''}
                onChange={(e) =>
                  patchForm({
                    preferred_contact_method: (e.target.value || null) as PersonnelInput['preferred_contact_method'],
                  })
                }
                className={fieldClass}
              >
                <option value="">—</option>
                {PREFERRED_CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {CONTACT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mailing address" className="sm:col-span-2 lg:col-span-3">
              <input
                value={form.business_address}
                onChange={(e) => patchForm({ business_address: e.target.value })}
                placeholder="Work or mailing address — not home"
                className={fieldClass}
              />
            </Field>
            <Field label="City">
              <input
                value={form.city}
                onChange={(e) => patchForm({ city: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="State">
              <input
                value={form.state}
                onChange={(e) => patchForm({ state: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="ZIP">
              <input
                value={form.zip}
                onChange={(e) => patchForm({ zip: e.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>

          {canEdit && (
            <div className="mt-4 space-y-3 rounded-md border border-gold-line/30 bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Restricted — managers only
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Personal email">
                  <input
                    type="email"
                    value={sensitive.personal_email}
                    onChange={(e) => patchSensitive({ personal_email: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Emergency contact name">
                  <input
                    value={sensitive.emergency_contact_name}
                    onChange={(e) => patchSensitive({ emergency_contact_name: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Emergency relationship">
                  <input
                    value={sensitive.emergency_contact_relationship}
                    onChange={(e) =>
                      patchSensitive({ emergency_contact_relationship: e.target.value })
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Emergency phone">
                  <input
                    value={sensitive.emergency_contact_phone}
                    onChange={(e) => patchSensitive({ emergency_contact_phone: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <SectionHeader title="Employment & role" subtitle="Section B" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Personnel type" required>
              <select
                required
                value={form.classification}
                onChange={(e) =>
                  patchForm({ classification: e.target.value as PersonnelClassification })
                }
                className={fieldClass}
              >
                {PERSONNEL_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICATION_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job title" required>
              <input
                required
                value={form.job_title}
                onChange={(e) => patchForm({ job_title: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  patchForm({ status: e.target.value as PersonnelInput['status'] })
                }
                className={fieldClass}
              >
                {PERSONNEL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            {showEmploymentExtras && (
              <Field label="Department">
                <input
                  value={form.department}
                  onChange={(e) => patchForm({ department: e.target.value })}
                  className={fieldClass}
                />
              </Field>
            )}
            <Field label="Primary role">
              <input
                value={form.primary_role}
                onChange={(e) => patchForm({ primary_role: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Additional roles (comma-separated)">
              <input
                value={form.additional_roles.join(', ')}
                onChange={(e) =>
                  patchForm({
                    additional_roles: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Reports to">
              <select
                value={form.reports_to ?? ''}
                onChange={(e) => patchForm({ reports_to: e.target.value || null })}
                className={fieldClass}
              >
                <option value="">—</option>
                {reportsOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => patchForm({ start_date: e.target.value || null })}
                className={fieldClass}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={form.end_date ?? ''}
                onChange={(e) => patchForm({ end_date: e.target.value || null })}
                className={fieldClass}
              />
            </Field>
            <Field label="Work arrangement">
              <input
                value={form.work_arrangement}
                onChange={(e) => patchForm({ work_arrangement: e.target.value })}
                placeholder="Full-time, contract…"
                className={fieldClass}
              />
            </Field>
            <Field label="Primary work location">
              <input
                value={form.primary_work_location}
                onChange={(e) => patchForm({ primary_work_location: e.target.value })}
                className={fieldClass}
              />
            </Field>
            {(showTerritory || showContractorExtras) && (
              <Field label="Service territory">
                <input
                  value={form.service_territory}
                  onChange={(e) => patchForm({ service_territory: e.target.value })}
                  className={fieldClass}
                />
              </Field>
            )}
            <Field label="Availability">
              <input
                value={form.availability}
                onChange={(e) => patchForm({ availability: e.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>
          {canEdit && (
            <Field label="Internal notes (restricted)">
              <textarea
                value={sensitive.internal_notes}
                onChange={(e) => patchSensitive({ internal_notes: e.target.value })}
                className={textareaClass}
              />
            </Field>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <SectionHeader title="Company affiliation" subtitle="Section C" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1 text-sm font-semibold">
              Company
              <select
                value={form.company_id ?? ''}
                onChange={(e) => patchForm({ company_id: e.target.value || null })}
                className={fieldClass}
              >
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({COMPANY_TYPE_LABELS[c.company_type]})
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" onClick={() => setShowCompanyModal(true)}>
              <Plus className="h-4 w-4" />
              New company
            </Button>
          </div>
          {showContractorExtras && (
            <p className="text-sm text-ink-muted">
              For subcontractors and vendors, affiliate the company here. Licensing and insurance
              stay on the company or compliance records — not duplicated on every person.
            </p>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create personnel' : 'Save changes'}
          </Button>
          <Link
            to={isNew ? '/admin/people' : `/admin/people/${personnelId}`}
            onClick={(e) => {
              if (dirty && !window.confirm('Discard unsaved changes?')) {
                e.preventDefault()
              }
            }}
          >
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <Card className="w-full max-w-lg space-y-4 p-5">
            <SectionHeader
              title="Create company"
              subtitle="Minimal record for personnel affiliation"
            />
            <form onSubmit={onCreateCompany} className="space-y-3">
              <Field label="Company name" required>
                <input
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="Company type">
                <select
                  value={companyForm.company_type}
                  onChange={(e) =>
                    setCompanyForm((f) => ({
                      ...f,
                      company_type: e.target.value as CompanyInput['company_type'],
                    }))
                  }
                  className={fieldClass}
                >
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {COMPANY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business phone">
                  <input
                    value={companyForm.business_phone}
                    onChange={(e) =>
                      setCompanyForm((f) => ({ ...f, business_phone: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Business email">
                  <input
                    type="email"
                    value={companyForm.business_email}
                    onChange={(e) =>
                      setCompanyForm((f) => ({ ...f, business_email: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
              <Field label="Trade / specialty">
                <input
                  value={companyForm.trade_specialty}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, trade_specialty: e.target.value }))
                  }
                  className={fieldClass}
                />
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={companySaving}>
                  <Building2 className="h-4 w-4" />
                  {companySaving ? 'Creating…' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCompanyModal(false)}
                >
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

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`text-sm font-semibold ${className ?? ''}`}>
      {label}
      {required ? <span className="text-rose"> *</span> : null}
      {children}
    </label>
  )
}
