import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/',               icon: '🏠', label: 'Home' },
  { to: '/practice',       icon: '🎙', label: 'Practice' },
  { to: '/best-responses', icon: '🏆', label: 'Best Responses' },
  { to: '/settings',       icon: '⚙️', label: 'Settings' },
]

export default function Sidebar() {
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
    </nav>
  )
}
