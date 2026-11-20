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
