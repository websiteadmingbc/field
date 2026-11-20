import { useRef, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { formatMoney, lineAmount } from '../../types/billing'
import {
  importedToLineDrafts,
  LINE_ITEM_IMPORT_ACCEPT,
  parseLineItemsFile,
} from '../../lib/billing/importLineItems'
import {
  draftsToLineInputs,
  emptyLineDraft,
  type LineDraft,
} from '../../lib/billing/lineDrafts'

export type { LineDraft }
export { emptyLineDraft, draftsToLineInputs }

const fieldClass =
  'mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-gold-line'

export function BillingLineItemsEditor({
  lines,
  onChange,
  disabled,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  disabled?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function update(key: string, patch: Partial<LineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function onImportFile(file: File | null) {
    if (!file) return
    setImporting(true)
    setImportError(null)
    setImportMsg(null)
    try {
      const parsed = await parseLineItemsFile(file)
      if (parsed.length === 0) {
        throw new Error(
          'No line items found. Use columns like Description and Amount/Price (CSV, Excel, JSON, TSV).',
        )
      }
      const drafts = importedToLineDrafts(parsed)
      const existingUseful = lines.filter(
        (l) => l.description.trim() || Number(l.unitPrice) || (Number(l.quantity) && Number(l.quantity) !== 1),
      )
      const mode =
        existingUseful.length === 0
          ? 'replace'
          : confirm(
              `Import ${drafts.length} line item(s) from “${file.name}”.\n\nOK = add to existing lines\nCancel = replace all lines`,
            )
            ? 'append'
            : 'replace'
      onChange(mode === 'append' ? [...existingUseful, ...drafts] : drafts)
      setImportMsg(`Imported ${drafts.length} line item(s) from ${file.name}`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Line items</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={LINE_ITEM_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange([...lines, emptyLineDraft()])}
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Import CSV, TSV, TXT, Excel (.xlsx/.xls), ODS, JSON, or scope prose like “1. Demolition:
        $6,099.50”.
      </p>
      {importMsg && (
        <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-xs text-emerald">
          {importMsg}
        </p>
      )}
      {importError && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-xs text-rose">
          {importError}
        </p>
      )}
      <div className="space-y-3">
        {lines.map((line) => {
          const qty = Number(line.quantity) || 0
          const price = Number(line.unitPrice) || 0
          return (
            <div
              key={line.key}
              className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_5rem_4.5rem_6rem_5.5rem_auto]"
            >
              <label className="text-xs font-semibold text-ink-muted sm:col-span-1">
                Description
                <input
                  value={line.description}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { description: e.target.value })}
                  className={fieldClass}
                  placeholder="Labor, materials…"
                />
              </label>
              <label className="text-xs font-semibold text-ink-muted">
                Qty
                <input
                  type="number"
                  step="0.001"
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { quantity: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-muted">
                Unit
                <input
                  value={line.unit}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { unit: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-muted">
                Rate
                <input
                  type="number"
                  step="0.01"
                  value={line.unitPrice}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <div className="text-xs font-semibold text-ink-muted">
                Amount
                <p className="mt-2 text-sm font-semibold text-ink">
                  {formatMoney(lineAmount({ quantity: qty, unitPrice: price }))}
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || lines.length <= 1}
                  onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
