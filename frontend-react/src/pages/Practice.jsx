import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import localQuestions from '../data/questions.json'

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['clarity', 'conciseness', 'structure', 'confidence', 'relevance']
const SILENCE_SECONDS = 5

// Roles derived from the bundled JSON — always in sync, no duplication
const ROLES = Object.keys(localQuestions).map(key => ({
  value: key,
  label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}))

// Difficulty maps to question type internally; integers never shown in UI
const DIFFICULTIES = [
  { value: 'all',    label: 'All Difficulties', type: null },
  { value: 'easy',   label: 'Easy',             type: 'behavioral' },
  { value: 'medium', label: 'Medium',           type: 'mixed'      },
  { value: 'hard',   label: 'Hard',             type: 'technical'  },
]

const DIFF_PILL = { behavioral: 'pill-green', mixed: 'pill-amber', technical: 'pill-red' }
const DIFF_LABEL = { behavioral: 'Easy', mixed: 'Medium', technical: 'Hard' }

// ── On-click question fetch ────────────────────────────────────────────────────
// Tries GET /api/questions first (may return richer Supabase data),
// falls back to the bundled JSON silently.
async function fetchOneQuestion(role, difficultyValue) {
  const diff = DIFFICULTIES.find(d => d.value === difficultyValue)
  const type = diff?.type  // null = all types

  // Build candidate list from bundled JSON (instant, always available)
  const roleData = localQuestions[role] ?? {}
  let candidates = []
  for (const [qtype, texts] of Object.entries(roleData)) {
    if (!type || qtype === type) {
      texts.forEach((text, i) => {
        candidates.push({ id: `${role}__${qtype}__${i}`, question_text: text, type: qtype })
      })
    }
  }

  // Try to get a fresh list from the API (may have more questions from Supabase)
  try {
    const types = type ? [type] : Object.keys(roleData)
    const results = await Promise.all(
      types.map(t => fetch(`/api/questions?role=${role}&type=${t}`).then(r => r.ok ? r.json() : []))
    )
    const apiItems = results.flat().filter(q => q?.question_text)
    if (apiItems.length > 0) {
      // Annotate with type if missing (API may not return it)
      candidates = results.flatMap((items, i) =>
        items.map(q => ({ ...q, type: types[i] }))
      ).filter(q => q?.question_text)
    }
  } catch {
    // API unavailable — use bundled candidates already set above
  }

  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pillClass(score) {
  if (score >= 7) return 'pill-green'
  if (score >= 5) return 'pill-amber'
  return 'pill-red'
}
function scoreClass(score) {
  if (score >= 7) return 'score-green'
  if (score >= 5) return 'score-amber'
  return 'score-red'
}

// ── Audio recorder hook ────────────────────────────────────────────────────────
function useAudioRecorder({ onStop, silenceSeconds = SILENCE_SECONDS }) {
  const [status, setStatus] = useState('idle')
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])
  const rafRef    = useRef(null)

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop()
  }, [])

  const startRecording = useCallback(async () => {
    chunksRef.current = []
    setStatus('recording')
    const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRef.current = recorder

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let silenceSince = null

    function checkSilence() {
      analyser.getByteFrequencyData(data)
      const rms = data.reduce((s, v) => s + v, 0) / data.length
      if (rms < 5) {
        if (!silenceSince) silenceSince = Date.now()
        else if (Date.now() - silenceSince > silenceSeconds * 1000) { stopRecording(); return }
      } else { silenceSince = null }
      rafRef.current = requestAnimationFrame(checkSilence)
    }
    rafRef.current = requestAnimationFrame(checkSilence)

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      ctx.close()
      setStatus('stopped')
      onStop(new Blob(chunksRef.current, { type: recorder.mimeType }))
    }
    recorder.start(250)
  }, [onStop, silenceSeconds, stopRecording])

  return { status, startRecording, stopRecording }
}

