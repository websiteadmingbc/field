import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  FileUp,
  Link2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { APP_ROLE_OPTIONS, updateProfile } from '../../lib/supabase/admin'
import { getSupabase } from '../../lib/supabase/client'
import {
  archivePersonnel,
  deleteCertification,
  deleteInsurance,
  deleteLicense,
  deletePersonnel,
  deletePersonnelDocument,
  deletePersonnelProjectAssignment,
  fetchActivity,
  fetchCertifications,
  fetchDocuments,
  fetchInsurance,
  fetchLicenses,
  fetchLinkedProfile,
  fetchLinkedUserAssignments,
  fetchPersonnel,
  fetchPersonnelAffiliations,
  fetchPersonnelProjectAssignments,
  fetchPersonnelSensitive,
  fetchSkills,
  getDocumentSignedUrl,
  invitePersonnelToApp,
  isExpired,
  isExpiringSoon,
  personnelAvatarPublicUrl,
  setPersonnelWebsitePublished,
  upsertCertification,
  upsertInsurance,
  upsertLicense,
  upsertPersonnelProjectAssignment,
  upsertSkills,
  uploadPersonnelDocument,
} from '../../lib/supabase/personnel'
import { cn, formatRelative, formatShortDate } from '../../lib/utils'
import type { AppRole, Profile } from '../../types/auth'
import { canManageUsers, roleLabel } from '../../types/auth'
import type {
  Company,
  DocumentCategory,
  InsurancePolicy,
  License,
  Personnel,
  PersonnelActivity,
  PersonnelCertification,
  PersonnelDocument,
  PersonnelProjectAssignment,
  PersonnelSensitive,
  PersonnelSkill,
  VerificationStatus,
} from '../../types/personnel'
import {
  CLASSIFICATION_LABELS,
  COMPANY_TYPE_LABELS,
  CONTACT_METHOD_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  WEBSITE_CATEGORY_LABELS,
  personnelDisplayName,
  statusToneClass,
} from '../../types/personnel'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-gold-line'

type TabKey =
  | 'overview'
  | 'skills'
  | 'projects'
  | 'compliance'
  | 'documents'
  | 'access'
  | 'activity'

