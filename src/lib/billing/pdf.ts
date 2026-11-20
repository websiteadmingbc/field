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

type JobContext = {
  jobNumber: string
  jobName: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

type DocKind = 'estimate' | 'invoice'

function companyHeader(doc: jsPDF, kind: DocKind, number: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Great Britton Construction', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(kind === 'estimate' ? 'ESTIMATE' : 'INVOICE', 14, 25)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.setFontSize(12)
  doc.text(number, 196, 18, { align: 'right' })
}

function partyBlock(
  doc: jsPDF,
  y: number,
  label: string,
  lines: string[],
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(label.toUpperCase(), 14, y)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let cursor = y + 5
  for (const line of lines.filter(Boolean)) {
    doc.text(line, 14, cursor)
    cursor += 5
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

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 14) {
    doc.addPage()
    return 20
  }
  return y
}

function appendPaymentSchedule(doc: jsPDF, y: number, schedule: PaymentScheduleItem[]): number {
  const rows = schedule.filter((row) => row.label.trim() || row.amount || row.percent != null)
  if (!rows.length) return y

  y = ensureSpace(doc, y, 24)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Payment schedule', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Milestone', 'Amount', '%', 'Note']],
    body: rows.map((row) => [
      row.label || '—',
      formatMoney(row.amount || 0),
      row.percent != null ? `${row.percent}%` : '—',
      row.note || '',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
  })

  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 20
}

function appendWarrantyClause(doc: jsPDF, y: number, warranty: string): number {
  const text = warranty.trim()
  if (!text) return y

  y = ensureSpace(doc, y, 28)
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Warranty / statement', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, 180) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, 8)
    doc.text(line, 14, y)
    y += 5
  }
  return y
}

function appendNotes(doc: jsPDF, y: number, notes: string): number {
  const text = notes.trim()
  if (!text) return y

  y = ensureSpace(doc, y, 20)
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Notes', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, 180) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, 8)
    doc.text(line, 14, y)
    y += 5
  }
  return y
}

export function downloadEstimatePdf(estimate: Estimate, job: JobContext) {
  const doc = new jsPDF()
  companyHeader(doc, 'estimate', estimate.estimateNumber)

  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(estimate.title || 'Estimate', 14, y)
  y += 8

  y = partyBlock(doc, y, 'Customer', [
    estimate.customerName,
    estimate.customerPhone,
    estimate.customerEmail,
  ])
  y += 4
  y = partyBlock(doc, y, 'Job', [
    `${job.jobNumber} — ${job.jobName}`,
    [job.address, job.city, job.state, job.zip].filter(Boolean).join(', '),
  ])
  y += 2
  doc.setFontSize(9)
  doc.setTextColor(100)
  if (estimate.validUntil) doc.text(`Valid until: ${estimate.validUntil}`, 14, y)
  doc.text(`Status: ${estimate.status}`, 196, y, { align: 'right' })
  doc.setTextColor(0)
  y += 6

  const totals = computeTotals(estimate.lineItems, estimate.taxRatePct)
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: buildLineRows(estimate.lineItems),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 40
  let ty = finalY + 10
  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMoney(totals.subtotal)}`, 196, ty, { align: 'right' })
  ty += 6
  doc.text(`Tax (${estimate.taxRatePct}%): ${formatMoney(totals.tax)}`, 196, ty, {
    align: 'right',
  })
  ty += 7
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${formatMoney(totals.total)}`, 196, ty, { align: 'right' })

  ty = appendPaymentSchedule(doc, ty, estimate.paymentSchedule ?? [])
  ty = appendWarrantyClause(doc, ty, estimate.warrantyClause ?? '')
  appendNotes(doc, ty, estimate.notes ?? '')

  doc.save(`${estimate.estimateNumber}.pdf`)
}

export function downloadInvoicePdf(invoice: Invoice, job: JobContext) {
  const doc = new jsPDF()
  companyHeader(doc, 'invoice', invoice.invoiceNumber)

  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(invoice.title || 'Invoice', 14, y)
  y += 8

  y = partyBlock(doc, y, 'Bill to', [
    invoice.customerName,
    invoice.customerPhone,
    invoice.customerEmail,
  ])
  y += 4
  y = partyBlock(doc, y, 'Job', [
    `${job.jobNumber} — ${job.jobName}`,
    [job.address, job.city, job.state, job.zip].filter(Boolean).join(', '),
  ])
  y += 2
  doc.setFontSize(9)
  doc.setTextColor(100)
  if (invoice.dueDate) doc.text(`Due: ${invoice.dueDate}`, 14, y)
  doc.text(`Status: ${invoice.status}`, 196, y, { align: 'right' })
  doc.setTextColor(0)
  y += 6

  const totals = computeTotals(invoice.lineItems, invoice.taxRatePct, invoice.amountPaid)
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: buildLineRows(invoice.lineItems),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 90, 90] },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 40
  let ty = finalY + 10
  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMoney(totals.subtotal)}`, 196, ty, { align: 'right' })
  ty += 6
  doc.text(`Tax (${invoice.taxRatePct}%): ${formatMoney(totals.tax)}`, 196, ty, {
    align: 'right',
  })
  ty += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${formatMoney(totals.total)}`, 196, ty, { align: 'right' })
  ty += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Amount paid: ${formatMoney(invoice.amountPaid)}`, 196, ty, { align: 'right' })
  ty += 7
  doc.setFont('helvetica', 'bold')
  doc.text(`Balance due: ${formatMoney(totals.balanceDue ?? 0)}`, 196, ty, { align: 'right' })

  ty = appendPaymentSchedule(doc, ty, invoice.paymentSchedule ?? [])
  ty = appendWarrantyClause(doc, ty, invoice.warrantyClause ?? '')
  appendNotes(doc, ty, invoice.notes ?? '')

  doc.save(`${invoice.invoiceNumber}.pdf`)
}
