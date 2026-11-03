import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarDays } from 'lucide-react'
import { JobCard } from '../components/JobCard'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { useApp } from '../context/AppContext'
import {
  formatDate,
  formatRelative,
  greetingForHour,
  todayISO,
} from '../lib/utils'

export function TodayPage() {
  const { data, currentUser, unreadCount } = useApp()
  const today = todayISO()
  const todaysJobs = data.jobs
    .filter((j) => j.scheduledDate === today && j.status !== 'completed')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const notices = todaysJobs.flatMap((j) =>
    j.notices.map((n) => ({ jobId: j.id, jobName: j.name, text: n })),
  )

  const recentUpdates = [...data.activity]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const firstName = currentUser?.name.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              {greetingForHour()}, {firstName}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-[0.04em] text-ink sm:text-5xl">
              Britton <span className="text-teal">Field</span>
            </h1>
            <p className="mt-3 max-w-lg text-ink-muted">
              Every job. Every crew. One place. — Your assignments and site info for today.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-4 py-3">
            <CalendarDays className="h-5 w-5 text-teal" />
            <div>
              <p className="text-xs font-medium text-ink-muted">Today</p>
              <p className="text-sm font-semibold text-ink">{formatDate(today)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-2xl border border-border bg-surface-raised px-4 py-3">
            <p className="text-2xl font-bold text-ink">{todaysJobs.length}</p>
            <p className="text-xs font-medium text-ink-muted">
              {todaysJobs.length === 1 ? 'job assigned' : 'jobs assigned'} today
            </p>
          </div>
          {unreadCount > 0 && (
            <Link
              to="/notifications"
              className="flex items-center gap-3 rounded-md border border-gold-line/50 bg-teal-soft px-4 py-3 transition hover:border-gold-line"
            >
              <Bell className="h-5 w-5 text-teal" />
              <div>
                <p className="text-sm font-semibold text-teal">
                  {unreadCount} new {unreadCount === 1 ? 'update' : 'updates'}
                </p>
                <p className="text-xs text-teal/80">Tap to review</p>
              </div>
            </Link>
          )}
        </div>
      </header>

      <section className="animate-fade-up stagger-1">
        <SectionHeader
          title="Today's jobs"
          subtitle="Demonstration data — South Bay sample projects"
        />
        {todaysJobs.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title="No jobs scheduled for today"
            description="Check My Jobs for upcoming assignments, or open the daily log when you're ready to document work."
            action={
              <Link to="/jobs" className="text-sm font-semibold text-teal hover:underline">
                Browse all jobs
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4">
            {todaysJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      {notices.length > 0 && (
        <section className="animate-fade-up stagger-2">
          <SectionHeader title="Important notices" subtitle="Access, parking, and deliveries" />
          <div className="space-y-3">
            {notices.map((n, i) => (
              <Card key={`${n.jobId}-${i}`} className="flex gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-amber">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <Link
                    to={`/jobs/${n.jobId}`}
                    className="text-sm font-semibold text-ink hover:text-teal"
                  >
                    {n.jobName}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-muted">{n.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="animate-fade-up stagger-3">
        <SectionHeader
          title="Recent project updates"
          action={
            <Link to="/notifications" className="text-sm font-semibold text-teal hover:underline">
              All updates
            </Link>
          }
        />
        <Card className="divide-y divide-border">
          {recentUpdates.map((item) => {
            const job = data.jobs.find((j) => j.id === item.jobId)
            return (
              <Link
                key={item.id}
                to={item.jobId ? `/jobs/${item.jobId}` : '/notifications'}
                className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">{item.body}</p>
                  {job && (
                    <p className="mt-1 text-xs text-ink-subtle">{job.name}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {formatRelative(item.createdAt)}
                </span>
              </Link>
            )
          })}
        </Card>
      </section>
    </div>
  )
}