export function AdminPersonnelDetailPage() {
  const { personnelId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const canEdit = canManageUsers(profile?.app_role)

  const [person, setPerson] = useState<Personnel | null>(null)
  const [sensitive, setSensitive] = useState<PersonnelSensitive | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [linked, setLinked] = useState<Profile | null>(null)
  const [skills, setSkills] = useState<PersonnelSkill | null>(null)
  const [certs, setCerts] = useState<PersonnelCertification[]>([])
  const [assignments, setAssignments] = useState<PersonnelProjectAssignment[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([])
  const [docs, setDocs] = useState<PersonnelDocument[]>([])
  const [activity, setActivity] = useState<PersonnelActivity[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; job_number: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const [inviteRole, setInviteRole] = useState<AppRole>('tradesperson')
  const [inviting, setInviting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const load = useCallback(async () => {
    if (!personnelId) return
    setLoading(true)
    setError(null)
    try {
      const p = await fetchPersonnel(personnelId)
      if (!p) {
        setError('Personnel not found')
        setPerson(null)
        return
      }
      setPerson(p)

      const [affs, sens, sk, ct, pa, lic, ins, documents, act] = await Promise.all([
        fetchPersonnelAffiliations(personnelId),
        canEdit ? fetchPersonnelSensitive(personnelId) : Promise.resolve(null),
        fetchSkills(personnelId),
        fetchCertifications(personnelId),
        fetchPersonnelProjectAssignments(personnelId),
        canEdit ? fetchLicenses(personnelId) : Promise.resolve([]),
        canEdit ? fetchInsurance(personnelId) : Promise.resolve([]),
        canEdit ? fetchDocuments(personnelId) : Promise.resolve([]),
        fetchActivity(personnelId),
      ])

      const primary = affs.find((a) => a.is_primary) ?? affs[0]
      setCompany(primary?.company ?? null)
      setSensitive(sens)
      setSkills(sk)
      setCerts(ct)
      setLicenses(lic)
      setInsurance(ins)
      setDocs(documents)
      setActivity(act)

      let combined = pa
      if (p.linked_user_id) {
        const [lp, linkedAssign] = await Promise.all([
          fetchLinkedProfile(p.linked_user_id),
          fetchLinkedUserAssignments(p.linked_user_id),
        ])
        setLinked(lp)
        const existingIds = new Set(pa.map((a) => a.project_id))
        combined = [...pa, ...linkedAssign.filter((a) => !existingIds.has(a.project_id))]
      } else {
        setLinked(null)
      }
      setAssignments(combined)

      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase
          .from('projects')
          .select('id, name, job_number')
          .order('name', { ascending: true })
        setProjects((data ?? []) as { id: string; name: string; job_number: string }[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [personnelId, canEdit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const fromNav = (location.state as { notice?: string } | null)?.notice
    if (fromNav) {
      setNotice(fromNav)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  const displayName = useMemo(
    () => (person ? personnelDisplayName(person) : ''),
    [person],
  )

  const avatarUrl = useMemo(
    () => (person ? personnelAvatarPublicUrl(person.avatar_path) : null),
    [person],
  )

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    if (!person || !canEdit || !person.work_email) return
    setInviting(true)
    setError(null)
    setNotice(null)
    try {
      await invitePersonnelToApp({
        personnelId: person.id,
        email: person.work_email,
        full_name: displayName,
        title: person.job_title,
        phone: person.mobile_phone || person.work_phone,
        app_role: inviteRole,
        actorId: profile?.id,
      })
      setNotice('Invite sent. App account will link when the profile is available.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  async function onArchive() {
    if (!person || !canEdit) return
    if (!confirm(`Archive ${displayName}? They can be filtered as Archived later.`)) return
    try {
      await archivePersonnel(person.id, profile?.id)
      setNotice('Personnel archived.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    }
  }

  const deleteConfirmMatches = useMemo(() => {
    if (!person) return false
    const typed = deleteConfirmText.trim()
    return (
      typed.localeCompare(person.personnel_code, undefined, { sensitivity: 'accent' }) === 0
    )
  }, [deleteConfirmText, person])

  async function onConfirmDelete() {
    if (!person || !canEdit || !deleteConfirmMatches) return
    setDeleting(true)
    setError(null)
    try {
      await deletePersonnel(person, profile?.id)
      navigate('/admin/people', {
        replace: true,
        state: { notice: `${displayName} (${person.personnel_code}) was permanently deleted.` },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setShowDeleteModal(false)
      setDeleteConfirmText('')
    } finally {
      setDeleting(false)
    }
  }

  async function onConfirmPublish() {
    if (!person || !canEdit) return
    setPublishing(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await setPersonnelWebsitePublished(person.id, true, profile?.id ?? null)
      setPerson(updated)
      setShowPublishModal(false)
      setNotice('Published to greatbrittongc.com crew directory.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function onUnpublish() {
    if (!person || !canEdit) return
    if (!confirm(`Remove ${displayName} from the public website directory?`)) return
    setPublishing(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await setPersonnelWebsitePublished(person.id, false, profile?.id ?? null)
      setPerson(updated)
      setNotice('Removed from the public website directory.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unpublish failed')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <p className="animate-fade-up text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Loading…
      </p>
    )
  }

  if (!person) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-sm text-rose">{error ?? 'Not found'}</p>
        <Link to="/admin/people">
          <Button variant="outline">Back to directory</Button>
        </Link>
      </Card>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'skills', label: 'Skills' },
    { key: 'projects', label: 'Projects' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'documents', label: 'Documents' },
    { key: 'access', label: 'System Access' },
    { key: 'activity', label: 'Activity' },
  ]

  return (
    <div className="space-y-6 animate-fade-up stagger-2">
      <Link
        to="/admin/people"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Personnel directory
      </Link>

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

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-1 ring-gold-line/40"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-soft text-lg font-bold uppercase text-teal">
              {initials(displayName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold uppercase tracking-[0.04em] text-ink">
                {displayName}
              </h2>
              <span
                className={cn(
                  'inline-flex rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                  statusToneClass(person.status),
                )}
              >
                {STATUS_LABELS[person.status]}
              </span>
              {person.website_published ? (
                <span className="inline-flex rounded-sm bg-emerald-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald">
                  On website
                </span>
              ) : person.website_category ? (
                <span className="inline-flex rounded-sm bg-amber-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber">
                  Website draft
                </span>
              ) : null}
            </div>
            {person.preferred_name && (
              <p className="text-sm text-ink-muted">Preferred: {person.preferred_name}</p>
            )}
            <p className="mt-1 font-mono text-xs text-ink-muted">{person.personnel_code}</p>
            <p className="mt-2 text-sm text-ink">
              {person.job_title || 'No title'} · {CLASSIFICATION_LABELS[person.classification]}
            </p>
            {person.website_category && (
              <p className="text-sm text-ink-muted">
                Website category: {WEBSITE_CATEGORY_LABELS[person.website_category]}
                {person.website_slug ? ` · /crew/${person.website_slug}/` : ''}
              </p>
            )}
            {company && (
              <p className="text-sm text-ink-muted">
                {company.name} ({COMPANY_TYPE_LABELS[company.company_type]})
              </p>
            )}
            <p className="mt-2 text-sm text-ink-muted">
              {person.mobile_phone || person.work_phone || 'No phone'}
              {person.work_email ? ` · ${person.work_email}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <Link to={`/admin/people/${person.id}/edit`}>
                  <Button type="button">
                    <Pencil className="h-4 w-4" />
                    Edit Profile
                  </Button>
                </Link>
                {person.website_published ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={publishing}
                    onClick={() => void onUnpublish()}
                  >
                    Unpublish website
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={publishing}
                    onClick={() => setShowPublishModal(true)}
                  >
                    Publish to website
                  </Button>
                )}
                {person.status !== 'archived' && (
                  <Button type="button" variant="outline" onClick={() => void onArchive()}>
                    Archive
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeleteConfirmText('')
                    setShowDeleteModal(true)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {showPublishModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-personnel-title"
        >
          <Card className="w-full max-w-lg space-y-4 p-5">
            <SectionHeader
              title="Publish to website"
              subtitle="Confirm before this person appears on greatbrittongc.com"
            />
            <div id="publish-personnel-title" className="space-y-2 text-sm text-ink">
              <p>
                Publish <span className="font-semibold">{displayName}</span> to the public crew
                directory?
              </p>
              <ul className="list-disc space-y-1 pl-5 text-ink-muted">
                <li>
                  Category:{' '}
                  <span className="font-semibold text-ink">
                    {person.website_category
                      ? WEBSITE_CATEGORY_LABELS[person.website_category]
                      : 'Not set — edit profile first'}
                  </span>
                </li>
                <li>
                  Photo:{' '}
                  <span className="font-semibold text-ink">
                    {person.avatar_path ? 'Ready' : 'Missing — required'}
                  </span>
                </li>
                <li>Only name, title, photo, badge ID, and category are shown publicly.</li>
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={publishing}
                onClick={() => setShowPublishModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={publishing || !person.website_category || !person.avatar_path}
                onClick={() => void onConfirmPublish()}
              >
                {publishing ? 'Publishing…' : 'Confirm publish'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-personnel-title"
        >
          <Card className="w-full max-w-lg space-y-4 p-5">
            <SectionHeader
              title="Delete personnel"
              subtitle="This permanently removes the directory record"
            />
            <div id="delete-personnel-title" className="space-y-2 text-sm text-ink">
              <p>
                You are about to permanently delete{' '}
                <span className="font-semibold">{displayName}</span> (
                <span className="font-mono text-xs">{person.personnel_code}</span>).
              </p>
              <ul className="list-disc space-y-1 pl-5 text-ink-muted">
                <li>Contact info, affiliations, skills, compliance, and documents are removed.</li>
                <li>Any linked Field app account is <span className="font-semibold text-ink">not</span> deleted.</li>
                <li>Prefer <span className="font-semibold text-ink">Archive</span> if you may need this record later.</li>
              </ul>
              <p className="pt-1 font-semibold text-rose">
                Type the personnel ID <span className="font-mono">{person.personnel_code}</span> to
                confirm.
              </p>
            </div>
            <label className="block text-sm font-semibold">
              Personnel ID
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={person.personnel_code}
                className={fieldClass}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="danger"
                disabled={!deleteConfirmMatches || deleting}
                onClick={() => void onConfirmDelete()}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
              tab === t.key
                ? 'bg-teal-fill text-on-teal'
                : 'border border-gold-line/40 bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <OverviewSection person={person} sensitive={sensitive} company={company} canEdit={canEdit} />
      )}
      {tab === 'skills' && (
        <SkillsSection
          personnelId={person.id}
          skills={skills}
          certs={certs}
          canEdit={canEdit}
          actorId={profile?.id}
          onRefresh={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'projects' && (
        <ProjectsSection
          personnelId={person.id}
          assignments={assignments}
          projects={projects}
          canEdit={canEdit}
          actorId={profile?.id}
          onRefresh={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'compliance' && (
        <ComplianceSection
          personnelId={person.id}
          licenses={licenses}
          insurance={insurance}
          canEdit={canEdit}
          actorId={profile?.id}
          onRefresh={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'documents' && (
        <DocumentsSection
          personnelId={person.id}
          docs={docs}
          canEdit={canEdit}
          actorId={profile?.id}
          onRefresh={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'access' && (
        <AccessSection
          person={person}
          linked={linked}
          canEdit={canEdit}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviting={inviting}
          onInvite={onInvite}
          onRefresh={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'activity' && <ActivitySection activity={activity} />}
    </div>
  )
}

function OverviewSection({
  person,
  sensitive,
  company,
  canEdit,
}: {
  person: Personnel
  sensitive: PersonnelSensitive | null
  company: Company | null
  canEdit: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <SectionHeader title="Contact" subtitle="Section A" />
        <Dl
          rows={[
            ['Work email', person.work_email || '—'],
            ['Mobile', person.mobile_phone || '—'],
            ['Work phone', person.work_phone || '—'],
            [
              'Preferred',
              person.preferred_contact_method
                ? CONTACT_METHOD_LABELS[person.preferred_contact_method]
                : '—',
            ],
            [
              'Mailing address',
              [person.business_address, person.city, person.state, person.zip]
                .filter(Boolean)
                .join(', ') || '—',
            ],
          ]}
        />
        {canEdit && sensitive && (
          <div className="mt-4 rounded-md border border-gold-line/30 bg-surface-raised p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Restricted
            </p>
            <Dl
              rows={[
                ['Personal email', sensitive.personal_email || '—'],
                ['Emergency contact', sensitive.emergency_contact_name || '—'],
                ['Relationship', sensitive.emergency_contact_relationship || '—'],
                ['Emergency phone', sensitive.emergency_contact_phone || '—'],
              ]}
            />
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <SectionHeader title="Employment" subtitle="Section B" />
        <Dl
          rows={[
            ['Personnel type', CLASSIFICATION_LABELS[person.classification]],
            ['Job title', person.job_title || '—'],
            ['Department', person.department || '—'],
            ['Primary role', person.primary_role || '—'],
            [
              'Additional roles',
              person.additional_roles?.length ? person.additional_roles.join(', ') : '—',
            ],
            ['Status', STATUS_LABELS[person.status]],
            ['Start', person.start_date ? formatShortDate(person.start_date) : '—'],
            ['End', person.end_date ? formatShortDate(person.end_date) : '—'],
            ['Arrangement', person.work_arrangement || '—'],
            ['Location', person.primary_work_location || '—'],
            ['Territory', person.service_territory || '—'],
            ['Availability', person.availability || '—'],
          ]}
        />
        {canEdit && sensitive?.internal_notes && (
          <div className="mt-3 rounded-md border border-border bg-surface-raised p-3 text-sm text-ink-muted">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Internal notes
            </p>
            <p className="mt-1 whitespace-pre-wrap">{sensitive.internal_notes}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5 lg:col-span-2">
        <SectionHeader title="Company affiliation" subtitle="Section C" />
        {company ? (
          <Dl
            rows={[
              ['Company', company.name],
              ['Type', COMPANY_TYPE_LABELS[company.company_type]],
              ['Phone', company.business_phone || '—'],
              ['Email', company.business_email || '—'],
              ['Trade', company.trade_specialty || '—'],
            ]}
          />
        ) : (
          <p className="text-sm text-ink-muted">No company affiliation.</p>
        )}
      </Card>
    </div>
  )
}

function SkillsSection({
  personnelId,
  skills,
  certs,
  canEdit,
  actorId,
  onRefresh,
  onError,
}: {
  personnelId: string
  skills: PersonnelSkill | null
  certs: PersonnelCertification[]
  canEdit: boolean
  actorId?: string
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  const [trade, setTrade] = useState(skills?.primary_trade ?? '')
  const [secondary, setSecondary] = useState((skills?.secondary_trades ?? []).join(', '))
  const [specialties, setSpecialties] = useState((skills?.specialties ?? []).join(', '))
  const [notes, setNotes] = useState(skills?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [certForm, setCertForm] = useState({
    name: '',
    issuer: '',
    certification_number: '',
    issue_date: '',
    expiration_date: '',
    verification_status: 'pending_verification' as VerificationStatus,
  })

  useEffect(() => {
    setTrade(skills?.primary_trade ?? '')
    setSecondary((skills?.secondary_trades ?? []).join(', '))
    setSpecialties((skills?.specialties ?? []).join(', '))
    setNotes(skills?.notes ?? '')
  }, [skills])

  async function saveSkills(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setSaving(true)
    try {
      await upsertSkills(
        personnelId,
        {
          primary_trade: trade,
          secondary_trades: splitList(secondary),
          specialties: splitList(specialties),
          notes,
        },
        actorId,
      )
      onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function addCert(e: FormEvent) {
    e.preventDefault()
    if (!canEdit || !certForm.name.trim()) return
    try {
      await upsertCertification(
        {
          personnel_id: personnelId,
          name: certForm.name,
          issuer: certForm.issuer,
          certification_number: certForm.certification_number,
          issue_date: certForm.issue_date || null,
          expiration_date: certForm.expiration_date || null,
          verification_status: certForm.verification_status,
          verification_date: null,
          notes: '',
        },
        actorId,
      )
      setCertForm({
        name: '',
        issuer: '',
        certification_number: '',
        issue_date: '',
        expiration_date: '',
        verification_status: 'pending_verification',
      })
      onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add certification')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <SectionHeader title="Skills & trades" subtitle="Section D" />
        <form onSubmit={saveSkills} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Primary trade
            <input
              value={trade}
              disabled={!canEdit}
              onChange={(e) => setTrade(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Secondary trades
            <input
              value={secondary}
              disabled={!canEdit}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder="Comma-separated"
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Skills / specialties
            <input
              value={specialties}
              disabled={!canEdit}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="Comma-separated"
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Notes
            <input
              value={notes}
              disabled={!canEdit}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
            />
          </label>
          {canEdit && (
            <div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save skills'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <SectionHeader title="Certifications" />
        {certs.length === 0 ? (
          <p className="text-sm text-ink-muted">No certifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {certs.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">
                    {c.issuer || 'No issuer'}
                    {c.certification_number ? ` · #${c.certification_number}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {VERIFICATION_LABELS[c.verification_status]}
                    {c.expiration_date
                      ? ` · Exp ${formatShortDate(c.expiration_date)}${
                          isExpired(c.expiration_date)
                            ? ' (expired)'
                            : isExpiringSoon(c.expiration_date)
                              ? ' (soon)'
                              : ''
                        }`
                      : ''}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void deleteCertification(c.id, personnelId, actorId).then(onRefresh)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={addCert} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Certification name
              <input
                required
                value={certForm.name}
                onChange={(e) => setCertForm((f) => ({ ...f, name: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Issuer
              <input
                value={certForm.issuer}
                onChange={(e) => setCertForm((f) => ({ ...f, issuer: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Number
              <input
                value={certForm.certification_number}
                onChange={(e) =>
                  setCertForm((f) => ({ ...f, certification_number: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Expiration
              <input
                type="date"
                value={certForm.expiration_date}
                onChange={(e) => setCertForm((f) => ({ ...f, expiration_date: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" />
                Add certification
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

function ProjectsSection({
  personnelId,
  assignments,
  projects,
  canEdit,
  actorId,
  onRefresh,
  onError,
}: {
  personnelId: string
  assignments: PersonnelProjectAssignment[]
  projects: { id: string; name: string; job_number: string }[]
  canEdit: boolean
  actorId?: string
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState('')

  async function addAssignment(e: FormEvent) {
    e.preventDefault()
    if (!canEdit || !projectId) return
    try {
      await upsertPersonnelProjectAssignment(
        {
          personnel_id: personnelId,
          project_id: projectId,
          assigned_role: role || 'crew',
          start_date: null,
          end_date: null,
          status: 'active',
        },
        actorId,
      )
      setProjectId('')
      setRole('')
      onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Assignment failed')
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <SectionHeader title="Project assignments" subtitle="Section E" />
      {assignments.length === 0 ? (
        <p className="text-sm text-ink-muted">No project assignments.</p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div>
                <Link
                  to={`/admin/projects/${a.project_id}`}
                  className="font-semibold text-ink hover:text-teal"
                >
                  {a.project?.name ?? 'Project'}{' '}
                  <span className="font-mono text-xs text-ink-muted">
                    {a.project?.job_number}
                  </span>
                </Link>
                <p className="text-xs text-ink-muted">
                  Role: {a.assigned_role || '—'} · {a.status}
                  {a.id.startsWith('linked-') ? ' · via app account' : ''}
                </p>
                {(a.project?.address || a.project?.city) && (
                  <p className="text-xs text-ink-muted">
                    {[a.project.address, a.project.city, a.project.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {canEdit && !a.id.startsWith('linked-') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void deletePersonnelProjectAssignment(a.id, personnelId, actorId).then(
                      onRefresh,
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={addAssignment} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <label className="min-w-[200px] flex-1 text-sm font-semibold">
            Project
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.job_number} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px] text-sm font-semibold">
            Assigned role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={fieldClass}
            />
          </label>
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            Assign
          </Button>
        </form>
      )}
    </Card>
  )
}

function ComplianceSection({
  personnelId,
  licenses,
  insurance,
  canEdit,
  actorId,
  onRefresh,
  onError,
}: {
  personnelId: string
  licenses: License[]
  insurance: InsurancePolicy[]
  canEdit: boolean
  actorId?: string
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  const [licForm, setLicForm] = useState({
    license_type: '',
    license_number: '',
    issuing_authority: '',
    expiration_date: '',
  })
  const [insForm, setInsForm] = useState({
    insurance_type: '',
    provider: '',
    policy_reference: '',
    coverage_expiration: '',
  })

  if (!canEdit) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-muted">
          Compliance records are restricted to Owner/Admin and General Manager.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <SectionHeader title="Licenses" subtitle="Section F" />
        {licenses.length === 0 ? (
          <p className="text-sm text-ink-muted">No licenses on file.</p>
        ) : (
          <ul className="space-y-2">
            {licenses.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-semibold">{l.license_type}</p>
                  <p className="text-xs text-ink-muted">
                    {l.license_number || 'No number'} · {l.issuing_authority || 'No authority'}
                  </p>
                  <ExpiryLine date={l.expiration_date} status={l.verification_status} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteLicense(l.id, personnelId, actorId).then(onRefresh)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void upsertLicense(
              {
                personnel_id: personnelId,
                company_id: null,
                license_type: licForm.license_type,
                license_number: licForm.license_number,
                issuing_authority: licForm.issuing_authority,
                license_classification: '',
                issue_date: null,
                expiration_date: licForm.expiration_date || null,
                verification_date: null,
                verification_status: 'pending_verification',
                notes: '',
              },
              actorId,
            )
              .then(() => {
                setLicForm({
                  license_type: '',
                  license_number: '',
                  issuing_authority: '',
                  expiration_date: '',
                })
                onRefresh()
              })
              .catch((err) => onError(err instanceof Error ? err.message : 'Failed'))
          }}
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold">
            License type
            <input
              required
              value={licForm.license_type}
              onChange={(e) => setLicForm((f) => ({ ...f, license_type: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Number
            <input
              value={licForm.license_number}
              onChange={(e) => setLicForm((f) => ({ ...f, license_number: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Issuing authority
            <input
              value={licForm.issuing_authority}
              onChange={(e) => setLicForm((f) => ({ ...f, issuing_authority: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Expiration
            <input
              type="date"
              value={licForm.expiration_date}
              onChange={(e) => setLicForm((f) => ({ ...f, expiration_date: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <div>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" />
              Add license
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <SectionHeader title="Insurance" />
        {insurance.length === 0 ? (
          <p className="text-sm text-ink-muted">No insurance policies on file.</p>
        ) : (
          <ul className="space-y-2">
            {insurance.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-semibold">{p.insurance_type}</p>
                  <p className="text-xs text-ink-muted">
                    {p.provider || 'No provider'}
                    {p.policy_reference ? ` · ${p.policy_reference}` : ''}
                  </p>
                  <ExpiryLine date={p.coverage_expiration} status={p.verification_status} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteInsurance(p.id, personnelId, actorId).then(onRefresh)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void upsertInsurance(
              {
                personnel_id: personnelId,
                company_id: null,
                insurance_type: insForm.insurance_type,
                provider: insForm.provider,
                policy_reference: insForm.policy_reference,
                coverage_expiration: insForm.coverage_expiration || null,
                workers_comp_status: '',
                verification_status: 'pending_verification',
                verification_date: null,
                notes: '',
              },
              actorId,
            )
              .then(() => {
                setInsForm({
                  insurance_type: '',
                  provider: '',
                  policy_reference: '',
                  coverage_expiration: '',
                })
                onRefresh()
              })
              .catch((err) => onError(err instanceof Error ? err.message : 'Failed'))
          }}
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold">
            Insurance type
            <input
              required
              value={insForm.insurance_type}
              onChange={(e) => setInsForm((f) => ({ ...f, insurance_type: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Provider
            <input
              value={insForm.provider}
              onChange={(e) => setInsForm((f) => ({ ...f, provider: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Policy reference
            <input
              value={insForm.policy_reference}
              onChange={(e) => setInsForm((f) => ({ ...f, policy_reference: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Coverage expiration
            <input
              type="date"
              value={insForm.coverage_expiration}
              onChange={(e) =>
                setInsForm((f) => ({ ...f, coverage_expiration: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <div>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" />
              Add insurance
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function DocumentsSection({
  personnelId,
  docs,
  canEdit,
  actorId,
  onRefresh,
  onError,
}: {
  personnelId: string
  docs: PersonnelDocument[]
  canEdit: boolean
  actorId?: string
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  const [category, setCategory] = useState<DocumentCategory>('other')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!canEdit) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-muted">Documents are restricted to managers.</p>
      </Card>
    )
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!file || !actorId) return
    setUploading(true)
    try {
      await uploadPersonnelDocument({
        personnelId,
        file,
        documentName: name || file.name,
        category,
        uploadedBy: actorId,
        actorId,
      })
      setFile(null)
      setName('')
      onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <SectionHeader title="Documents" subtitle="Section G — private storage, signed URLs only" />
      {docs.length === 0 ? (
        <p className="text-sm text-ink-muted">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div>
                <p className="font-semibold">{d.document_name}</p>
                <p className="text-xs text-ink-muted">
                  {DOCUMENT_CATEGORY_LABELS[d.category]} ·{' '}
                  {formatRelative(d.upload_date)}
                </p>
                <ExpiryLine date={d.expiration_date} status={d.verification_status} />
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void getDocumentSignedUrl(d.storage_path).then((url) => {
                      if (url) window.open(url, '_blank', 'noopener,noreferrer')
                    })
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!confirm('Delete this document?')) return
                    void deletePersonnelDocument(d, actorId).then(onRefresh)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onUpload} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Document name
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="text-sm font-semibold">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className={fieldClass}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          File
          <input
            type="file"
            required
            accept=".pdf,.doc,.docx,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm"
          />
        </label>
        <div>
          <Button type="submit" disabled={uploading || !file}>
            <FileUp className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AccessSection({
  person,
  linked,
  canEdit,
  inviteRole,
  setInviteRole,
  inviting,
  onInvite,
  onRefresh,
  onError,
}: {
  person: Personnel
  linked: Profile | null
  canEdit: boolean
  inviteRole: AppRole
  setInviteRole: (r: AppRole) => void
  inviting: boolean
  onInvite: (e: FormEvent) => void
  onRefresh: () => void
  onError: (msg: string) => void
}) {
  return (
    <Card className="space-y-4 p-5">
      <SectionHeader
        title="System Access"
        subtitle="Section H — app role is independent of personnel type"
      />
      {linked ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald">
            <Link2 className="h-4 w-4" />
            Linked to app account
          </p>
          <Dl
            rows={[
              ['Name', linked.full_name],
              ['Email', linked.email],
              ['App role', roleLabel(linked.app_role)],
              ['Access status', linked.active ? 'Active' : 'Inactive'],
            ]}
          />
          {canEdit && (
            <label className="block max-w-sm text-sm font-semibold">
              Change app role
              <select
                value={linked.app_role}
                onChange={(e) => {
                  const next = e.target.value as AppRole
                  void updateProfile(linked.id, { app_role: next })
                    .then(onRefresh)
                    .catch((err) => onError(err instanceof Error ? err.message : 'Update failed'))
                }}
                className={fieldClass}
              >
                {APP_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">No linked app account.</p>
          {canEdit && person.work_email ? (
            <form onSubmit={onInvite} className="max-w-md space-y-3">
              <p className="text-sm text-ink">
                Invite <span className="font-semibold">{person.work_email}</span> to the Field app.
              </p>
              <label className="block text-sm font-semibold">
                App role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AppRole)}
                  className={fieldClass}
                >
                  {APP_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={inviting}>
                <UserPlus className="h-4 w-4" />
                {inviting ? 'Sending…' : 'Send invite & link'}
              </Button>
            </form>
          ) : canEdit ? (
            <p className="text-sm text-ink-muted">
              Add a work email on the profile before inviting to the app.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function ActivitySection({ activity }: { activity: PersonnelActivity[] }) {
  return (
    <Card className="space-y-3 p-5">
      <SectionHeader title="Activity history" subtitle="Section I" />
      {activity.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {activity.map((a) => (
            <li key={a.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{a.action.replace(/_/g, ' ')}</span>
                <span className="text-xs text-ink-muted">{formatRelative(a.created_at)}</span>
              </div>
              <p className="text-xs text-ink-muted">
                {a.entity_type}
                {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}…` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{k}</dt>
          <dd className="text-sm text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ExpiryLine({
  date,
  status,
}: {
  date: string | null
  status: VerificationStatus
}) {
  return (
    <p className="mt-1 text-xs text-ink-muted">
      {VERIFICATION_LABELS[status]}
      {date
        ? ` · Exp ${formatShortDate(date)}${
            isExpired(date) ? ' (expired)' : isExpiringSoon(date) ? ' (soon)' : ''
          }`
        : ''}
    </p>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
