import { useState, useEffect, useRef, useCallback } from 'react'

const CATEGORIES = ['clarity', 'conciseness', 'structure', 'confidence', 'relevance']
const SILENCE_SECONDS = 5

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

// ── Audio recorder hook ───────────────────────────────────────────────────────
function useAudioRecorder({ onStop, silenceSeconds = SILENCE_SECONDS }) {
  const [status, setStatus]   = useState('idle') // idle | recording | stopped
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])
  const silenceRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef    = useRef(null)

  const stopRecording = useCallback((reason = 'manual') => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(silenceRef.current)
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop()
    }
    if (reason === 'silence') {
      // mediaRef onstop handles the rest
    }
  }, [])

  const startRecording = useCallback(async () => {
    chunksRef.current = []
    setStatus('recording')

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' })
    mediaRef.current = recorder

    // Silence detection via Web Audio API
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    analyserRef.current = analyser

    let silenceSince = null
    const data = new Uint8Array(analyser.frequencyBinCount)

    function checkSilence() {
      analyser.getByteFrequencyData(data)
      const rms = data.reduce((s, v) => s + v, 0) / data.length
      if (rms < 5) {
        if (!silenceSince) silenceSince = Date.now()
        else if (Date.now() - silenceSince > silenceSeconds * 1000) {
          stopRecording('silence')
          return
        }
      } else {
        silenceSince = null
      }
      rafRef.current = requestAnimationFrame(checkSilence)
    }
    rafRef.current = requestAnimationFrame(checkSilence)

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      ctx.close()
      setStatus('stopped')
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      onStop(blob)
    }

    recorder.start(250)
  }, [onStop, silenceSeconds, stopRecording])

  return { status, startRecording, stopRecording }
}

