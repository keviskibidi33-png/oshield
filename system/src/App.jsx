import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TopNavBar } from './components/layout/TopNavBar'
import { LoginView } from './components/login/LoginView'
import { DashboardView } from './components/dashboard/DashboardView'
import { NodesView } from './components/nodes/NodesView'
import { LogsView } from './components/logs/LogsView'
import { IncidentView } from './components/logs/IncidentView'
import { SettingsView } from './components/settings/SettingsView'
import { TeamsView } from './components/teams/TeamsView'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'

function ProtectedRoute({ children }) {
  const { user, loading, token } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
    </div>
  )
  if (!token || !user) return <Navigate to="/login" replace />
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      <Routes location={location}>
        <Route path="/" element={<div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12 bg-surface-dim min-h-full"><DashboardView /></div>} />
        <Route path="/nodes" element={<NodesView />} />
        <Route path="/nodes/:id" element={<NodesView />} />
        <Route path="/logs" element={<div className="max-w-[1280px] mx-auto px-8 pt-8 bg-surface-dim min-h-full"><LogsView /></div>} />
        <Route path="/incidents/:id" element={<div className="max-w-[1280px] mx-auto px-8 pt-8 bg-surface-dim min-h-full"><IncidentView /></div>} />
        <Route path="/teams" element={<div className="bg-surface-dim min-h-full"><TeamsView /></div>} />
        <Route path="/teams/:id" element={<div className="bg-surface-dim min-h-full"><TeamsView /></div>} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-background text-on-surface flex flex-col">
                  <TopNavBar />
                  <main className="flex-1 pt-16 w-full bg-background">
                    <AnimatedRoutes />
                  </main>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
