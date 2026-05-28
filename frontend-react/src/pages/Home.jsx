import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: '🎤', title: 'Voice Recording',
    desc: 'Record directly in the browser. Auto-stops after 5 seconds of silence — no button needed.' },
  { icon: '📝', title: 'Live Transcript',
    desc: 'Your answer is transcribed on the server using faster-whisper. No audio leaves the host.' },
  { icon: '📊', title: '5-Category Score',
    desc: 'Rated 0–10 on Clarity, Conciseness, Structure, Confidence, and Relevance.' },
  { icon: '🏆', title: 'Best Responses',
    desc: 'Answers scoring 7.0+ are saved to your account. Review and compare your strongest takes.' },
]

const STEPS = [
  ['Choose a role & question type',
   'Software Engineering, Marketing, Finance, and more — Behavioral, Technical, or Mixed.'],
  ['Get a question from the bank',
   'Draw from pre-loaded questions instantly. No LLM call needed.'],
  ['Record your answer',
   'Click the microphone. Speak naturally. The app auto-stops after 5s of silence.'],
  ['See your transcript appear',
   'faster-whisper processes audio server-side and returns text in seconds.'],
  ['Review your score',
   'Get a breakdown across 5 categories with specific coaching tips.'],
  ['Save high-scoring responses',
   'Anything 7.0+ is eligible to save to your personal Best Responses tracker.'],
]

export default function Home() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, avg: 0, best: 0 })

  useEffect(() => {
    if (!user) return
    fetch(`/api/responses?user_id=${user.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return
        const total = data.length
        const avg   = +(data.reduce((s, r) => s + r.overall_score, 0) / total).toFixed(1)
        const best  = Math.max(...data.map(r => r.overall_score))
        setStats({ total, avg, best })
      })
      .catch(() => {})
  }, [user])

  return (
    <>
      {/* ── Hero ── */}
      <div style={{ padding: '48px 0 32px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <div className="badge" style={{ marginBottom: 20 }}>
          🎙&nbsp; Interview coaching, no fluff
        </div>
        <h1 style={{
          fontSize: '2.8rem', fontWeight: 900, marginBottom: 12, letterSpacing: '-1px',
          background: 'linear-gradient(135deg,#e2e8f0,#a5b4fc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          InterviewAI Coach
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1.6 }}>
          Practice interview answers. Get scored instantly.<br />Land the job.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => nav('/practice')}
          style={{ marginTop: 28, padding: '12px 32px', fontSize: '1rem' }}
        >
          Start Practicing →
        </button>
      </div>

      {/* ── Feature cards ── */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {FEATURES.map(({ icon, title, desc }) => (
          <div key={title} className="feature-card">
            <div className="feature-card-icon">{icon}</div>
            <div className="feature-card-title">{title}</div>
            <div className="feature-card-desc">{desc}</div>
          </div>
        ))}
      </div>

      {/* ── How it works + Stats ── */}
      <div className="col-3-2">
        {/* Left: steps */}
        <div>
          <div className="section-title">How it works</div>
          {STEPS.map(([title, desc], i) => (
            <div key={i} className="step">
              <div className="step-num">{i + 1}</div>
              <div className="step-text"><strong>{title}</strong><br />{desc}</div>
            </div>
          ))}
        </div>

        {/* Right: stats */}
        <div>
          <div className="section-title">Your progress</div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="stat-block">
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">Saved Responses</div>
            </div>
            <div className="stat-block">
              <div className="stat-num">{stats.total ? stats.avg.toFixed(1) : '—'}</div>
              <div className="stat-label">Avg Score</div>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="stat-block">
              <div className="stat-num">{stats.total ? stats.best.toFixed(1) : '—'}</div>
              <div className="stat-label">Best Score</div>
            </div>
            <div className="stat-block">
              <div className="stat-num">45+</div>
              <div className="stat-label">Questions</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => nav('/practice')}
          >
            Go Practice →
          </button>
        </div>
      </div>

      {/* ── Privacy note ── */}
      <hr />
      <p style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: '0.82rem' }}>
        🔒 Audio is processed on the server — not sent to any third party.
        Transcription runs via <code>faster-whisper</code>.
      </p>
    </>
  )
}
