import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { formatMoney, lineAmount } from '../../types/billing'

export type LineDraft = {
  key: string
  description: string
  quantity: string
  unit: string
  unitPrice: string
}

const fieldClass =
  'mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-gold-line'

export function emptyLineDraft(): LineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    quantity: '1',
    unit: 'ea',
    unitPrice: '0',
  }
}

export function BillingLineItemsEditor({
  lines,
  onChange,
  disabled,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  disabled?: boolean
}) {
  function update(key: string, patch: Partial<LineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Line items</p>
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

export function draftsToLineInputs(lines: LineDraft[]) {
  return lines
    .map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity) || 0,
      unit: l.unit.trim() || 'ea',
      unitPrice: Number(l.unitPrice) || 0,
    }))
    .filter((l) => l.description || l.quantity || l.unitPrice)
}
