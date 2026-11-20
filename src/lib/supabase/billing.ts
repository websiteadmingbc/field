import type {
  BillingLineItem,
  Estimate,
  EstimateStatus,
  Invoice,
  InvoicePayment,
  InvoiceStatus,
  PaymentScheduleItem,
} from '../../types/billing'
import { parsePaymentSchedule } from '../../types/billing'
import { getSupabase } from './client'

type EstimateRow = {
  id: string
  project_id: string
  estimate_number: string
  title: string
  customer_name: string
  customer_email: string
  customer_phone: string
  status: EstimateStatus
  notes: string
  warranty_clause?: string | null
  payment_schedule?: unknown
  tax_rate_pct: number | string
  valid_until: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type InvoiceRow = {
  id: string
  project_id: string
  estimate_id: string | null
  invoice_number: string
  title: string
  customer_name: string
  customer_email: string
  customer_phone: string
  status: InvoiceStatus
  notes: string
  warranty_clause?: string | null
  payment_schedule?: unknown
  tax_rate_pct: number | string
  due_date: string | null
  amount_paid: number | string
  created_by: string | null
  created_at: string
  updated_at: string
}

type LineRow = {
  id: string
  sort_order: number
  description: string
  quantity: number | string
  unit: string
  unit_price: number | string
}

type PaymentRow = {
  id: string
  invoice_id: string
  amount: number | string
  paid_on: string
  method: string
  note: string
  recorded_by: string | null
  created_at: string
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapLine(row: LineRow): BillingLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: num(row.quantity),
    unit: row.unit,
    unitPrice: num(row.unit_price),
    sortOrder: row.sort_order,
  }
}

function mapEstimate(row: EstimateRow, lines: LineRow[] = []): Estimate {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateNumber: row.estimate_number,
    title: row.title,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status,
    notes: row.notes ?? '',
    warrantyClause: row.warranty_clause ?? '',
    paymentSchedule: parsePaymentSchedule(row.payment_schedule),
    taxRatePct: num(row.tax_rate_pct),
    validUntil: row.valid_until,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: lines.map(mapLine).sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

function mapInvoice(row: InvoiceRow, lines: LineRow[] = []): Invoice {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    invoiceNumber: row.invoice_number,
    title: row.title,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status,
    notes: row.notes ?? '',
    warrantyClause: row.warranty_clause ?? '',
    paymentSchedule: parsePaymentSchedule(row.payment_schedule),
    taxRatePct: num(row.tax_rate_pct),
    dueDate: row.due_date,
    amountPaid: num(row.amount_paid),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: lines.map(mapLine).sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

function schedulePayload(items: PaymentScheduleItem[] | undefined) {
  return (items ?? []).map((item) => ({
    id: item.id,
    label: item.label.trim(),
    amount: Number(item.amount) || 0,
    percent: item.percent,
    note: item.note ?? '',
  }))
}

export type EstimateInput = {
  projectId: string
  title: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  status?: EstimateStatus
  notes?: string
  warrantyClause?: string
  paymentSchedule?: PaymentScheduleItem[]
  taxRatePct?: number
  validUntil?: string | null
  lineItems: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
  }>
}

export type InvoiceInput = {
  projectId: string
  estimateId?: string | null
  title: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  status?: InvoiceStatus
  notes?: string
  warrantyClause?: string
  paymentSchedule?: PaymentScheduleItem[]
  taxRatePct?: number
  dueDate?: string | null
  amountPaid?: number
  lineItems: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
  }>
}

async function nextDocumentNumber(prefix: 'EST' | 'INV'): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const year = new Date().getFullYear().toString().slice(-2)
  const like = `${prefix}-${year}%`
  let latest: string | undefined
  if (prefix === 'EST') {
    const { data, error } = await supabase
      .from('estimates')
      .select('estimate_number')
      .like('estimate_number', like)
      .order('estimate_number', { ascending: false })
      .limit(1)
    if (error) throw error
    latest = data?.[0]?.estimate_number
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', like)
      .order('invoice_number', { ascending: false })
      .limit(1)
    if (error) throw error
    latest = data?.[0]?.invoice_number
  }
  let seq = 1
  if (latest) {
    const part = latest.split('-').pop()
    const n = Number(part)
    if (Number.isFinite(n)) seq = n + 1
  }
  return `${prefix}-${year}${String(seq).padStart(3, '0')}`
}