// ── ScorePanel ────────────────────────────────────────────────────────────────
function ScorePanel({ result, question, transcript, onSaved }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!result) {
    return (
      <div className="card empty-state">
        <div className="empty-state-icon">🎯</div>
        <p>Record your answer, then click<br /><strong>Score My Response</strong></p>
      </div>
    )
  }

  const { scores, overall_score: ov } = result

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/best-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          transcript,
          scores,
          overall_score: ov,
          role: result.role,
          interview_type: result.interview_type,
        }),
      })
      if (res.ok) { setSaved(true); onSaved?.() }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Ring */}
      <div className={`score-ring ${scoreClass(ov)}`}>
        {ov.toFixed(1)}
        <small>Overall</small>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: '0.78rem', marginTop: -6, marginBottom: 16 }}>
        scored by <code>{scores.scorer || '?'}</code>
      </p>

      <hr />

      {/* Category bars */}
      {CATEGORIES.map(cat => {
        const val = scores[cat] ?? 0
        const fb  = scores[`${cat}_feedback`] ?? ''
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
              <span className={`pill ${pillClass(val)}`}>{val}/10</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${val * 10}%` }} />
            </div>
            {fb && <p className="caption">{fb}</p>}
          </div>
        )
      })}

      {/* Overall feedback */}
      {scores.feedback && (
        <>
          <hr />
          <div className="card" style={{ borderLeft: '3px solid var(--accent)', fontSize: '0.92rem', lineHeight: 1.6 }}>
            💬 {scores.feedback}
          </div>
        </>
      )}

      {/* Save CTA */}
      <hr />
      {ov >= 7 && !saved && (
        <>
          <div className="alert alert-success" style={{ marginBottom: 8 }}>🏆 High score! Save this response?</div>
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : '💾 Save to Best Responses'}
          </button>
        </>
      )}
      {saved && <div className="alert alert-success">✅ Saved to Best Responses.</div>}
      {!saved && ov < 7 && (
        <p className="caption" style={{ textAlign: 'center' }}>Score 7.0+ to save. Current: {ov.toFixed(1)}. Keep going!</p>
      )}
    </div>
  )
}

// ── FillerMetrics ─────────────────────────────────────────────────────────────
function FillerMetrics({ filler }) {
  if (!filler) return null
  return (
    <div className="grid-3" style={{ marginTop: 12 }}>
      <div className="stat-block" style={{ padding: 12 }}>
        <div className="stat-num" style={{ fontSize: '1.4rem' }}>{filler.total_words}</div>
        <div className="stat-label">Words</div>
      </div>
      <div className="stat-block" style={{ padding: 12 }}>
        <div className="stat-num" style={{ fontSize: '1.4rem' }}>{filler.filler_count}</div>
        <div className="stat-label">Fillers</div>
      </div>
      <div className="stat-block" style={{ padding: 12 }}>
        <div className="stat-num" style={{ fontSize: '1.4rem' }}>{(filler.filler_rate ?? 0).toFixed(1)}%</div>
        <div className="stat-label">Filler Rate</div>
      </div>
    </div>
  )
}

// ── Main Practice page ────────────────────────────────────────────────────────
export default function Practice() {
  const [questions, setQuestions]   = useState({})
  const [role, setRole]             = useState('')
  const [itype, setItype]           = useState('')
  const [question, setQuestion]     = useState(null)

  const [audioURL, setAudioURL]     = useState(null)
  const [transcript, setTranscript] = useState('')
  const [filler, setFiller]         = useState(null)
  const [transcribing, setTranscribing] = useState(false)

  const [scoring, setScoring]       = useState(false)
  const [result, setResult]         = useState(null)

  // Load question bank
  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then(data => {
        setQuestions(data)
        const firstRole = Object.keys(data)[0] || ''
        setRole(firstRole)
        const firstType = Object.keys(data[firstRole] || {})[0] || ''
        setItype(firstType)
      })
      .catch(() => {})
  }, [])

  // When role changes, reset interview type
  useEffect(() => {
    if (!questions[role]) return
    const firstType = Object.keys(questions[role])[0] || ''
    setItype(firstType)
  }, [role, questions])

  const roleLabel  = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const itypeLabel = itype.charAt(0).toUpperCase() + itype.slice(1)
  const pool       = questions?.[role]?.[itype] ?? []

  function newQuestion() {
    if (!pool.length) return
    setQuestion(pool[Math.floor(Math.random() * pool.length)])
    setAudioURL(null)
    setTranscript('')
    setFiller(null)
    setResult(null)
  }

  // Audio recorder
  const handleStop = useCallback(async (blob) => {
    const url = URL.createObjectURL(blob)
    setAudioURL(url)
    setTranscript('')
    setFiller(null)
    setResult(null)
    setTranscribing(true)

    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setTranscript(data.transcript || '')
      setFiller(data.filler || null)
    } catch (e) {
      setTranscript('Transcription failed: ' + e.message)
    } finally {
      setTranscribing(false)
    }
  }, [])

  const { status: recStatus, startRecording, stopRecording } = useAudioRecorder({ onStop: handleStop })

  async function scoreResponse() {
    if (!question || !transcript) return
    setScoring(true)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, transcript }),
      })
      const data = await res.json()
      setResult({ ...data, role, interview_type: itype })
    } catch (e) {
      alert('Scoring failed: ' + e.message)
    } finally {
      setScoring(false)
    }
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <span className="page-header-icon">🎙</span>
        <div>
          <h2>Practice Session</h2>
          <p>Record your answer and get instant feedback</p>
        </div>
      </div>

      {/* ── Setup controls ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {Object.keys(questions).map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label>Interview Type</label>
          <select value={itype} onChange={e => setItype(e.target.value)}>
            {Object.keys(questions[role] || {}).map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={newQuestion} disabled={!pool.length}>
          🎲 New Question
        </button>
      </div>

      {/* ── Question card ── */}
      {question ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="pill pill-green">{roleLabel}</span>
            <span className="pill pill-amber">{itypeLabel}</span>
          </div>
          <div className="question-card">{question}</div>
        </>
      ) : (
        <div style={{
          background: 'rgba(99,102,241,0.07)', border: '1px dashed rgba(99,102,241,0.3)',
          borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 8,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎲</div>
          <div style={{ color: 'var(--muted)' }}>Click <strong>New Question</strong> to get started</div>
        </div>
      )}

      <div style={{ height: 24 }} />

      {/* ── Two-column layout ── */}
      <div className="col-3-2">

        {/* LEFT: recorder + transcript */}
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>Record Your Answer</div>
          <p className="caption" style={{ marginBottom: 16 }}>
            Click the mic. Auto-stops after {SILENCE_SECONDS} seconds of silence.
          </p>

          {/* Mic button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {recStatus === 'recording' ? (
              <button
                className="mic-btn recording"
                onClick={stopRecording}
                title="Stop recording"
              >🛑</button>
            ) : (
              <button
                className="mic-btn idle"
                onClick={startRecording}
                disabled={transcribing}
                title="Start recording"
              >🎙</button>
            )}
            {recStatus === 'recording' && (
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                <span className="recording-dot" /> Recording… (click to stop)
              </span>
            )}
            {transcribing && (
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                <span className="spinner" /> &nbsp;Transcribing…
              </span>
            )}
          </div>

          {/* Audio playback */}
          {audioURL && <audio controls src={audioURL} />}

          {/* Transcript */}
          {transcript && !transcribing && (
            <>
              <div className="section-title" style={{ margin: '16px 0 8px' }}>📝 Transcript</div>
              <textarea
                rows={6}
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                style={{ resize: 'vertical' }}
              />

              <FillerMetrics filler={filler} />

              <div style={{ height: 16 }} />

              {!result && (
                <button
                  className="btn btn-primary btn-full"
                  onClick={scoreResponse}
                  disabled={scoring || !question}
                >
                  {scoring
                    ? <><span className="spinner" /> &nbsp;Analysing…</>
                    : '📊 Score My Response'}
                </button>
              )}
            </>
          )}

          {/* Hint box */}
          <div className="hint-box" style={{ marginTop: 20 }}>
            🎙 Auto-stops after <strong>5s silence</strong><br />
            📝 Transcript appears after recording<br />
            🏆 Score 7.0+ to save a response
          </div>
        </div>

        {/* RIGHT: score panel */}
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>📊 Score</div>
          <ScorePanel
            result={result}
            question={question}
            transcript={transcript}
          />
        </div>

      </div>
    </>
  )
}
