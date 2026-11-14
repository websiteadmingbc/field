import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { canAccessAdminConsole } from '../types/auth'
import {
  fetchNoticesForProjects,
  fetchProjects,
  type ProjectNotice,
} from '../lib/supabase/projects'
import type { ProjectRow } from '../lib/supabase/database.types'
import { formatDate, formatRelative, formatShortDate, todayISO } from '../lib/utils'
import { roleLabel } from '../types/auth'
import type { JobStatus } from '../types'

function statusCounts(projects: ProjectRow[]) {
  const counts: Record<JobStatus, number> = {
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    on_hold: 0,
    archived: 0,
  }
  for (const p of projects) counts[p.status] += 1
  return counts
}

export function DashboardPage() {
  const { profile, configured } = useAuth()
  const showAdmin = canAccessAdminConsole(profile?.app_role)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [notices, setNotices] = useState<ProjectNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchProjects()
      setProjects(rows)
      const noticeRows = await fetchNoticesForProjects(rows.map((r) => r.id))
      setNotices(noticeRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [configured])

  useEffect(() => {
    void load()
  }, [load])

  const today = todayISO()
  const counts = useMemo(() => statusCounts(projects), [projects])
  const active = useMemo(
    () => projects.filter((p) => p.status === 'scheduled' || p.status === 'in_progress'),
    [projects],
  )
  const todays = useMemo(
    () => projects.filter((p) => p.scheduled_date === today && p.status !== 'completed'),
    [projects, today],
  )
  const onHold = useMemo(() => projects.filter((p) => p.status === 'on_hold'), [projects])
  const projectName = useCallback(
    (id: string) => projects.find((p) => p.id === id)?.name ?? 'Job',
    [projects],
  )

  const firstName = profile?.full_name.split(' ')[0] ?? 'there'

  if (!configured) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="Connect Supabase"
        description="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to unlock the live dashboard."
      />
    )
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              Office dashboard
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-[0.04em] text-ink sm:text-5xl">
              Welcome, <span className="text-teal">{firstName}</span>
            </h1>
            <p className="mt-3 max-w-xl text-ink-muted">
              {profile ? roleLabel(profile.app_role) : 'Team'} overview — active jobs, holds, and
              site notices. Company-wide people and roles live under Operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showAdmin && (
              <Link to="/admin/people">
                <Button type="button" size="sm">
                  Operations admin
                </Button>
              </Link>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Active jobs', value: active.length, tone: 'text-ink' },
            { label: 'Today', value: todays.length, tone: 'text-teal' },
            { label: 'In progress', value: counts.in_progress, tone: 'text-ink' },
            { label: 'On hold', value: counts.on_hold, tone: 'text-amber' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-surface-raised px-4 py-3"
            >
              <p className={`text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
              <p className="text-xs font-medium text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
      ) : (
        <>
          {onHold.length > 0 && (
            <section className="animate-fade-up stagger-1">
              <SectionHeader title="Needs attention" subtitle="Jobs currently on hold" />
              <div className="mt-3 space-y-2">
                {onHold.map((p) => (
                  <Link
                    key={p.id}
                    to={`/jobs/${p.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-amber/40 bg-amber-soft/40 px-4 py-3 transition hover:border-amber"
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-muted">
                        {p.job_number} · {p.client}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="animate-fade-up stagger-2">
            <SectionHeader
              title="All jobs"
              subtitle={`${projects.length} visible to you`}
              action={
                <Link
                  to="/jobs"
                  className="text-xs font-semibold uppercase tracking-wider text-teal hover:underline"
                >
                  Field list
                </Link>
              }
            />
            {projects.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<Briefcase className="h-6 w-6" />}
                  title="No jobs yet"
                  description="Add jobs and crew assignments in Operations → All Jobs. They will show up here automatically."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-raised">
                <div className="hidden grid-cols-[1fr_7rem_6rem_5.5rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle sm:grid">
                  <span>Job</span>
                  <span>Date</span>
                  <span>Type</span>
                  <span>Status</span>
                </div>
                <ul className="divide-y divide-border">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/jobs/${p.id}`}
                        className="grid gap-2 px-4 py-3 transition hover:bg-teal-soft/30 sm:grid-cols-[1fr_7rem_6rem_5.5rem] sm:items-center sm:gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{p.name}</p>
                          <p className="truncate text-xs text-ink-muted">
                            {p.job_number} · {p.client} · {p.city || p.address}
                          </p>
                        </div>
                        <p className="text-sm text-ink-muted">
                          {p.scheduled_date ? formatShortDate(p.scheduled_date) : '—'}
                        </p>
                        <p className="truncate text-xs text-ink-muted">{p.job_type}</p>
                        <StatusBadge status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="animate-fade-up stagger-3">
            <SectionHeader title="Recent site notices" subtitle="Posted from the app by managers" />
            {notices.length === 0 ? (
              <Card className="mt-4">
                <div className="flex items-start gap-3 p-1">
                  <ClipboardList className="mt-0.5 h-5 w-5 text-teal" />
                  <p className="text-sm text-ink-muted">
                    No notices yet. Admins, PMs, and site supervisors can post updates on a job.
                  </p>
                </div>
              </Card>
            ) : (
              <ul className="mt-4 space-y-2">
                {notices.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/jobs/${n.project_id}`}
                      className="block rounded-2xl border border-border bg-surface-raised px-4 py-3 transition hover:border-gold-line/60"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-teal">
                          {projectName(n.project_id)}
                        </p>
                        <p className="text-xs text-ink-subtle">{formatRelative(n.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink">{n.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-center text-xs text-ink-subtle">
            {formatDate(today)} · Data from Supabase · RLS enforces your role
          </p>
        </>
      )}
    </div>
  )
}