export async function listEstimates(projectId?: string): Promise<Estimate[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  let q = supabase.from('estimates').select('*').order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as EstimateRow[]
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const { data: lines, error: lineError } = await supabase
    .from('estimate_line_items')
    .select('*')
    .in('estimate_id', ids)
  if (lineError) throw lineError
  const byEst = new Map<string, LineRow[]>()
  for (const line of (lines ?? []) as (LineRow & { estimate_id: string })[]) {
    const list = byEst.get(line.estimate_id) ?? []
    list.push(line)
    byEst.set(line.estimate_id, list)
  }
  return rows.map((r) => mapEstimate(r, byEst.get(r.id) ?? []))
}

export async function getEstimate(id: string): Promise<Estimate | null> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.from('estimates').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: lines, error: lineError } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true })
  if (lineError) throw lineError
  return mapEstimate(data as EstimateRow, (lines ?? []) as LineRow[])
}

export async function saveEstimate(
  input: EstimateInput,
  opts?: { id?: string; createdBy?: string },
): Promise<Estimate> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const payload = {
    project_id: input.projectId,
    title: input.title.trim() || 'Estimate',
    customer_name: input.customerName.trim(),
    customer_email: (input.customerEmail ?? '').trim(),
    customer_phone: (input.customerPhone ?? '').trim(),
    status: input.status ?? 'draft',
    notes: input.notes ?? '',
    warranty_clause: input.warrantyClause ?? '',
    payment_schedule: schedulePayload(input.paymentSchedule),
    tax_rate_pct: input.taxRatePct ?? 0,
    valid_until: input.validUntil || null,
  }

  let estimateId = opts?.id
  if (estimateId) {
    const { error } = await supabase.from('estimates').update(payload).eq('id', estimateId)
    if (error) throw error
    const { error: deleteError } = await supabase
      .from('estimate_line_items')
      .delete()
      .eq('estimate_id', estimateId)
    if (deleteError) throw deleteError
  } else {
    const estimate_number = await nextDocumentNumber('EST')
    const { data, error } = await supabase
      .from('estimates')
      .insert({
        ...payload,
        estimate_number,
        created_by: opts?.createdBy ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    estimateId = (data as EstimateRow).id
  }

  const lineRows = input.lineItems.map((item, index) => ({
    estimate_id: estimateId!,
    sort_order: index,
    description: item.description.trim(),
    quantity: item.quantity,
    unit: item.unit.trim() || 'ea',
    unit_price: item.unitPrice,
  }))
  if (lineRows.length) {
    const { error: lineError } = await supabase.from('estimate_line_items').insert(lineRows)
    if (lineError) throw lineError
  }

  const saved = await getEstimate(estimateId!)
  if (!saved) throw new Error('Estimate saved but could not be reloaded')
  return saved
}

export async function deleteEstimate(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('estimates').delete().eq('id', id)
  if (error) throw error
}

export async function listInvoices(projectId?: string): Promise<Invoice[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  let q = supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as InvoiceRow[]
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const { data: lines, error: lineError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .in('invoice_id', ids)
  if (lineError) throw lineError
  const byInv = new Map<string, LineRow[]>()
  for (const line of (lines ?? []) as (LineRow & { invoice_id: string })[]) {
    const list = byInv.get(line.invoice_id) ?? []
    list.push(line)
    byInv.set(line.invoice_id, list)
  }
  return rows.map((r) => mapInvoice(r, byInv.get(r.id) ?? []))
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: lines, error: lineError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true })
  if (lineError) throw lineError
  return mapInvoice(data as InvoiceRow, (lines ?? []) as LineRow[])
}

