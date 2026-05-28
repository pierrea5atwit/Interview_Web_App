import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{title}</div>
      <hr style={{ margin: '8px 0 16px' }} />
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, getToken } = useAuth()

  const [minScore,    setMinScore]    = useState('7.0')
  const [saved,       setSaved]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [dangerCount, setDangerCount] = useState(null)
  const [clearing,    setClearing]    = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (data.best_response_min_score) setMinScore(data.best_response_min_score)
      })
      .catch(() => {})

    if (user) {
      const token = getToken?.()
      fetch(`/api/responses?user_id=${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : [])
        .then(d => setDangerCount(Array.isArray(d) ? d.length : 0))
        .catch(() => {})
    }
  }, [user, getToken])

  async function saveSettings() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ best_response_min_score: minScore }),
      })
      if (res.ok) setSaved(true)
      else throw new Error(await res.text())
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally { setSaving(false) }
  }

  async function clearAll() {
    if (!user) { alert('Sign in to manage responses.'); return }
    if (!window.confirm(`Delete all ${dangerCount} saved responses? This cannot be undone.`)) return
    setClearing(true)
    try {
      const token = getToken?.()
      await fetch(`/api/responses/all?user_id=${user.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setDangerCount(0)
    } catch {
      alert('Delete failed — try again or remove responses individually.')
    } finally { setClearing(false) }
  }

  return (
    <>
      <div className="page-header">
        <span className="page-header-icon">⚙️</span>
        <div>
          <h2>Settings</h2>
          <p>Manage your preferences</p>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="card" style={{ marginBottom: 32, borderLeft: '3px solid var(--accent)' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
          <strong>🤖 Scoring and transcription run on our servers.</strong><br />
          No local setup or API keys required — just record and go.
        </p>
      </div>

      {/* ── Preferences ── */}
      <Section title="🎛 Preferences">
        <div style={{ maxWidth: 340 }}>
          <label>Min score to save: {parseFloat(minScore).toFixed(1)}</label>
          <input
            type="range" min={5} max={10} step={0.5}
            value={minScore}
            onChange={e => { setMinScore(e.target.value); setSaved(false) }}
            style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }}
          />
          <p className="caption">Responses must reach this score to appear in Best Responses.</p>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ minWidth: 160 }}>
            {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Settings'}
          </button>
          {saved && (
            <span style={{ marginLeft: 12, color: 'var(--green)', fontSize: '0.9rem' }}>✅ Saved</span>
          )}
        </div>
      </Section>

      {/* ── Danger zone ── */}
      <Section title="⚠️ Danger Zone">
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong>Clear all saved responses</strong> — this cannot be undone.
          </p>
          {dangerCount !== null && (
            <p className="caption" style={{ marginBottom: 12 }}>
              You have <strong>{dangerCount}</strong> saved response{dangerCount !== 1 ? 's' : ''}.
            </p>
          )}
          {!user && (
            <p className="caption" style={{ marginBottom: 12, color: 'var(--muted)' }}>
              Sign in to manage your responses.
            </p>
          )}
          <button
            className="btn btn-secondary"
            onClick={clearAll}
            disabled={clearing || !user || dangerCount === 0}
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: 'var(--red)' }}
          >
            {clearing ? <><span className="spinner" /> Deleting…</> : '🗑 Delete all saved responses'}
          </button>
        </div>
      </Section>
    </>
  )
}
