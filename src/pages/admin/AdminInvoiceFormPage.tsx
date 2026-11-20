import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import {
  BillingLineItemsEditor,
  draftsToLineInputs,
  emptyLineDraft,
  type LineDraft,
} from '../../components/billing/BillingLineItemsEditor'
import { PaymentScheduleEditor } from '../../components/billing/PaymentScheduleEditor'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { downloadInvoicePdf } from '../../lib/billing/pdf'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  addInvoicePayment,
  deleteInvoice,
  getInvoice,
  listInvoicePayments,
  saveInvoice,
} from '../../lib/supabase/billing'
import {
  computeTotals,
  defaultPaymentScheduleTemplate,
  formatMoney,
  INVOICE_STATUS_LABELS,
  type Invoice,
  type InvoicePayment,
  type InvoiceStatus,
  type PaymentScheduleItem,
} from '../../types/billing'
import { todayISO } from '../../lib/utils'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line'
const areaClass =
  'mt-1.5 min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

function linesFromInvoice(inv: Invoice): LineDraft[] {
  if (!inv.lineItems.length) return [emptyLineDraft()]
  return inv.lineItems.map((l) => ({
    key: l.id,
    description: l.description,
    quantity: String(l.quantity),
    unit: l.unit,
    unitPrice: String(l.unitPrice),
  }))
}

/** Remount on route id so create → saved id never keeps stale “new” state. */
export function AdminInvoiceFormPage() {
  const { invoiceId } = useParams()
  return <InvoiceEditor key={invoiceId ?? 'new'} invoiceId={invoiceId} />
}

