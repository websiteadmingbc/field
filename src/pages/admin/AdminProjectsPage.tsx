import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { fetchProjects } from '../../lib/supabase/projects'
import type { ProjectRow } from '../../lib/supabase/database.types'
import { cn, formatShortDate } from '../../lib/utils'

export function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await fetchProjects({ includeArchived: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (!showArchived && p.status === 'archived') return false
      if (showArchived && p.status !== 'archived') return false
      if (!q) return true
      return `${p.job_number} ${p.name} ${p.client} ${p.city} ${p.status}`
        .toLowerCase()
        .includes(q)
    })
  }, [projects, query, showArchived])

  return (
    <div className="space-y-4 animate-fade-up stagger-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs…"
            className="h-11 w-full rounded-md border border-border bg-surface-raised pl-10 pr-3 text-ink outline-none focus:border-gold-line"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              'h-9 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide transition',
              showArchived
                ? 'border-gold-line bg-teal-soft text-teal'
                : 'border-gold-line/40 bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {showArchived ? 'Showing archived' : 'Show archived'}
          </button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Link to="/admin/projects/new">
            <Button type="button" size="sm">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title={showArchived ? 'No archived jobs' : 'No jobs'}
          description={
            showArchived
              ? 'Archived jobs will appear here.'
              : 'Create the first job to assign crew and site contacts.'
          }
          action={
            !showArchived ? (
              <Link
                to="/admin/projects/new"
                className="text-sm font-semibold text-teal hover:underline"
              >
                New Job
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/admin/projects/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-teal-soft/30"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {p.job_number} · {p.client} · {p.city || p.address}
                      {p.scheduled_date ? ` · ${formatShortDate(p.scheduled_date)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
