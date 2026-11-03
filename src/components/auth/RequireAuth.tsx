import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function RequireAuth() {
  const { configured, ready, session } = useAuth()
  const location = useLocation()

  // Demo / POC mode: no Supabase env → allow the existing local app
  if (!configured) return <Outlet />

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
