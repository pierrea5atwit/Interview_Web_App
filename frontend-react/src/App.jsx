import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar.jsx'
import Home from './pages/Home.jsx'
import Practice from './pages/Practice.jsx'
import BestResponses from './pages/BestResponses.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'

function Shell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
        <span className="spinner" style={{ marginRight: 10 }} /> Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/practice"       element={<Practice />} />
          <Route path="/best-responses" element={<BestResponses />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
