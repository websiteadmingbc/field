import { useMemo, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { JobCard } from '../components/JobCard'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { useApp } from '../context/AppContext'
import { cn, isToday, isUpcoming } from '../lib/utils'

const filters = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
] as const

type FilterId = (typeof filters)[number]['id']

export function JobsPage() {
  const { data } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')

  const jobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.jobs
      .filter((job) => {
        switch (filter) {
          case 'today':
            return isToday(job.scheduledDate)
          case 'upcoming':
            return isUpcoming(job.scheduledDate) || (isToday(job.scheduledDate) && job.status === 'scheduled')
          case 'in_progress':
            return job.status === 'in_progress'
          case 'completed':
            return job.status === 'completed'
          default:
            return true
        }
      })
      .filter((job) => {
        if (!q) return true
        const hay = [
          job.name,
          job.jobNumber,
          job.customer,
          job.address,
          job.city,
          job.type,
          job.status,
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime))
  }, [data.jobs, filter, query])

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">My Jobs</h1>
        <p className="mt-1 text-ink-muted">
          Search and filter your assigned jobs across San Jose, Los Gatos, Campbell, and nearby South Bay cities.
        </p>
      </header>

      <div className="space-y-3 animate-fade-up stagger-1">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search jobs, customers, addresses…"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',
                filter === f.id
                  ? 'bg-teal-fill text-on-teal'
                  : 'border border-gold-line/40 bg-surface-raised text-ink-muted hover:border-gold-line',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No jobs match"
          description="Try a different search or filter to find your assignment."
        />
      ) : (
        <div className="grid gap-4 animate-fade-up stagger-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} showCrew />
          ))}
        </div>
      )}
    </div>
  )
}
