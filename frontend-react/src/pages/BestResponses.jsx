import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['clarity', 'conciseness', 'structure', 'confidence', 'relevance']

function pillClass(score) {
  if (score >= 7) return 'pill-green'
  if (score >= 5) return 'pill-amber'
  return 'pill-red'
}

function medal(score) {
  if (score >= 9) return '🥇'
  if (score >= 8) return '🥈'
  return '🥉'
}

function ProgressBar({ value }) {
  return (
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${value * 10}%` }} />
    </div>
  )
}

function ResponseCard({ resp, onDelete, getToken }) {
  const [open, setOpen]       = useState(false)
  const [deleting, setDeleting] = useState(false)

  const {
    id,
    overall_score: ov = 0,
    transcript = '',
    clarity = 0, conciseness = 0, structure = 0, confidence = 0, relevance = 0,
    suggestion = '', encouragement = '',
    created_at = '',
  } = resp

  // Questions come as a nested object from Supabase join or as a flat question_text
  const questionText = resp.questions?.question_text ?? resp.question_text ?? resp.question ?? '—'
  const date = created_at ? created_at.slice(0, 10) : ''
  const preview = questionText.length > 72 ? questionText.slice(0, 72) + '…' : questionText

  const scores = { clarity, conciseness, structure, confidence, relevance }

  async function handleDelete() {
    setDeleting(true)
    try {
      const token = getToken?.()
      await fetch(`/api/responses/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      onDelete(id)
    } finally { setDeleting(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left', color: 'var(--text)',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{medal(ov)}</span>
        <span style={{
          background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
          borderRadius: 99, padding: '2px 10px', fontSize: '0.82rem', fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          {ov.toFixed(1)}/10
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.92rem' }}>{preview}</span>
        {date && <span style={{ color: 'var(--muted-2)', fontSize: '0.8rem', flexShrink: 0 }}>{date}</span>}
        <span style={{ color: 'var(--muted-2)', fontSize: '0.85rem', flexShrink: 0, marginLeft: 4 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div className="col-3-2" style={{ gap: 24, marginTop: 16 }}>
            {/* Left: question + transcript */}
            <div>
              <div className="question-card" style={{ marginBottom: 12 }}>{questionText}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Your answer:</div>
              <div className="card" style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#cbd5e1' }}>
                {transcript}
              </div>
            </div>

            {/* Right: scores */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>Category scores:</div>
              {CATEGORIES.map(cat => {
                const val = scores[cat] ?? 0
                return (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.88rem' }}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                      <span className={`pill ${pillClass(val)}`}>{val}/10</span>
                    </div>
                    <ProgressBar value={val} />
                  </div>
                )
              })}
              {(suggestion || encouragement) && (
                <>
                  <hr />
                  {suggestion && (
                    <p className="caption" style={{ marginBottom: 6 }}>
                      <span style={{ color: 'var(--amber)', fontWeight: 700 }}>💡</span> {suggestion}
                    </p>
                  )}
                  {encouragement && (
                    <p className="caption">
                      <span style={{ color: 'var(--green)', fontWeight: 700 }}>✨</span> {encouragement}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <hr />
          <button
            className="btn btn-secondary"
            onClick={handleDelete}
            disabled={deleting}
            style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          >
            {deleting ? '…' : '🗑 Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function BestResponses() {
  const { user, getToken } = useAuth()
  const [all, setAll]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [minScore, setMinScore] = useState(0)
  const [error, setError]       = useState(null)

  const load = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true); setError(null)
    const token = getToken?.()
    fetch(`/api/responses?user_id=${user.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then(data => setAll(Array.isArray(data) ? data.sort((a, b) => b.overall_score - a.overall_score) : []))
      .catch(e => { setError(e.message); setAll([]) })
      .finally(() => setLoading(false))
  }, [user, getToken])

  useEffect(() => { load() }, [load])

  function handleDelete(id) {
    setAll(prev => prev.filter(r => r.id !== id))
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'best_responses.json'
    a.click()
  }

  const total  = all.length
  const avgOv  = total ? +(all.reduce((s, r) => s + r.overall_score, 0) / total).toFixed(1) : 0
  const bestOv = total ? Math.max(...all.map(r => r.overall_score)) : 0

  const filtered = all.filter(r => r.overall_score >= minScore)

  return (
    <>
      <div className="page-header">
        <span className="page-header-icon">🏆</span>
        <div>
          <h2>Best Responses</h2>
          <p>Your saved high-scoring interview answers</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { num: total,             label: 'Saved' },
          { num: avgOv.toFixed(1),  label: 'Avg Score' },
          { num: bestOv.toFixed(1), label: 'Best Score' },
          { num: '—',               label: 'Roles Practiced' },
        ].map(({ num, label }) => (
          <div key={label} className="stat-block">
            <div className="stat-num">{num}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 220px' }}>
            <label>Min Score: {minScore.toFixed(1)}</label>
            <input
              type="range" min={0} max={10} step={0.5}
              value={minScore}
              onChange={e => setMinScore(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }}
            />
          </div>
          <button className="btn btn-secondary" onClick={exportJSON} disabled={!total}>
            ⬇ Export JSON
          </button>
        </div>
      </div>

      {/* Response list */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <span className="spinner" /> Loading…
        </div>
      ) : total === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🎯</div>
          <h3 style={{ marginBottom: 8 }}>No saved responses yet</h3>
          <p className="caption">Score 7.0 or above on the Practice page to save your best answers here.</p>
        </div>
      ) : (
        <>
          <p className="caption" style={{ marginBottom: 12 }}>
            <strong>{filtered.length}</strong> of {total} responses
          </p>
          {filtered.map(resp => (
            <ResponseCard key={resp.id} resp={resp} onDelete={handleDelete} getToken={getToken} />
          ))}
        </>
      )}
    </>
  )
}
