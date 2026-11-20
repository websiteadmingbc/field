import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  computeTotals,
  formatMoney,
  lineAmount,
  type BillingLineItem,
  type Estimate,
  type Invoice,
  type PaymentScheduleItem,
} from '../../types/billing'

export type JobContext = {
  jobNumber: string
  jobName: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

export type BuiltPdf = {
  blob: Blob
  filename: string
  /** Object URL for iframe preview — caller must revoke. */
  objectUrl: string
}

type DocKind = 'estimate' | 'invoice'

/** US Letter — customers expect this over jsPDF’s A4 default. */
const PAGE_FORMAT = 'letter' as const
const MARGIN = 14 // mm
const TABLE_FONT = 9
const SECTION_GAP = 10
const TEXT_GAP = 5

type Layout = {
  left: number
  right: number
  contentWidth: number
  bottom: number
}

function createDoc(): { doc: jsPDF; layout: Layout } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: PAGE_FORMAT,
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const layout: Layout = {
    left: MARGIN,
    right: pageWidth - MARGIN,
    contentWidth: pageWidth - MARGIN * 2,
    bottom: pageHeight - MARGIN,
  }
  return { doc, layout }
}

function companyHeader(doc: jsPDF, layout: Layout, kind: DocKind, number: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Great Britton Construction', layout.left, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(kind === 'estimate' ? 'ESTIMATE' : 'INVOICE', layout.left, 25)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.setFontSize(12)
  doc.text(number, layout.right, 18, { align: 'right' })
}

function partyBlock(
  doc: jsPDF,
  layout: Layout,
  y: number,
  label: string,
  lines: string[],
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(label.toUpperCase(), layout.left, y)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let cursor = y + TEXT_GAP
  for (const line of lines.filter(Boolean)) {
    doc.text(line, layout.left, cursor)
    cursor += TEXT_GAP
  }
  return cursor
}

function buildLineRows(items: BillingLineItem[]) {
  return items.map((item) => [
    item.description || '—',
    String(item.quantity),
    item.unit || 'ea',
    formatMoney(item.unitPrice),
    formatMoney(lineAmount(item)),
  ])
}

function ensureSpace(doc: jsPDF, layout: Layout, y: number, needed: number): number {
  if (y + needed > layout.bottom) {
    doc.addPage()
    return MARGIN + 6
  }
  return y
}

function appendPaymentSchedule(
  doc: jsPDF,
  layout: Layout,
  y: number,
  schedule: PaymentScheduleItem[],
): number {
  const rows = schedule.filter((row) => row.label.trim() || row.amount || row.percent != null)
  if (!rows.length) return y

  y = ensureSpace(doc, layout, y, 24)
  y += SECTION_GAP
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Payment schedule', layout.left, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: layout.left, right: MARGIN },
    head: [['Milestone', 'Amount', '%', 'Note']],
    body: rows.map((row) => [
      row.label || '—',
      formatMoney(row.amount || 0),
      row.percent != null ? `${row.percent}%` : '—',
      row.note || '',
    ]),
    styles: { fontSize: TABLE_FONT },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
  })

  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 20
}

function appendWrappedSection(
  doc: jsPDF,
  layout: Layout,
  y: number,
  heading: string,
  body: string,
): number {
  const text = body.trim()
  if (!text) return y

  y = ensureSpace(doc, layout, y, 28)
  y += SECTION_GAP + 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(heading, layout.left, y)
  y += TEXT_GAP
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, layout.contentWidth) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, layout, y, 8)
    doc.text(line, layout.left, y)
    y += TEXT_GAP
  }
  return y
}

function finalizePdf(doc: jsPDF, filename: string): BuiltPdf {
  const blob = doc.output('blob')
  const objectUrl = URL.createObjectURL(blob)
  return { blob, filename, objectUrl }
}

