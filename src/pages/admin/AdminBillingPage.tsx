import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Plus, Receipt } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import {
  computeTotals,
  ESTIMATE_STATUS_LABELS,
  formatMoney,
  INVOICE_STATUS_LABELS,
  type Estimate,
  type Invoice,
} from '../../types/billing'
import { listEstimates, listInvoices } from '../../lib/supabase/billing'
import { formatShortDate } from '../../lib/utils'
import { isSupabaseConfigured } from '../../lib/supabase/client'

type Tab = 'estimates' | 'invoices'

function tabFromSearch(raw: string | null): Tab {
  return raw === 'invoices' ? 'invoices' : 'estimates'
}

export function AdminBillingPage() {
  const { data } = useApp()
  const [search, setSearch] = useSearchParams()
  const tab = tabFromSearch(search.get('tab'))
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const jobsById = useMemo(
    () => Object.fromEntries(data.jobs.map((j) => [j.id, j])),
    [data.jobs],
  )

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(search)
      if (next === 'estimates') params.delete('tab')
      else params.set('tab', next)
      setSearch(params, { replace: true })
    },
    [search, setSearch],
  )

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      setError('Billing requires a live Supabase connection.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [e, i] = await Promise.all([listEstimates(), listInvoices()])
      setEstimates(e)
      setInvoices(i)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load billing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <SectionHeader
          title="Estimates & invoices"
          subtitle="Create, open, edit, and export PDFs. Email send comes later."
          action={
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/billing/estimates/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New estimate
                </Button>
              </Link>
              <Link to="/admin/billing/invoices/new">
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  New invoice
                </Button>
              </Link>
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['estimates', 'Estimates', FileText, estimates.length],
              ['invoices', 'Invoices', Receipt, invoices.length],
            ] as const
          ).map(([id, label, Icon, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'inline-flex items-center gap-2 rounded-md bg-teal-fill px-3 py-2 text-sm font-semibold uppercase tracking-wide text-on-teal'
                  : 'inline-flex items-center gap-2 rounded-md border border-gold-line/40 bg-surface-raised px-3 py-2 text-sm font-semibold uppercase tracking-wide text-ink-muted'
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="tabular-nums opacity-80">({count})</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : tab === 'estimates' ? (
          estimates.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No estimates yet"
              description="Create an estimate for a job, then export PDF or convert to an invoice."
              action={
                <Link to="/admin/billing/estimates/new" className="text-sm font-semibold text-teal">
                  New estimate
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {estimates.map((e) => {
                const job = jobsById[e.projectId]
                const totals = computeTotals(e.lineItems, e.taxRatePct)
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/billing/estimates/${e.id}`}
                        className="font-semibold text-ink hover:text-teal"
                      >
                        {e.estimateNumber}
                      </Link>
                      <p className="text-sm text-ink-muted">
                        {e.title || 'Estimate'} · {e.customerName || 'No customer'}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {job ? `${job.jobNumber} · ${job.name}` : 'Job'} ·{' '}
                        {ESTIMATE_STATUS_LABELS[e.status]} · {formatShortDate(e.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-ink">{formatMoney(totals.total)}</p>
                      <Link to={`/admin/billing/estimates/${e.id}`}>
                        <Button size="sm" variant="outline">
                          Open / edit
                        </Button>
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No invoices yet"
            description="Create an invoice or convert an estimate. Saved invoices appear here so you can open and edit them."
            action={
              <Link to="/admin/billing/invoices/new" className="text-sm font-semibold text-teal">
                New invoice
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {invoices.map((inv) => {
              const job = jobsById[inv.projectId]
              const totals = computeTotals(inv.lineItems, inv.taxRatePct, inv.amountPaid)
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/admin/billing/invoices/${inv.id}`}
                      className="font-semibold text-ink hover:text-teal"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {inv.title || 'Invoice'} · {inv.customerName || 'No customer'}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {job ? `${job.jobNumber} · ${job.name}` : 'Job'} ·{' '}
                      {INVOICE_STATUS_LABELS[inv.status]} · due{' '}
                      {inv.dueDate ? formatShortDate(inv.dueDate) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{formatMoney(totals.total)}</p>
                      <p className="text-xs text-ink-muted">
                        Balance {formatMoney(totals.balanceDue ?? 0)}
                      </p>
                    </div>
                    <Link to={`/admin/billing/invoices/${inv.id}`}>
                      <Button size="sm" variant="outline">
                        Open / edit
                      </Button>
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
