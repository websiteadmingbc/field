import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TodayPage } from './TodayPage'
import { isOfficeRole } from '../types/auth'

/** Office roles land on the dashboard; crew stay on Today. */
export function HomeRedirect() {
  const { configured, profile, session } = useAuth()

  if (configured && session && isOfficeRole(profile?.app_role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <TodayPage />
}
