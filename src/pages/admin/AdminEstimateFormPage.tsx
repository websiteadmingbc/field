import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, FileOutput, Trash2 } from 'lucide-react'
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
import { downloadEstimatePdf } from '../../lib/billing/pdf'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  convertEstimateToInvoice,
  deleteEstimate,
  getEstimate,
  saveEstimate,
} from '../../lib/supabase/billing'
import {
  computeTotals,
  defaultPaymentScheduleTemplate,
  ESTIMATE_STATUS_LABELS,
  formatMoney,
  type EstimateStatus,
  type PaymentScheduleItem,
} from '../../types/billing'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line'
const areaClass =
  'mt-1.5 min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

export function AdminEstimateFormPage() {
  const { estimateId } = useParams()
  const [search] = useSearchParams()
  const isNew = !estimateId || estimateId === 'new'
  const navigate = useNavigate()
  const { data } = useApp()
  const { session } = useAuth()

  const [projectId, setProjectId] = useState(search.get('job') ?? '')
  const [title, setTitle] = useState('Estimate')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [status, setStatus] = useState<EstimateStatus>('draft')
  const [notes, setNotes] = useState('')
  const [warrantyClause, setWarrantyClause] = useState('')
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>(() =>
    defaultPaymentScheduleTemplate(),
  )
  const [taxRatePct, setTaxRatePct] = useState('0')
  const [validUntil, setValidUntil] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLineDraft()])
  const [estimateNumber, setEstimateNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const job = useMemo(() => data.jobs.find((j) => j.id === projectId), [data.jobs, projectId])
  const totals = useMemo(
    () => computeTotals(draftsToLineInputs(lines), Number(taxRatePct) || 0),
    [lines, taxRatePct],
  )

  const load = useCallback(async () => {
    if (isNew || !estimateId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const e = await getEstimate(estimateId)
      if (!e) throw new Error('Estimate not found')
      setProjectId(e.projectId)
      setTitle(e.title)
      setCustomerName(e.customerName)
      setCustomerEmail(e.customerEmail)
      setCustomerPhone(e.customerPhone)
      setStatus(e.status)
      setNotes(e.notes)
      setWarrantyClause(e.warrantyClause ?? '')
      setPaymentSchedule(
        e.paymentSchedule?.length ? e.paymentSchedule : defaultPaymentScheduleTemplate(),
      )
      setTaxRatePct(String(e.taxRatePct))
      setValidUntil(e.validUntil ?? '')
      setEstimateNumber(e.estimateNumber)
      setLines(
        e.lineItems.length
          ? e.lineItems.map((l) => ({
              key: l.id,
              description: l.description,
              quantity: String(l.quantity),
              unit: l.unit,
              unitPrice: String(l.unitPrice),
            }))
          : [emptyLineDraft()],
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [estimateId, isNew])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isNew || !job) return
    if (!customerName) setCustomerName(job.customer)
    if (!title || title === 'Estimate') setTitle(`${job.name} estimate`)
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
    try {
      const saved = await saveEstimate(
        {
          projectId,
          title,
          customerName,
          customerEmail,
          customerPhone,
          status,
          notes,
          warrantyClause,
          paymentSchedule,
          taxRatePct: Number(taxRatePct) || 0,
          validUntil: validUntil || null,
          lineItems: draftsToLineInputs(lines),
        },
        { id: isNew ? undefined : estimateId, createdBy: session?.user?.id },
      )
      setNotice('Estimate saved.')
      if (isNew) navigate(`/admin/billing/estimates/${saved.id}`, { replace: true })
      else {
        setEstimateNumber(saved.estimateNumber)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (isNew || !estimateId || !confirm('Delete this estimate?')) return
    setSaving(true)
    try {
      await deleteEstimate(estimateId)
      navigate('/admin/billing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setSaving(false)
    }
  }

  async function onPdf() {
    if (isNew || !estimateId || !job) return
    const e = await getEstimate(estimateId)
    if (!e) return
    downloadEstimatePdf(e, {
      jobNumber: job.jobNumber,
      jobName: job.name,
      address: job.address,
      city: job.city,
      state: job.state,
      zip: job.zip,
    })
  }

  async function onConvert() {
    if (isNew || !estimateId) return
    setSaving(true)
    setError(null)
    try {
      const inv = await convertEstimateToInvoice(estimateId, session?.user?.id)
      navigate(`/admin/billing/invoices/${inv.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert failed')
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading estimate…</p>

  return (
    <div className="space-y-4">
      <Link
        to="/admin/billing"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-teal"
      >
        <ArrowLeft className="h-4 w-4" />
        Billing
      </Link>

      <form onSubmit={(e) => void onSave(e)} className="space-y-4">
        <Card className="space-y-4 p-5">
          <SectionHeader
            title={isNew ? 'New estimate' : estimateNumber || 'Estimate'}
            subtitle="Line items, tax, and PDF export"
            action={
              !isNew ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void onPdf()}>
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void onConvert()}
                  >
                    <FileOutput className="h-4 w-4" />
                    Convert to invoice
                  </Button>
                </div>
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
                disabled={!isNew}
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
                onChange={(e) => setStatus(e.target.value as EstimateStatus)}
                className={fieldClass}
              >
                {(Object.keys(ESTIMATE_STATUS_LABELS) as EstimateStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ESTIMATE_STATUS_LABELS[s]}
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
              Valid until
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
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
              {saving ? 'Saving…' : 'Save estimate'}
            </Button>
            {!isNew && (
              <Button type="button" variant="danger" disabled={saving} onClick={() => void onDelete()}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </Card>
      </form>
    </div>
  )
}
