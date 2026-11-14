import { Link } from 'react-router-dom'
import {
  Bell,
  Calendar,
  ClipboardList,
  Package,
  UserRound,
  FileText,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { useApp } from '../context/AppContext'
import { cn, formatRelative } from '../lib/utils'
import type { NotificationType } from '../types'

const icons: Record<NotificationType, typeof Bell> = {
  assignment: ClipboardList,
  contact: UserRound,
  instruction: FileText,
  schedule: Calendar,
  materials: Package,
  note: Bell,
  export: Package,
}

export function NotificationsPage() {
  const { data, markNotificationRead, markAllNotificationsRead, unreadCount, getJob } = useApp()
  const notifications = [...data.notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Updates
          </h1>
          <p className="mt-1 text-ink-muted">
            Useful job information — not monitoring alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
            Mark all read
          </Button>
        )}
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="You're all caught up"
          description="New job updates will show up here."
        />
      ) : (
        <Card className="divide-y divide-border animate-fade-up stagger-1">
          <div className="px-5 py-3">
            <SectionHeader
              title={`${unreadCount} unread`}
              subtitle={`${notifications.length} total`}
            />
          </div>
          {notifications.map((n) => {
            const Icon = icons[n.type]
            const job = n.jobId ? getJob(n.jobId) : undefined
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markNotificationRead(n.id)}
                className={cn(
                  'flex w-full gap-3 px-5 py-4 text-left transition hover:bg-surface',
                  !n.read && 'bg-teal-soft',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    n.read
                      ? 'border border-border bg-surface text-ink-muted'
                      : 'bg-teal-fill text-on-teal',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <span className="shrink-0 text-xs text-ink-subtle">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>
                  {job && (
                    <Link
                      to={`/jobs/${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-block text-xs font-semibold text-teal hover:underline"
                    >
                      {job.name}
                    </Link>
                  )}
                  {!n.read && (
                    <p className="mt-1 text-[11px] font-medium text-teal">Tap to mark read</p>
                  )}
                </div>
              </button>
            )
          })}
        </Card>
      )}
    </div>
  )
}
