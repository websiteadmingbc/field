import * as XLSX from 'xlsx'
import { emptyLineDraft, type LineDraft } from './lineDrafts'

export type ImportedLine = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

const DESC_KEYS = [
  'description',
  'desc',
  'item',
  'name',
  'product',
  'service',
  'work',
  'scope',
  'line',
  'details',
  'detail',
]
const QTY_KEYS = ['quantity', 'qty', 'qnty', 'count', 'hours', 'hrs']
const UNIT_KEYS = ['unit', 'uom', 'measure', 'units']
const PRICE_KEYS = [
  'unit_price',
  'unitprice',
  'unit price',
  'price',
  'rate',
  'cost',
  'amount',
  'total',
  'dollars',
  'dollar',
  'fee',
  'charge',
  '$',
]

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[$€£]/g, '')
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw)
    .trim()
    .replace(/[$,€£\s]/g, '')
    .replace(/\((.*)\)/, '-$1')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseQty(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function findKey(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  for (const c of candidates) {
    const hit = normalized.find((h) => h.norm === c || h.norm.replace(/\s/g, '') === c.replace(/\s/g, ''))
    if (hit) return hit.raw
  }
  for (const c of candidates) {
    const hit = normalized.find((h) => h.norm.includes(c) || c.includes(h.norm))
    if (hit) return hit.raw
  }
  return null
}

function rowsFromObjects(objects: Record<string, unknown>[]): ImportedLine[] {
  if (objects.length === 0) return []
  const headers = Object.keys(objects[0] ?? {})
  const descKey = findKey(headers, DESC_KEYS)
  const qtyKey = findKey(headers, QTY_KEYS)
  const unitKey = findKey(headers, UNIT_KEYS)
  const priceKey = findKey(headers, PRICE_KEYS)

  // Positional fallback: first text-ish col = description, last money-ish = price
  const out: ImportedLine[] = []
  for (const row of objects) {
    let description = descKey ? String(row[descKey] ?? '').trim() : ''
    let quantity = qtyKey ? parseQty(row[qtyKey]) : null
    let unit = unitKey ? String(row[unitKey] ?? '').trim() : ''
    let unitPrice = priceKey ? parseMoney(row[priceKey]) : null

    if (!descKey || unitPrice == null) {
      const values = headers.map((h) => row[h])
      if (!description) {
        const text = values.find((v) => typeof v === 'string' && v.trim() && parseMoney(v) == null)
        description = text != null ? String(text).trim() : ''
      }
      if (unitPrice == null) {
        for (let i = values.length - 1; i >= 0; i--) {
          const m = parseMoney(values[i])
          if (m != null) {
            unitPrice = m
            break
          }
        }
      }
    }

    if (!description && unitPrice == null) continue
    if (!description) description = 'Imported item'
    if (quantity == null || quantity === 0) quantity = 1
    if (!unit) unit = 'ea'
    if (unitPrice == null) unitPrice = 0

    // If only a total amount was provided with qty>1 and no separate rate, keep total as unitPrice with qty 1
    // when headers looked like amount/total without unit_price/rate.
    const priceHeader = priceKey ? normalizeHeader(priceKey) : ''
    const looksLikeTotalOnly =
      quantity === 1 ||
      /^(amount|total|dollars?|fee|charge)$/.test(priceHeader) ||
      !qtyKey

    out.push({
      description,
      quantity: looksLikeTotalOnly && !qtyKey ? 1 : quantity,
      unit,
      unitPrice: looksLikeTotalOnly && !qtyKey ? unitPrice : unitPrice,
    })
  }
  return out
}

function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Prose / scope formats like:
 *   1. Demolition & Removal: $6,099.50
 *      - bullet detail…
 *   2. Deck Prep: $3,049.75
 */
function parseProseItemized(text: string): ImportedLine[] {
  const lines = normalizeNewlines(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const itemRe =
    /^(\d+)\.\s+(.+?):\s*(\$?\s*[\d,]+(?:\.\d{1,2})?)\s*$/i
  const stopRe = /^(total|warranty|payment\s*schedule|notes?|exclusions?)\b/i

  const out: ImportedLine[] = []
  for (const line of lines) {
    if (stopRe.test(line)) break
    const m = line.match(itemRe)
    if (!m) continue
    const description = m[2].trim()
    const amount = parseMoney(m[3])
    if (!description || amount == null) continue
    out.push({
      description,
      quantity: 1,
      unit: 'ea',
      unitPrice: amount,
    })
  }
  return out
}

function looksLikeProseItemized(text: string): boolean {
  const sample = normalizeNewlines(text)
  const hits = sample.match(/^\d+\.\s+.+:\s*\$?\s*[\d,]+(?:\.\d{1,2})?\s*$/gim)
  return (hits?.length ?? 0) >= 2
}

function parseDelimited(text: string, delimiter: string): Record<string, unknown>[] {
  const lines = normalizeNewlines(text)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  const headerCells = parseRow(lines[0])
  const looksLikeHeader = headerCells.some((h) =>
    [...DESC_KEYS, ...QTY_KEYS, ...UNIT_KEYS, ...PRICE_KEYS].some((k) =>
      normalizeHeader(h).includes(k),
    ),
  )

  if (looksLikeHeader) {
    const headers = headerCells.map((h, i) => h || `col_${i + 1}`)
    return lines.slice(1).map((line) => {
      const cells = parseRow(line)
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? ''
      })
      return obj
    })
  }

  // No header: treat first column as description, last numeric as price, optional middle qty
  return lines.map((line) => {
    const cells = parseRow(line)
    const obj: Record<string, unknown> = {
      description: cells[0] ?? '',
    }
    if (cells.length >= 3) {
      obj.quantity = cells[1]
      obj.unit = cells.length >= 4 ? cells[2] : 'ea'
      obj.price = cells[cells.length - 1]
    } else if (cells.length === 2) {
      obj.price = cells[1]
    }
    return obj
  })
}

