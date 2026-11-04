import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccessAdminConsole } from '../../types/auth'

/** Gates Operations Admin — Owner/Admin, General Manager, Operations Manager */
export function RequireAdmin() {
  const { session, profile, ready, configured } = useAuth()

  if (configured && !ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
        Checking access…
      </div>
    )
  }

  if (!session || !canAccessAdminConsole(profile?.app_role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
