import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import {
  APP_ROLE_OPTIONS,
  fetchProfiles,
  inviteUser,
  updateProfile,
} from '../../lib/supabase/admin'
import type { AppRole, Profile } from '../../types/auth'
import { canManageUsers, roleLabel } from '../../types/auth'

const fieldClass =
  'mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-ink outline-none focus:border-gold-line'

export function AdminPeoplePage() {
  const { profile } = useAuth()
  const canEdit = canManageUsers(profile?.app_role)
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [invite, setInvite] = useState({
    email: '',
    full_name: '',
    title: '',
    phone: '',
    app_role: 'tradesperson' as AppRole,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPeople(await fetchProfiles())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load people')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await inviteUser({
        email: invite.email.trim().toLowerCase(),
        full_name: invite.full_name.trim(),
        title: invite.title.trim(),
        phone: invite.phone.trim(),
        app_role: invite.app_role,
      })
      setInvite({
        email: '',
        full_name: '',
        title: '',
        phone: '',
        app_role: 'tradesperson',
      })
      setNotice('Invite sent. They sign in with a one-time email code.')
      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invite failed. Deploy the invite-user Edge Function if you have not yet.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function patchPerson(
    id: string,
    patch: Partial<Pick<Profile, 'title' | 'phone' | 'app_role' | 'active' | 'full_name'>>,
  ) {
    if (!canEdit) return
    setError(null)
    try {
      await updateProfile(id, patch)
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-6 animate-fade-up stagger-2">
      {canEdit ? (
        <Card className="p-5">
          <form onSubmit={onInvite} className="space-y-4">
            <SectionHeader
              title="Invite someone"
              subtitle="Sends an email invite. Role controls app permissions; title is their job title."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Full name
                <input
                  required
                  value={invite.full_name}
                  onChange={(e) => setInvite((f) => ({ ...f, full_name: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Work email
                <input
                  required
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Job title
                <input
                  value={invite.title}
                  onChange={(e) => setInvite((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Carpenter, Superintendent…"
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Phone
                <input
                  value={invite.phone}
                  onChange={(e) => setInvite((f) => ({ ...f, phone: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                App role (permissions)
                <select
                  value={invite.app_role}
                  onChange={(e) =>
                    setInvite((f) => ({ ...f, app_role: e.target.value as AppRole }))
                  }
                  className={fieldClass}
                >
                  {APP_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald">
                {notice}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              <UserPlus className="h-4 w-4" />
              {saving ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-5">
          <SectionHeader
            title="Directory (view only)"
            subtitle="Operations Manager can view people. Owner/Admin and General Manager can invite and change roles."
          />
          {error && (
            <p className="mt-3 rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}
        </Card>
      )}

      <div className="space-y-3">
        <SectionHeader title="Directory" subtitle={`${people.length} people`} />
        {loading ? (
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
        ) : people.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-6 w-6" />}
            title="No people yet"
            description={
              canEdit
                ? 'Invite your first crew member above.'
                : 'Ask an Owner/Admin or General Manager to invite people.'
            }
          />
        ) : (
          <ul className="space-y-3">
            {people.map((p) => (
              <li key={p.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{p.full_name}</p>
                      <p className="text-xs text-ink-muted">{p.email}</p>
                    </div>
                    {canEdit ? (
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        <input
                          type="checkbox"
                          checked={p.active}
                          onChange={(e) => void patchPerson(p.id, { active: e.target.checked })}
                          className="h-4 w-4 accent-[var(--bf-gold-fill)]"
                        />
                        Active
                      </label>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                      Job title
                      <input
                        defaultValue={p.title ?? ''}
                        disabled={!canEdit}
                        onBlur={(e) => {
                          if (canEdit && e.target.value !== (p.title ?? '')) {
                            void patchPerson(p.id, { title: e.target.value })
                          }
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                      Phone
                      <input
                        defaultValue={p.phone ?? ''}
                        disabled={!canEdit}
                        onBlur={(e) => {
                          if (canEdit && e.target.value !== (p.phone ?? '')) {
                            void patchPerson(p.id, { phone: e.target.value })
                          }
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                      App role
                      {canEdit ? (
                        <select
                          value={p.app_role}
                          onChange={(e) =>
                            void patchPerson(p.id, { app_role: e.target.value as AppRole })
                          }
                          className={fieldClass}
                        >
                          {APP_ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className={`${fieldClass} flex items-center`}>{roleLabel(p.app_role)}</p>
                      )}
                    </label>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