function InvoiceEditor({ invoiceId }: { invoiceId: string | undefined }) {
  const [search] = useSearchParams()
  const isNew = !invoiceId || invoiceId === 'new'
  const navigate = useNavigate()
  const { data } = useApp()
  const { session } = useAuth()

  const [projectId, setProjectId] = useState(search.get('job') ?? '')
  const [title, setTitle] = useState('Invoice')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('draft')
  const [notes, setNotes] = useState('')
  const [warrantyClause, setWarrantyClause] = useState('')
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>(() =>
    defaultPaymentScheduleTemplate(),
  )
  const [taxRatePct, setTaxRatePct] = useState('0')
  const [dueDate, setDueDate] = useState('')
  const [amountPaid, setAmountPaid] = useState(0)
  const [estimateId, setEstimateId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineDraft[]>([emptyLineDraft()])
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(isNew ? null : invoiceId)
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payMethod, setPayMethod] = useState('check')
  const [payNote, setPayNote] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const job = useMemo(() => data.jobs.find((j) => j.id === projectId), [data.jobs, projectId])
  const totals = useMemo(
    () => computeTotals(draftsToLineInputs(lines), Number(taxRatePct) || 0, amountPaid),
    [lines, taxRatePct, amountPaid],
  )

  const hydrate = useCallback((inv: Invoice) => {
    setDocumentId(inv.id)
    setProjectId(inv.projectId)
    setTitle(inv.title)
    setCustomerName(inv.customerName)
    setCustomerEmail(inv.customerEmail)
    setCustomerPhone(inv.customerPhone)
    setStatus(inv.status)
    setNotes(inv.notes)
    setWarrantyClause(inv.warrantyClause ?? '')
    setPaymentSchedule(
      inv.paymentSchedule?.length ? inv.paymentSchedule : defaultPaymentScheduleTemplate(),
    )
    setTaxRatePct(String(inv.taxRatePct))
    setDueDate(inv.dueDate ?? '')
    setAmountPaid(inv.amountPaid)
    setEstimateId(inv.estimateId)
    setInvoiceNumber(inv.invoiceNumber)
    setLines(linesFromInvoice(inv))
  }, [])

  const load = useCallback(async () => {
    if (isNew || !invoiceId) {
      setLoading(false)
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    setError(null)
    try {
      const inv = await getInvoice(invoiceId)
      if (!inv) throw new Error('Invoice not found')
      hydrate(inv)
      setPayments(await listInvoicePayments(invoiceId))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [hydrate, invoiceId, isNew])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isNew || !job) return
    if (!customerName) setCustomerName(job.customer)
    if (!title || title === 'Invoice') setTitle(`${job.name} invoice`)
  }, [isNew, job, customerName, title])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured()) {
      setError('Billing requires a live Supabase connection.')
      return
    }
    if (!projectId) {
      setError('Select a job.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const saved = await saveInvoice(
        {
          projectId,
          estimateId,
          title,
          customerName,
          customerEmail,
          customerPhone,
          status,
          notes,
          warrantyClause,
          paymentSchedule,
          taxRatePct: Number(taxRatePct) || 0,
          dueDate: dueDate || null,
          amountPaid,
          lineItems: draftsToLineInputs(lines),
        },
        {
          id: isNew ? undefined : documentId ?? invoiceId,
          createdBy: session?.user?.id,
        },
      )
      hydrate(saved)
      setNotice('Invoice saved.')
      if (isNew || invoiceId !== saved.id) {
        navigate(`/admin/billing/invoices/${saved.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    const id = documentId ?? invoiceId
    if (isNew || !id || !confirm('Delete this invoice?')) return
    setSaving(true)
    try {
      await deleteInvoice(id)
      navigate('/admin/billing?tab=invoices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setSaving(false)
    }
  }

  async function onPdf() {
    const id = documentId ?? invoiceId
    if (isNew || !id || !job) return
    const inv = await getInvoice(id)
    if (!inv) return
    downloadInvoicePdf(inv, {
      jobNumber: job.jobNumber,
      jobName: job.name,
      address: job.address,
      city: job.city,
      state: job.state,
      zip: job.zip,
    })
  }

  async function onAddPayment(e: FormEvent) {
    e.preventDefault()
    const id = documentId ?? invoiceId
    if (isNew || !id) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      setError('Enter a payment amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await addInvoicePayment({
        invoiceId: id,
        amount,
        paidOn: payDate || todayISO(),
        method: payMethod,
        note: payNote,
        recordedBy: session?.user?.id,
      })
      hydrate(updated)
      setPayments(await listInvoicePayments(id))
      setPayAmount('')
      setPayNote('')
      setNotice('Payment recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading invoice…</p>

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/billing?tab=invoices"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-teal"
        >
          <ArrowLeft className="h-4 w-4" />
          Invoices
        </Link>
        <Card className="space-y-3 p-5">
          <SectionHeader title="Couldn’t open invoice" subtitle={loadError} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void load()}>
              Retry
            </Button>
            <Link to="/admin/billing?tab=invoices">
              <Button type="button" variant="outline">
                Back to invoices
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const editingExisting = !isNew && !!documentId

  return (
    <div className="space-y-4">
      <Link
        to="/admin/billing?tab=invoices"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-teal"
      >
        <ArrowLeft className="h-4 w-4" />
        Invoices
      </Link>

      <form onSubmit={(e) => void onSave(e)} className="space-y-4">
        <Card className="space-y-4 p-5">
          <SectionHeader
            title={isNew ? 'New invoice' : invoiceNumber || 'Invoice'}
            subtitle={
              editingExisting
                ? 'View and edit this invoice, then save changes'
                : 'Line items, payment schedule, warranty, and PDF export'
            }
            action={
              editingExisting ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void onPdf()}>
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              ) : null
            }
          />

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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Job
              <select
                required
                value={projectId}
                disabled={editingExisting}
                onChange={(e) => setProjectId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select job…</option>
                {data.jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} — {j.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className={fieldClass}
              >
                {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {INVOICE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Customer name
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Customer phone
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Customer email
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Tax rate %
              <input
                type="number"
                step="0.001"
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <BillingLineItemsEditor lines={lines} onChange={setLines} disabled={saving} />

          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <p>Subtotal: {formatMoney(totals.subtotal)}</p>
            <p>Tax: {formatMoney(totals.tax)}</p>
            <p className="font-semibold">Total: {formatMoney(totals.total)}</p>
            <p>Paid: {formatMoney(amountPaid)}</p>
            <p className="font-semibold">Balance due: {formatMoney(totals.balanceDue ?? 0)}</p>
          </div>

          <PaymentScheduleEditor
            items={paymentSchedule}
            onChange={setPaymentSchedule}
            disabled={saving}
          />

          <label className="block text-sm font-semibold">
            Warranty / statement clause
            <textarea
              value={warrantyClause}
              onChange={(e) => setWarrantyClause(e.target.value)}
              className={areaClass}
              rows={4}
              placeholder="Warranty or statement language shown below the line items on the PDF…"
            />
          </label>

          <label className="block text-sm font-semibold">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={areaClass}
              rows={3}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingExisting ? 'Save changes' : 'Create invoice'}
            </Button>
            {editingExisting && (
              <Button type="button" variant="danger" disabled={saving} onClick={() => void onDelete()}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </Card>
      </form>

      {editingExisting && (
        <Card className="space-y-4 p-5">
          <SectionHeader title="Payments" subtitle="Manual payment log (no online checkout yet)" />
          {payments.length === 0 ? (
            <p className="text-sm text-ink-muted">No payments recorded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    {p.paidOn} · {p.method}
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                  <span className="font-semibold">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={(e) => void onAddPayment(e)} className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm font-semibold">
              Amount
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Date
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Method
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className={fieldClass}
              >
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="ach">ACH / transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Note
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} className={fieldClass} />
            </label>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={saving}>
                Record payment
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
