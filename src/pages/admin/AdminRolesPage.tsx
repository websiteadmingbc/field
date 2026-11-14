import { useMemo, useState } from 'react'
import { Card, SectionHeader } from '../../components/ui/Card'
import {
  APP_ROLES,
  MODULE_LABELS,
  PERMISSION_MATRIX,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  formatCodes,
  scopeLabel,
  type AppRole,
  type ModuleKey,
} from '../../lib/rbac/matrix'

const MODULES = Object.keys(MODULE_LABELS) as ModuleKey[]

export function AdminRolesPage() {
  const [selected, setSelected] = useState<AppRole>('general_manager')

  const rows = useMemo(() => {
    const matrix = PERMISSION_MATRIX[selected] ?? {}
    return MODULES.map((module) => {
      const entry = matrix[module]
      return {
        module,
        label: MODULE_LABELS[module],
        codes: entry ? formatCodes(entry.codes) : '—',
        scope: entry ? scopeLabel(entry.scope) : 'No access',
        note: entry?.note,
      }
    })
  }, [selected])

  return (
    <div className="space-y-6 animate-fade-up stagger-2">
      <Card className="space-y-4 p-5">
        <SectionHeader
          title="Roles & permissions"
          subtitle="Baseline from the Construction Roles & Permissions guide. Adjust assignments on People; matrix edits can be persisted later."
        />
        <p className="text-sm text-ink-muted">
          Codes: <span className="font-semibold text-ink">C</span> create ·{' '}
          <span className="font-semibold text-ink">V</span> view ·{' '}
          <span className="font-semibold text-ink">E</span> edit ·{' '}
          <span className="font-semibold text-ink">D</span> delete ·{' '}
          <span className="font-semibold text-ink">A</span> approve. Scope limits which records apply
          (company-wide vs assigned jobs vs self).
        </p>
        <label className="block text-sm font-semibold">
          Role
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as AppRole)}
            className="mt-1.5 h-11 w-full max-w-md rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line"
          >
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <p className="max-w-2xl text-sm text-ink-muted">{ROLE_DESCRIPTIONS[selected]}</p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Data scope</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.module} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{row.label}</td>
                <td className="px-4 py-3 font-mono text-teal">{row.codes}</td>
                <td className="px-4 py-3 text-ink-muted">{row.scope}</td>
                <td className="px-4 py-3 text-ink-subtle">{row.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
