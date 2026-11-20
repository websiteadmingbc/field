import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  defaultPaymentScheduleTemplate,
  formatMoney,
  newPaymentScheduleId,
  type PaymentScheduleItem,
} from '../../types/billing'

const fieldClass =
  'mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-gold-line'

export function PaymentScheduleEditor({
  items,
  onChange,
  disabled,
}: {
  items: PaymentScheduleItem[]
  onChange: (items: PaymentScheduleItem[]) => void
  disabled?: boolean
}) {
  function update(id: string, patch: Partial<PaymentScheduleItem>) {
    onChange(items.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const scheduledTotal = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Payment schedule</p>
          <p className="text-xs text-ink-subtle">
            Template starts with deposit, after demo, two miscellaneous rows, and final after
            walkthrough. Add or remove rows as needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(defaultPaymentScheduleTemplate())}
          >
            Reset template
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...items,
                {
                  id: newPaymentScheduleId(),
                  label: 'Payment',
                  amount: 0,
                  percent: null,
                  note: '',
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((row) => (
          <div
            key={row.id}
            className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_6.5rem_5rem_1fr_auto]"
          >
            <label className="text-xs font-semibold text-ink-muted">
              Milestone
              <input
                value={row.label}
                disabled={disabled}
                onChange={(e) => update(row.id, { label: e.target.value })}
                className={fieldClass}
                placeholder="Deposit, after demo…"
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Amount
              <input
                type="number"
                step="0.01"
                value={row.amount}
                disabled={disabled}
                onChange={(e) => update(row.id, { amount: Number(e.target.value) || 0 })}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              %
              <input
                type="number"
                step="0.01"
                value={row.percent ?? ''}
                disabled={disabled}
                onChange={(e) =>
                  update(row.id, {
                    percent: e.target.value === '' ? null : Number(e.target.value) || 0,
                  })
                }
                className={fieldClass}
                placeholder="—"
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Note
              <input
                value={row.note}
                disabled={disabled}
                onChange={(e) => update(row.id, { note: e.target.value })}
                className={fieldClass}
                placeholder="Optional"
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || items.length <= 1}
                onClick={() => onChange(items.filter((r) => r.id !== row.id))}
                aria-label="Remove payment row"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        Scheduled total: <span className="font-semibold text-ink">{formatMoney(scheduledTotal)}</span>
      </p>
    </div>
  )
}