function detectDelimiter(text: string): string {
  const sample = normalizeNewlines(text).split('\n').slice(0, 5).join('\n')
  const commas = (sample.match(/,/g) || []).length
  const tabs = (sample.match(/\t/g) || []).length
  const semis = (sample.match(/;/g) || []).length
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t'
  if (semis > commas) return ';'
  return ','
}

function sheetToObjects(workbook: XLSX.WorkBook): Record<string, unknown>[] {
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
}

export async function parseLineItemsFile(file: File): Promise<ImportedLine[]> {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()

  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.ods') ||
    type.includes('spreadsheet') ||
    type.includes('excel')
  ) {
    const buf = await file.arrayBuffer()
    const workbook = XLSX.read(buf, { type: 'array' })
    return rowsFromObjects(sheetToObjects(workbook))
  }

  if (name.endsWith('.json') || type.includes('json')) {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items: unknown[] }).items)
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lines?: unknown }).lines)
          ? ((parsed as { lines: unknown[] }).lines)
          : null
    if (!arr) throw new Error('JSON must be an array of line objects (or { items: [] }).')
    return rowsFromObjects(arr as Record<string, unknown>[])
  }

  // CSV / TSV / TXT / prose scope lists / anything text-like
  const text = await file.text()
  if (!text.trim()) throw new Error('File is empty.')

  if (looksLikeProseItemized(text)) {
    const prose = parseProseItemized(text)
    if (prose.length > 0) return prose
  }

  const delimiter = name.endsWith('.tsv') ? '\t' : detectDelimiter(text)
  const delimited = rowsFromObjects(parseDelimited(text, delimiter))
  if (delimited.length > 0) return delimited

  // Last resort: scan any "Label: $1,234.56" lines (non-numbered)
  const loose = parseProseItemized(
    normalizeNewlines(text)
      .split('\n')
      .map((l) => (/^\d+\./.test(l.trim()) ? l : l.replace(/^(\s*)/, '$11. ')))
      .join('\n'),
  )
  if (loose.length > 0) return loose

  throw new Error(
    'No line items found. Use columns like Description and Amount/Price, or numbered scope lines like “1. Demolition: $6,099.50”.',
  )
}

export function importedToLineDrafts(items: ImportedLine[]): LineDraft[] {
  return items.map((item) => ({
    ...emptyLineDraft(),
    key: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: item.description,
    quantity: String(item.quantity),
    unit: item.unit || 'ea',
    unitPrice: String(item.unitPrice),
  }))
}

export const LINE_ITEM_IMPORT_ACCEPT =
  '.csv,.tsv,.txt,.json,.xlsx,.xls,.ods,text/csv,text/tab-separated-values,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
