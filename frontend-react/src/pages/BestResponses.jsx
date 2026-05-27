import { useState, useEffect, useCallback } from 'react'

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

function ResponseCard({ resp, onDelete }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { overall_score: ov, question, transcript, scores = {}, role = '', interview_type = '', timestamp = '' } = resp
  const roleLabel  = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const typeLabel  = interview_type.charAt(0).toUpperCase() + interview_type.slice(1)
  const date       = timestamp.slice(0, 10)
  const preview    = question.length > 72 ? question.slice(0, 72) + '…' : question

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/best-responses/${resp.id}`, { method: 'DELETE' })
      onDelete(resp.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {/* Header row — click to expand */}
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
        <span style={{ color: 'var(--muted-2)', fontSize: '0.85rem', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', margin: '12px 0 8px' }}>
            {roleLabel} · {typeLabel} · {date}
          </p>

          <div className="col-3-2" style={{ gap: 24 }}>
            {/* Left: question + transcript */}
            <div>
              <div className="question-card" style={{ marginBottom: 12 }}>{question}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Your answer:</div>
              <div className="card" style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#cbd5e1' }}>
                {transcript}
              </div>
            </div>

            {/* Right: category scores */}
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
              {scores.feedback && (
                <>
                  <hr />
                  <p className="caption">💬 {scores.feedback}</p>
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
  const [all, setAll]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterRole, setFilterRole] = useState([])
  const [minScore, setMinScore] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/best-responses')
      .then(r => r.json())
      .then(data => setAll(Array.isArray(data) ? data.sort((a, b) => b.overall_score - a.overall_score) : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }, [])

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
  const allRoles = [...new Set(all.map(r => (r.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())))]
    .filter(Boolean).sort()
  const rolesCount = new Set(all.map(r => r.role)).size

  const filtered = all.filter(r => {
    const rl = (r.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return (filterRole.length === 0 || filterRole.includes(rl)) && r.overall_score >= minScore
  })

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <span className="page-header-icon">🏆</span>
        <div>
          <h2>Best Responses</h2>
          <p>Your saved high-scoring interview answers</p>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { num: total,             label: 'Saved' },
          { num: avgOv.toFixed(1),  label: 'Avg Score' },
          { num: bestOv.toFixed(1), label: 'Best Score' },
          { num: rolesCount,        label: 'Roles Practiced' },
        ].map(({ num, label }) => (
          <div key={label} className="stat-block">
            <div className="stat-num">{num}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Role filter — multi-select via checkboxes */}
          <div style={{ flex: '1 1 200px' }}>
            <label>Filter by Role</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {allRoles.map(r => (
                <button
                  key={r}
                  className={`pill ${filterRole.includes(r) ? 'pill-green' : ''}`}
                  style={{
                    cursor: 'pointer', background: filterRole.includes(r) ? undefined : 'var(--bg)',
                    border: filterRole.includes(r) ? undefined : '1px solid var(--border)',
                    color: filterRole.includes(r) ? undefined : 'var(--muted)',
                  }}
                  onClick={() => setFilterRole(prev =>
                    prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                  )}
                >
                  {r}
                </button>
              ))}
              {filterRole.length > 0 && (
                <button
                  className="pill"
                  style={{ cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                  onClick={() => setFilterRole([])}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* Min score slider */}
          <div style={{ flex: '0 0 200px' }}>
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

      {/* ── Response list ── */}
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
            <ResponseCard key={resp.id} resp={resp} onDelete={handleDelete} />
          ))}
        </>
      )}
    </>
  )
}
