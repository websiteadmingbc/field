export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'void'
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'void'

export type BillingLineItem = {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  sortOrder: number
}

/** Planned payment milestone on an estimate/invoice (not recorded payments). */
export type PaymentScheduleItem = {
  id: string
  label: string
  amount: number
  percent: number | null
  note: string
}

export type Estimate = {
  id: string
  projectId: string
  estimateNumber: string
  title: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: EstimateStatus
  notes: string
  warrantyClause: string
  paymentSchedule: PaymentScheduleItem[]
  taxRatePct: number
  validUntil: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  lineItems: BillingLineItem[]
}

export type Invoice = {
  id: string
  projectId: string
  estimateId: string | null
  invoiceNumber: string
  title: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: InvoiceStatus
  notes: string
  warrantyClause: string
  paymentSchedule: PaymentScheduleItem[]
  taxRatePct: number
  dueDate: string | null
  amountPaid: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  lineItems: BillingLineItem[]
}

export type InvoicePayment = {
  id: string
  invoiceId: string
  amount: number
  paidOn: string
  method: string
  note: string
  recordedBy: string | null
  createdAt: string
}

export type BillingTotals = {
  subtotal: number
  tax: number
  total: number
  balanceDue?: number
}

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
  declined: 'Declined',
  void: 'Void',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
  void: 'Void',
}

export function lineAmount(item: Pick<BillingLineItem, 'quantity' | 'unitPrice'>): number {
  return roundMoney(item.quantity * item.unitPrice)
}

export function computeTotals(
  lineItems: Pick<BillingLineItem, 'quantity' | 'unitPrice'>[],
  taxRatePct: number,
  amountPaid = 0,
): BillingTotals {
  const subtotal = roundMoney(
    lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  )
  const tax = roundMoney(subtotal * (taxRatePct / 100))
  const total = roundMoney(subtotal + tax)
  return {
    subtotal,
    tax,
    total,
    balanceDue: roundMoney(Math.max(0, total - amountPaid)),
  }
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function newPaymentScheduleId(): string {
  return `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Default payment schedule template for new estimates/invoices. */
export function defaultPaymentScheduleTemplate(): PaymentScheduleItem[] {
  return [
    { id: newPaymentScheduleId(), label: 'Deposit', amount: 0, percent: null, note: '' },
    { id: newPaymentScheduleId(), label: 'After demo', amount: 0, percent: null, note: '' },
    { id: newPaymentScheduleId(), label: 'Miscellaneous', amount: 0, percent: null, note: '' },
    { id: newPaymentScheduleId(), label: 'Miscellaneous', amount: 0, percent: null, note: '' },
    {
      id: newPaymentScheduleId(),
      label: 'Final after walkthrough',
      amount: 0,
      percent: null,
      note: '',
    },
  ]
}

export function parsePaymentSchedule(raw: unknown): PaymentScheduleItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row, index) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount)
    const percentRaw = r.percent
    const percent =
      percentRaw == null || percentRaw === ''
        ? null
        : typeof percentRaw === 'number'
          ? percentRaw
          : Number(percentRaw)
    return {
      id: typeof r.id === 'string' && r.id ? r.id : `ps-${index}-${newPaymentScheduleId()}`,
      label: String(r.label ?? '').trim() || `Payment ${index + 1}`,
      amount: Number.isFinite(amount) ? amount : 0,
      percent: percent != null && Number.isFinite(percent) ? percent : null,
      note: String(r.note ?? ''),
    }
  })
}
