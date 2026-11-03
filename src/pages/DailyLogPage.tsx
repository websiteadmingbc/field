import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, Lightbulb } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { useApp } from '../context/AppContext'
import { formatRelative, formatShortDate, todayISO } from '../lib/utils'
import type { DailyLog } from '../types'

const suggestions = [
  'Work completed',
  'Waiting on materials',
  'Customer requested change',
  'Site access issue',
  'Follow-up needed',
]

const emptyForm = {
  id: undefined as string | undefined,
  jobId: '',
  date: todayISO(),
  workCompleted: '',
  materialsUsed: '',
  issues: '',
  notesForNext: '',
}

export function DailyLogPage() {
  const { data, saveDailyLog, deleteDailyLog, getJob, getContact, currentUser } = useApp()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ ...emptyForm })
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    const jobParam = params.get('job')
    const issue = params.get('issue')
    setForm((f) => ({
      ...f,
      jobId: jobParam || f.jobId || data.jobs[0]?.id || '',
      issues: issue ? 'Site access issue / see details below' : f.issues,
    }))
  }, [params, data.jobs])

  const logs = useMemo(
    () =>
      [...data.dailyLogs].sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.date.localeCompare(a.date),
      ),
    [data.dailyLogs],
  )

  function loadLog(log: DailyLog) {
    setForm({
      id: log.id,
      jobId: log.jobId,
      date: log.date,
      workCompleted: log.workCompleted,
      materialsUsed: log.materialsUsed,
      issues: log.issues,
      notesForNext: log.notesForNext,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function applySuggestion(text: string) {
    if (text === 'Work completed') {
      setForm((f) => ({
        ...f,
        workCompleted: f.workCompleted || 'Completed planned work for today. ',
      }))
      return
    }
    if (text === 'Waiting on materials' || text === 'Customer requested change' || text === 'Site access issue' || text === 'Follow-up needed') {
      setForm((f) => ({
        ...f,
        issues: f.issues ? `${f.issues}\n${text}` : text,
      }))
    }
  }

  function handleSave(status: 'draft' | 'submitted') {
    if (!form.jobId) return
    const id = saveDailyLog(
      {
        id: form.id,
        jobId: form.jobId,
        date: form.date,
        workCompleted: form.workCompleted,
        materialsUsed: form.materialsUsed,
        issues: form.issues,
        notesForNext: form.notesForNext,
      },
      status,
    )
    setForm((f) => ({ ...f, id }))
    setSavedMsg(status === 'draft' ? 'Draft saved locally.' : 'Log submitted.')
    setTimeout(() => setSavedMsg(''), 2500)
    if (status === 'submitted') {
      setForm({ ...emptyForm, jobId: form.jobId })
    }
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Daily Log</h1>
        <p className="mt-1 max-w-xl text-ink-muted">
          Lightweight job documentation for the crew — not a timesheet or productivity tracker.
          Logged as {currentUser?.name}.
        </p>
      </header>

      <Card className="p-5 sm:p-6 animate-fade-up stagger-1">
        <SectionHeader
          title={form.id ? 'Edit entry' : 'New entry'}
          subtitle="Save a draft anytime, or submit when ready"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-ink">Job</span>
            <select
              value={form.jobId}
              onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}
              className="h-12 w-full rounded-xl border border-border bg-surface-raised px-3 outline-none focus:border-teal-bright"
            >
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-ink">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="h-12 w-full rounded-xl border border-border px-3 outline-none focus:border-teal-bright"
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            <Lightbulb className="h-3.5 w-3.5" />
            Quick suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => applySuggestion(s)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-teal hover:text-teal"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Field
            label="Work completed"
            value={form.workCompleted}
            onChange={(v) => setForm((f) => ({ ...f, workCompleted: v }))}
            placeholder="What got done at the site?"
          />
          <Field
            label="Materials used"
            value={form.materialsUsed}
            onChange={(v) => setForm((f) => ({ ...f, materialsUsed: v }))}
            placeholder="Optional — materials consumed today"
          />
          <Field
            label="Issues or blockers"
            value={form.issues}
            onChange={(v) => setForm((f) => ({ ...f, issues: v }))}
            placeholder="Anything the next visit should know?"
          />
          <Field
            label="Notes for next crew / visit"
            value={form.notesForNext}
            onChange={(v) => setForm((f) => ({ ...f, notesForNext: v }))}
            placeholder="Hand-off notes"
          />
        </div>

        <p className="mt-3 text-xs text-ink-subtle">
          Photos are optional — add them from the Photos screen and link them to this job.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => handleSave('draft')}>
            Save draft
          </Button>
          <Button type="button" onClick={() => handleSave('submitted')}>
            Submit entry
          </Button>
          {form.id && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm({ ...emptyForm, jobId: form.jobId })}
            >
              Clear form
            </Button>
          )}
          {savedMsg && <span className="text-sm font-medium text-teal">{savedMsg}</span>}
        </div>
      </Card>

      <section className="animate-fade-up stagger-2">
        <SectionHeader title="Recent logs" />
        {logs.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No logs yet"
            description="Submit your first daily entry when you're ready."
          />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const job = getJob(log.jobId)
              const author = getContact(log.authorId)
              return (
                <Card key={log.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/jobs/${log.jobId}`}
                        className="font-semibold text-ink hover:text-teal"
                      >
                        {job?.name ?? 'Job'}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {formatShortDate(log.date)} · {author?.name} ·{' '}
                        <span className="capitalize">{log.status}</span>
                      </p>
                    </div>
                    <span className="text-xs text-ink-subtle">{formatRelative(log.updatedAt)}</span>
                  </div>
                  {log.workCompleted && (
                    <p className="mt-3 text-sm text-ink-muted">{log.workCompleted}</p>
                  )}
                  {log.issues && (
                    <p className="mt-2 text-sm text-amber">Issues: {log.issues}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadLog(log)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Delete this log entry?')) deleteDailyLog(log.id)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-semibold text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border px-3 py-3 outline-none focus:border-teal-bright"
      />
    </label>
  )
}
