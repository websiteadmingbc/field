import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RequireAdmin } from './components/auth/RequireAdmin'
import { RequireAuth } from './components/auth/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { DashboardPage } from './pages/DashboardPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { PhotosPage } from './pages/PhotosPage'
import { HelpPage } from './pages/HelpPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { CustomersPage } from './pages/CustomersPage'
import { TeamPage } from './pages/TeamPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminPersonnelDetailPage } from './pages/admin/AdminPersonnelDetailPage'
import { AdminPersonnelFormPage } from './pages/admin/AdminPersonnelFormPage'
import { AdminPersonnelPage } from './pages/admin/AdminPersonnelPage'
import { AdminProjectFormPage } from './pages/admin/AdminProjectFormPage'
import { AdminProjectsPage } from './pages/admin/AdminProjectsPage'
import { AdminRolesPage } from './pages/admin/AdminRolesPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<HomeRedirect />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="jobs" element={<JobsPage />} />
                  <Route path="jobs/:jobId" element={<JobDetailPage />} />
                  <Route path="log" element={<DailyLogPage />} />
                  <Route path="photos" element={<PhotosPage />} />
                  <Route path="team" element={<TeamPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="help" element={<HelpPage />} />
                  <Route path="privacy" element={<PrivacyPage />} />

                  <Route path="admin" element={<RequireAdmin />}>
                    <Route element={<AdminLayout />}>
                      <Route index element={<Navigate to="people" replace />} />
                      <Route path="people" element={<AdminPersonnelPage />} />
                      <Route path="people/new" element={<AdminPersonnelFormPage />} />
                      <Route path="people/:personnelId" element={<AdminPersonnelDetailPage />} />
                      <Route path="people/:personnelId/edit" element={<AdminPersonnelFormPage />} />
                      <Route path="roles" element={<AdminRolesPage />} />
                      <Route path="projects" element={<AdminProjectsPage />} />
                      <Route path="projects/new" element={<AdminProjectFormPage />} />
                      <Route path="projects/:projectId" element={<AdminProjectFormPage />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