// ── ScorePanel ─────────────────────────────────────────────────────────────────
function ScorePanel({ result, currentQ, transcript, filler, userId, getToken, minScore = 7.0 }) {
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  const resultRef = useRef(null)
  if (resultRef.current !== result) {
    resultRef.current = result
    if (saved || saveErr) { setSaved(false); setSaveErr(null) }
  }

  if (!result) {
    return (
      <div className="card empty-state">
        <div className="empty-state-icon">🎯</div>
        <p>Record your answer, then click<br /><strong>Score My Response</strong></p>
      </div>
    )
  }

  const ov = result.overall_score ?? 0

  async function handleSave() {
    if (!userId) { setSaveErr('Sign in to save responses.'); return }
    setSaving(true); setSaveErr(null)
    try {
      const token = getToken?.()
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id:       userId,
          question_id:   currentQ?.id   ?? '',
          question_text: currentQ?.question_text ?? '',
          transcript,
          clarity:       result.clarity,
          conciseness:   result.conciseness,
          structure:     result.structure,
          confidence:    result.confidence,
          relevance:     result.relevance,
          overall_score: ov,
          suggestion:    result.suggestion    ?? '',
          encouragement: result.encouragement ?? '',
          filler_count:  filler?.filler_count ?? 0,
          filler_rate:   filler?.filler_rate  ?? 0.0,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Save failed')
      setSaved(true)
    } catch (e) {
      setSaveErr(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={`score-ring ${scoreClass(ov)}`}>
        {ov.toFixed(1)}<small>Overall</small>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: '0.78rem', marginTop: -6, marginBottom: 16 }}>
        scored by <code>{result.scorer || '?'}</code>
      </p>
      <hr />

      {CATEGORIES.map(cat => {
        const val = result[cat] ?? 0
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
              <span className={`pill ${pillClass(val)}`}>{val}/10</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${val * 10}%` }} />
            </div>
          </div>
        )
      })}

      {result.suggestion && (
        <>
          <hr />
          <div className="card" style={{ borderLeft: '3px solid var(--amber)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 10 }}>
            <span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💡 Suggestion
            </span>
            <p style={{ marginTop: 6, color: 'var(--text)' }}>{result.suggestion}</p>
          </div>
        </>
      )}
      {result.encouragement && (
        <div className="card" style={{ borderLeft: '3px solid var(--green)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✨ Coach says
          </span>
          <p style={{ marginTop: 6, color: 'var(--text)' }}>{result.encouragement}</p>
        </div>
      )}

      <hr />
      {saveErr && <div className="alert alert-error" style={{ marginBottom: 8 }}>{saveErr}</div>}
      {ov >= minScore && !saved && (
        <>
          <div className="alert alert-success" style={{ marginBottom: 8 }}>🏆 High score! Save this response?</div>
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : '💾 Save to Best Responses'}
          </button>
        </>
      )}
      {saved && <div className="alert alert-success">✅ Saved to your Best Responses.</div>}
      {!saved && ov < minScore && (
        <p className="caption" style={{ textAlign: 'center' }}>Score {minScore.toFixed(1)}+ to save. Current: {ov.toFixed(1)}. Keep going!</p>
      )}
    </div>
  )
}

// ── Filler metrics ─────────────────────────────────────────────────────────────
function FillerMetrics({ filler }) {
  if (!filler) return null
  return (
    <div className="grid-3" style={{ marginTop: 12 }}>
      {[
        { num: filler.total_words,                         label: 'Words' },
        { num: filler.filler_count,                        label: 'Fillers' },
        { num: `${(filler.filler_rate ?? 0).toFixed(1)}%`, label: 'Filler Rate' },
      ].map(({ num, label }) => (
        <div key={label} className="stat-block" style={{ padding: 12 }}>
          <div className="stat-num" style={{ fontSize: '1.4rem' }}>{num}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Practice page ──────────────────────────────────────────────────────────────
export default function Practice() {
  const { user, getToken } = useAuth()
  const [minScore, setMinScore] = useState(7.0)

  // Load runtime config (best_response_min_score may differ from default 7.0)
  useState(() => {
    fetch('/api/config').then(r => r.ok ? r.json() : {}).then(cfg => {
      if (cfg.best_response_min_score) setMinScore(cfg.best_response_min_score)
    }).catch(() => {})
  })

  const [role,         setRole]         = useState(ROLES[0].value)
  const [difficulty,   setDifficulty]   = useState('all')
  const [currentQ,     setCurrentQ]     = useState(null)
  const [fetching,     setFetching]     = useState(false)
  const [fetchErr,     setFetchErr]     = useState(null)
  const [audioURL,     setAudioURL]     = useState(null)
  const [transcript,   setTranscript]   = useState('')
  const [filler,       setFiller]       = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [scoring,      setScoring]      = useState(false)
  const [result,       setResult]       = useState(null)

  // ── New Question — fetches on click ─────────────────────────────────────────
  async function handleNewQuestion() {
    setFetching(true); setFetchErr(null)
    setAudioURL(null); setTranscript(''); setFiller(null); setResult(null)
    try {
      const q = await fetchOneQuestion(role, difficulty)
      if (!q) throw new Error(`No questions found for ${role} / ${difficulty}`)
      setCurrentQ(q)
    } catch (e) {
      setFetchErr(e.message)
      setCurrentQ(null)
    } finally { setFetching(false) }
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async (blob) => {
    setAudioURL(URL.createObjectURL(blob))
    setTranscript(''); setFiller(null); setResult(null)
    setTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'recording.webm')
      const res  = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setTranscript(data.transcript || '')
      setFiller(data.filler || null)
    } catch (e) {
      setTranscript('Transcription failed: ' + e.message)
    } finally { setTranscribing(false) }
  }, [])

  const { status: recStatus, startRecording, stopRecording } = useAudioRecorder({ onStop: handleStop })

  // ── Scoring ──────────────────────────────────────────────────────────────────
  async function scoreResponse() {
    if (!currentQ || !transcript) return
    setScoring(true)
    try {
      const res  = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQ.question_text, transcript }),
      })
      if (!res.ok) {
        const detail = await res.json().then(j => j.detail ?? res.statusText).catch(() => res.statusText)
        throw new Error(detail)
      }
      setResult(await res.json())
    } catch (e) { alert('Scoring failed: ' + e.message) }
    finally { setScoring(false) }
  }

  const roleLabel = ROLES.find(r => r.value === role)?.label ?? role
  const qDiff     = currentQ ? DIFF_LABEL[currentQ.type]  ?? '' : ''
  const qPill     = currentQ ? DIFF_PILL[currentQ.type]   ?? 'pill-green' : ''

  return (
    <>
      <div className="page-header">
        <span className="page-header-icon">🎙</span>
        <div>
          <h2>Practice Session</h2>
          <p>Record your answer and get instant feedback</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label>Role</label>
          <select value={role} onChange={e => { setRole(e.target.value); setCurrentQ(null); setResult(null) }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label>Difficulty</label>
          <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setCurrentQ(null); setResult(null) }}>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleNewQuestion} disabled={fetching}>
          {fetching
            ? <><span className="spinner" />&nbsp; Loading…</>
            : currentQ ? '🔀 Next Question' : '🎲 New Question'}
        </button>
      </div>

      {/* Error state */}
      {fetchErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{fetchErr}</div>}

      {/* Question card */}
      {currentQ ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="pill pill-green">{roleLabel}</span>
            <span className={`pill ${qPill}`}>{qDiff}</span>
          </div>
          <div className="question-card">{currentQ.question_text}</div>
        </>
      ) : !fetchErr && (
        <div style={{
          background: 'rgba(99,102,241,0.07)', border: '1px dashed rgba(99,102,241,0.3)',
          borderRadius: 12, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎲</div>
          <div style={{ color: 'var(--muted)' }}>
            Pick a role and difficulty, then click <strong>New Question</strong>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />

      {/* Two-column layout */}
      <div className="col-3-2">

        {/* LEFT: recorder + transcript */}
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>Record Your Answer</div>
          <p className="caption" style={{ marginBottom: 16 }}>
            Click the mic. Auto-stops after {SILENCE_SECONDS}s of silence.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {recStatus === 'recording' ? (
              <button className="mic-btn recording" onClick={stopRecording}>🛑</button>
            ) : (
              <button className="mic-btn idle" onClick={startRecording} disabled={transcribing}>🎙</button>
            )}
            {recStatus === 'recording' && (
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                <span className="recording-dot" /> Recording… click to stop early
              </span>
            )}
            {transcribing && (
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                <span className="spinner" />&nbsp; Transcribing…
              </span>
            )}
          </div>

          {audioURL && <audio controls src={audioURL} />}

          {transcript && !transcribing && (
            <>
              <div className="section-title" style={{ margin: '16px 0 8px' }}>📝 Transcript</div>
              <textarea rows={6} value={transcript} onChange={e => setTranscript(e.target.value)}
                style={{ resize: 'vertical' }} />
              <FillerMetrics filler={filler} />
              <div style={{ height: 16 }} />
              {!result && (
                <button className="btn btn-primary btn-full" onClick={scoreResponse}
                  disabled={scoring || !currentQ}>
                  {scoring ? <><span className="spinner" />&nbsp; Analysing…</> : '📊 Score My Response'}
                </button>
              )}
            </>
          )}

          <div className="hint-box" style={{ marginTop: 20 }}>
            🎙 Auto-stops after <strong>5s silence</strong><br />
            📝 Edit transcript before scoring if needed<br />
            🟢 Easy &nbsp;·&nbsp; 🟡 Medium &nbsp;·&nbsp; 🔴 Hard
          </div>
        </div>

        {/* RIGHT: score panel */}
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>📊 Score</div>
          <ScorePanel
            result={result}
            currentQ={currentQ}
            transcript={transcript}
            filler={filler}
            userId={user?.id ?? null}
            getToken={getToken}
            minScore={minScore}
          />
        </div>

      </div>
    </>
  )
}