export async function saveInvoice(
  input: InvoiceInput,
  opts?: { id?: string; createdBy?: string },
): Promise<Invoice> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const payload = {
    project_id: input.projectId,
    estimate_id: input.estimateId ?? null,
    title: input.title.trim() || 'Invoice',
    customer_name: input.customerName.trim(),
    customer_email: (input.customerEmail ?? '').trim(),
    customer_phone: (input.customerPhone ?? '').trim(),
    status: input.status ?? 'draft',
    notes: input.notes ?? '',
    warranty_clause: input.warrantyClause ?? '',
    payment_schedule: schedulePayload(input.paymentSchedule),
    tax_rate_pct: input.taxRatePct ?? 0,
    due_date: input.dueDate || null,
    amount_paid: input.amountPaid ?? 0,
  }

  let invoiceId = opts?.id
  if (invoiceId) {
    const { error } = await supabase.from('invoices').update(payload).eq('id', invoiceId)
    if (error) throw error
    const { error: deleteError } = await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId)
    if (deleteError) throw deleteError
  } else {
    const invoice_number = await nextDocumentNumber('INV')
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        ...payload,
        invoice_number,
        created_by: opts?.createdBy ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    invoiceId = (data as InvoiceRow).id
  }

  const lineRows = input.lineItems.map((item, index) => ({
    invoice_id: invoiceId!,
    sort_order: index,
    description: item.description.trim(),
    quantity: item.quantity,
    unit: item.unit.trim() || 'ea',
    unit_price: item.unitPrice,
  }))
  if (lineRows.length) {
    const { error: lineError } = await supabase.from('invoice_line_items').insert(lineRows)
    if (lineError) throw lineError
  }

  const saved = await getInvoice(invoiceId!)
  if (!saved) throw new Error('Invoice saved but could not be reloaded')
  return saved
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

export async function convertEstimateToInvoice(
  estimateId: string,
  createdBy?: string,
): Promise<Invoice> {
  const estimate = await getEstimate(estimateId)
  if (!estimate) throw new Error('Estimate not found')
  return saveInvoice(
    {
      projectId: estimate.projectId,
      estimateId: estimate.id,
      title: estimate.title || `Invoice from ${estimate.estimateNumber}`,
      customerName: estimate.customerName,
      customerEmail: estimate.customerEmail,
      customerPhone: estimate.customerPhone,
      status: 'draft',
      notes: estimate.notes,
      warrantyClause: estimate.warrantyClause,
      paymentSchedule: estimate.paymentSchedule,
      taxRatePct: estimate.taxRatePct,
      dueDate: null,
      amountPaid: 0,
      lineItems: estimate.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
      })),
    },
    { createdBy },
  )
}

export async function listInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_on', { ascending: false })
  if (error) throw error
  return ((data ?? []) as PaymentRow[]).map((p) => ({
    id: p.id,
    invoiceId: p.invoice_id,
    amount: num(p.amount),
    paidOn: p.paid_on,
    method: p.method,
    note: p.note,
    recordedBy: p.recorded_by,
    createdAt: p.created_at,
  }))
}

export async function addInvoicePayment(input: {
  invoiceId: string
  amount: number
  paidOn: string
  method: string
  note?: string
  recordedBy?: string
}): Promise<Invoice> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const invoice = await getInvoice(input.invoiceId)
  if (!invoice) throw new Error('Invoice not found')

  const { error } = await supabase.from('invoice_payments').insert({
    invoice_id: input.invoiceId,
    amount: input.amount,
    paid_on: input.paidOn,
    method: input.method,
    note: input.note ?? '',
    recorded_by: input.recordedBy ?? null,
  })
  if (error) throw error

  const amountPaid = invoice.amountPaid + input.amount
  const { computeTotals } = await import('../../types/billing')
  const totals = computeTotals(invoice.lineItems, invoice.taxRatePct, amountPaid)
  let status: InvoiceStatus = invoice.status
  if (amountPaid <= 0) status = invoice.status === 'draft' ? 'draft' : 'sent'
  else if ((totals.balanceDue ?? 0) <= 0) status = 'paid'
  else status = 'partial'

  return saveInvoice(
    {
      projectId: invoice.projectId,
      estimateId: invoice.estimateId,
      title: invoice.title,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      status,
      notes: invoice.notes,
      warrantyClause: invoice.warrantyClause,
      paymentSchedule: invoice.paymentSchedule,
      taxRatePct: invoice.taxRatePct,
      dueDate: invoice.dueDate,
      amountPaid,
      lineItems: invoice.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
      })),
    },
    { id: invoice.id },
  )
}
