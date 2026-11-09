import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, Pencil, UserPlus, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchInput } from '../../components/ui/SearchInput'
import { useAuth } from '../../context/AuthContext'
import { fetchCompanies } from '../../lib/supabase/companies'
import { fetchPersonnelList } from '../../lib/supabase/personnel'
import { cn } from '../../lib/utils'
import { canManageUsers } from '../../types/auth'
import type { Company, PersonnelListItem } from '../../types/personnel'
import {
  CLASSIFICATION_LABELS,
  PERSONNEL_CLASSIFICATIONS,
  PERSONNEL_STATUSES,
  STATUS_LABELS,
  WEBSITE_CATEGORY_LABELS,
  WEBSITE_PERSONNEL_CATEGORIES,
  statusToneClass,
} from '../../types/personnel'

const fieldClass =
  'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-gold-line'

export function AdminPersonnelPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const canEdit = canManageUsers(profile?.app_role)
  const [people, setPeople] = useState<PersonnelListItem[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const notice = (location.state as { notice?: string } | null)?.notice ?? null
  const [search, setSearch] = useState('')
  const [classification, setClassification] = useState('')
  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [websiteCategory, setWebsiteCategory] = useState('')
  const [websitePublished, setWebsitePublished] = useState<'' | 'yes' | 'no'>('')
  const [sort, setSort] = useState<'name' | 'start_date' | 'status'>('name')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, comps] = await Promise.all([
        fetchPersonnelList({
          search,
          classification: classification || undefined,
          status: status || undefined,
          companyId: companyId || undefined,
          websiteCategory: websiteCategory || undefined,
          websitePublished,
          sort,
          includeArchived: status === 'archived',
        }),
        fetchCompanies(),
      ])
      setPeople(list)
      setCompanies(comps)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load personnel')
    } finally {
      setLoading(false)
    }
  }, [search, classification, status, companyId, websiteCategory, websitePublished, sort])

  useEffect(() => {
    void load()
  }, [load])

  const subtitle = useMemo(() => {
    if (loading) return 'Loading…'
    return `${people.length} ${people.length === 1 ? 'person' : 'people'}`
  }, [loading, people.length])

  return (
    <div className="space-y-6 animate-fade-up stagger-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="Personnel"
          subtitle={
            canEdit
              ? 'Company directory — employees, contractors, and affiliates.'
              : 'View-only directory. Owner/Admin and General Manager can edit.'
          }
        />
        {canEdit && (
          <Link to="/admin/people/new">
            <Button type="button">
              <UserPlus className="h-4 w-4" />
              Add Personnel
            </Button>
          </Link>
        )}
      </div>

      <Card className="space-y-3 p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, company, title, ID, email, phone…"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Personnel type
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="">All types</option>
              {PERSONNEL_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {CLASSIFICATION_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="">All statuses</option>
              {PERSONNEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Company
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Website category
            <select
              value={websiteCategory}
              onChange={(e) => setWebsiteCategory(e.target.value)}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="">All categories</option>
              {WEBSITE_PERSONNEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {WEBSITE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Website
            <select
              value={websitePublished}
              onChange={(e) => setWebsitePublished(e.target.value as '' | 'yes' | 'no')}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="">Any</option>
              <option value="yes">Published</option>
              <option value="no">Not published</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className={cn(fieldClass, 'mt-1.5')}
            >
              <option value="name">Name</option>
              <option value="start_date">Start date</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </Card>

      {notice && (
        <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{subtitle}</p>

        {loading ? (
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
          </Card>
        ) : people.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No personnel found"
            description={
              canEdit
                ? 'Add your first person or clear filters.'
                : 'Ask an Owner/Admin or General Manager to add personnel.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-raised text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Job title</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Website</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id} className="border-t border-border bg-surface">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar initials={initials(p.display_name)} />
                          <Link
                            to={`/admin/people/${p.id}`}
                            className="font-semibold text-ink hover:text-teal"
                          >
                            {p.display_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-muted">
                        {p.personnel_code}
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{p.job_title || '—'}</td>
                      <td className="px-3 py-3 text-ink-muted">
                        {CLASSIFICATION_LABELS[p.classification]}
                      </td>
                      <td className="px-3 py-3">
                        <WebsitePill
                          category={p.website_category}
                          published={p.website_published}
                        />
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {p.primary_company?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {p.mobile_phone || p.work_phone || '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{p.work_email || '—'}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Link
                            to={`/admin/people/${p.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-ink-muted hover:text-ink"
                            aria-label="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {canEdit && (
                            <Link
                              to={`/admin/people/${p.id}/edit`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-ink-muted hover:text-ink"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 lg:hidden">
              {people.map((p) => (
                <li key={p.id}>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar initials={initials(p.display_name)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/people/${p.id}`}
                            className="font-semibold text-ink hover:text-teal"
                          >
                            {p.display_name}
                          </Link>
                          <StatusPill status={p.status} />
                          <WebsitePill
                            category={p.website_category}
                            published={p.website_published}
                          />
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-ink-muted">{p.personnel_code}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {p.job_title || 'No title'} · {CLASSIFICATION_LABELS[p.classification]}
                        </p>
                        {p.primary_company && (
                          <p className="text-sm text-ink-muted">{p.primary_company.name}</p>
                        )}
                        <p className="mt-1 text-sm text-ink-muted">
                          {p.mobile_phone || p.work_phone || 'No phone'}
                          {p.work_email ? ` · ${p.work_email}` : ''}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Link to={`/admin/people/${p.id}`}>
                            <Button type="button" variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                          {canEdit && (
                            <Link to={`/admin/people/${p.id}/edit`}>
                              <Button type="button" variant="ghost" size="sm">
                                Edit
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-soft text-xs font-bold uppercase tracking-wide text-teal">
      {initials}
    </span>
  )
}

function StatusPill({ status }: { status: PersonnelListItem['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
        statusToneClass(status),
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function WebsitePill({
  category,
  published,
}: {
  category: PersonnelListItem['website_category']
  published: boolean
}) {
  if (!category) {
    return <span className="text-xs text-ink-subtle">—</span>
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
        published ? 'bg-emerald-soft text-emerald' : 'bg-amber-soft text-amber',
      )}
    >
      {published ? 'Live · ' : 'Draft · '}
      {WEBSITE_CATEGORY_LABELS[category]}
    </span>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
}
