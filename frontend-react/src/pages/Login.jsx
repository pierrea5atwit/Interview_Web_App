import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]       = useState('login') // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus]   = useState(null) // { type, message }
  const [busy, setBusy]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)

    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email, password)

    if (error) {
      setStatus({ type: 'error', message: error.message })
    } else if (mode === 'signup') {
      setStatus({ type: 'success', message: 'Check your email to confirm your account, then sign in.' })
    }
    setBusy(false)
  }

  if (!supabase) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="sidebar-brand-name" style={{ marginBottom: 6 }}>InterviewAI</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: 16 }}>
            Supabase is not configured. Running in guest mode.
          </p>
          <div className="alert alert-warning">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable accounts.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="sidebar-brand-name" style={{ fontSize: '1.8rem' }}>InterviewAI</div>
          <div className="sidebar-brand-sub" style={{ fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </div>
        </div>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="login-input"
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="login-input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={busy}
            style={{ marginTop: 4 }}
          >
            {busy
              ? <><span className="spinner" style={{ marginRight: 8 }} />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: 'var(--muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setStatus(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
