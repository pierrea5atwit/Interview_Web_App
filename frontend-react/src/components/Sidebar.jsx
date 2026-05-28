import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',               icon: '🏠', label: 'Home' },
  { to: '/practice',       icon: '🎙', label: 'Practice' },
  { to: '/best-responses', icon: '🏆', label: 'Best Responses' },
  { to: '/settings',       icon: '⚙️', label: 'Settings' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">InterviewAI</div>
        <div className="sidebar-brand-sub">Your personal coach</div>
      </div>

      {NAV.map(({ to, icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          {({ isActive }) => (
            <button className={`sidebar-nav-btn${isActive ? ' active' : ''}`}>
              {icon}&nbsp;&nbsp;{label}
            </button>
          )}
        </NavLink>
      ))}

      {user && (
        <div className="sidebar-user">
          <div className="sidebar-divider" />
          <div className="sidebar-user-email" title={user.email}>{user.email}</div>
          <button className="sidebar-nav-btn sidebar-logout-btn" onClick={signOut}>
            🚪&nbsp;&nbsp;Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
