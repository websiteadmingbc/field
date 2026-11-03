import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AppShell } from './components/layout/AppShell'
import { TodayPage } from './pages/TodayPage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { PhotosPage } from './pages/PhotosPage'
import { TeamPage } from './pages/TeamPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { PrivacyPage } from './pages/PrivacyPage'

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<TodayPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="jobs/:jobId" element={<JobDetailPage />} />
              <Route path="log" element={<DailyLogPage />} />
              <Route path="photos" element={<PhotosPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  )
}