function buildEstimateDoc(estimate: Estimate, job: JobContext): jsPDF {
  const { doc, layout } = createDoc()
  companyHeader(doc, layout, 'estimate', estimate.estimateNumber)

  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(estimate.title || 'Estimate', layout.left, y)
  y += 8

  y = partyBlock(doc, layout, y, 'Customer', [
    estimate.customerName,
    estimate.customerPhone,
    estimate.customerEmail,
  ])
  y += 4
  y = partyBlock(doc, layout, y, 'Job', [
    `${job.jobNumber} — ${job.jobName}`,
    [job.address, job.city, job.state, job.zip].filter(Boolean).join(', '),
  ])
  y += 2
  doc.setFontSize(9)
  doc.setTextColor(100)
  if (estimate.validUntil) doc.text(`Valid until: ${estimate.validUntil}`, layout.left, y)
  doc.text(`Status: ${estimate.status}`, layout.right, y, { align: 'right' })
  doc.setTextColor(0)
  y += 6

  const totals = computeTotals(estimate.lineItems, estimate.taxRatePct)
  autoTable(doc, {
    startY: y,
    margin: { left: layout.left, right: MARGIN },
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: buildLineRows(estimate.lineItems),
    styles: { fontSize: TABLE_FONT },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 40
  let ty = finalY + SECTION_GAP
  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMoney(totals.subtotal)}`, layout.right, ty, { align: 'right' })
  ty += 6
  doc.text(`Tax (${estimate.taxRatePct}%): ${formatMoney(totals.tax)}`, layout.right, ty, {
    align: 'right',
  })
  ty += 7
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${formatMoney(totals.total)}`, layout.right, ty, { align: 'right' })

  ty = appendPaymentSchedule(doc, layout, ty, estimate.paymentSchedule ?? [])
  ty = appendWrappedSection(doc, layout, ty, 'Warranty / statement', estimate.warrantyClause ?? '')
  appendWrappedSection(doc, layout, ty, 'Notes', estimate.notes ?? '')

  return doc
}

function buildInvoiceDoc(invoice: Invoice, job: JobContext): jsPDF {
  const { doc, layout } = createDoc()
  companyHeader(doc, layout, 'invoice', invoice.invoiceNumber)

  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(invoice.title || 'Invoice', layout.left, y)
  y += 8

  y = partyBlock(doc, layout, y, 'Bill to', [
    invoice.customerName,
    invoice.customerPhone,
    invoice.customerEmail,
  ])
  y += 4
  y = partyBlock(doc, layout, y, 'Job', [
    `${job.jobNumber} — ${job.jobName}`,
    [job.address, job.city, job.state, job.zip].filter(Boolean).join(', '),
  ])
  y += 2
  doc.setFontSize(9)
  doc.setTextColor(100)
  if (invoice.dueDate) doc.text(`Due: ${invoice.dueDate}`, layout.left, y)
  doc.text(`Status: ${invoice.status}`, layout.right, y, { align: 'right' })
  doc.setTextColor(0)
  y += 6

  const totals = computeTotals(invoice.lineItems, invoice.taxRatePct, invoice.amountPaid)
  autoTable(doc, {
    startY: y,
    margin: { left: layout.left, right: MARGIN },
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: buildLineRows(invoice.lineItems),
    styles: { fontSize: TABLE_FONT },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 40
  let ty = finalY + SECTION_GAP
  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMoney(totals.subtotal)}`, layout.right, ty, { align: 'right' })
  ty += 6
  doc.text(`Tax (${invoice.taxRatePct}%): ${formatMoney(totals.tax)}`, layout.right, ty, {
    align: 'right',
  })
  ty += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${formatMoney(totals.total)}`, layout.right, ty, { align: 'right' })
  ty += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Amount paid: ${formatMoney(invoice.amountPaid)}`, layout.right, ty, { align: 'right' })
  ty += 7
  doc.setFont('helvetica', 'bold')
  doc.text(`Balance due: ${formatMoney(totals.balanceDue ?? 0)}`, layout.right, ty, {
    align: 'right',
  })

  ty = appendPaymentSchedule(doc, layout, ty, invoice.paymentSchedule ?? [])
  ty = appendWrappedSection(doc, layout, ty, 'Warranty / statement', invoice.warrantyClause ?? '')
  appendWrappedSection(doc, layout, ty, 'Notes', invoice.notes ?? '')

  return doc
}

export function buildEstimatePdf(estimate: Estimate, job: JobContext): BuiltPdf {
  return finalizePdf(buildEstimateDoc(estimate, job), `${estimate.estimateNumber}.pdf`)
}

export function buildInvoicePdf(invoice: Invoice, job: JobContext): BuiltPdf {
  return finalizePdf(buildInvoiceDoc(invoice, job), `${invoice.invoiceNumber}.pdf`)
}

export function downloadEstimatePdf(estimate: Estimate, job: JobContext) {
  const built = buildEstimatePdf(estimate, job)
  triggerDownload(built)
  URL.revokeObjectURL(built.objectUrl)
}

export function downloadInvoicePdf(invoice: Invoice, job: JobContext) {
  const built = buildInvoicePdf(invoice, job)
  triggerDownload(built)
  URL.revokeObjectURL(built.objectUrl)
}

export function triggerDownload(built: BuiltPdf) {
  const a = document.createElement('a')
  a.href = built.objectUrl
  a.download = built.filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
