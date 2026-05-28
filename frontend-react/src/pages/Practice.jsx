import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['clarity', 'conciseness', 'structure', 'confidence', 'relevance']
const SILENCE_SECONDS = 5

const ROLES = [
  { value: 'software_engineering', label: 'Software Engineering' },
  { value: 'marketing',            label: 'Marketing' },
  { value: 'finance',              label: 'Finance' },
  { value: 'product_management',   label: 'Product Management' },
  { value: 'data_science',         label: 'Data Science' },
]

const TYPES = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'technical',  label: 'Technical' },
  { value: 'mixed',      label: 'Mixed' },
]

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
  const [status, setStatus]    = useState('idle')
  const mediaRef   = useRef(null)
  const chunksRef  = useRef([])
  const rafRef     = useRef(null)

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    chunksRef.current = []
    setStatus('recording')

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRef.current = recorder

    const ctx      = new AudioContext()
    const source   = ctx.createMediaStreamSource(stream)
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
        else if (Date.now() - silenceSince > silenceSeconds * 1000) {
          stopRecording(); return
        }
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
function ScorePanel({ result, questionId, question, transcript, filler, userId, minScore = 7.0 }) {
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  // Reset saved state when result changes
  useEffect(() => { setSaved(false); setSaveErr(null) }, [result])

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
    if (!questionId) { setSaveErr('No question ID — cannot save.'); return }
    setSaving(true); setSaveErr(null)
    try {
      const body = {
        user_id:       userId,
        question_id:   questionId,
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
      }
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Save failed')
      }
      setSaved(true)
    } catch (e) {
      setSaveErr(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div>
      {/* Overall ring */}
      <div className={`score-ring ${scoreClass(ov)}`}>
        {ov.toFixed(1)}
        <small>Overall</small>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: '0.78rem', marginTop: -6, marginBottom: 16 }}>
        scored by <code>{result.scorer || '?'}</code>
      </p>

      <hr />

      {/* Category bars */}
      {CATEGORIES.map(cat => {
        const val = result[cat] ?? 0
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <span className={`pill ${pillClass(val)}`}>{val}/10</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${val * 10}%` }} />
            </div>
          </div>
        )
      })}

      {/* Suggestion */}
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

      {/* Encouragement */}
      {result.encouragement && (
        <div className="card" style={{ borderLeft: '3px solid var(--green)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✨ Coach says
          </span>
          <p style={{ marginTop: 6, color: 'var(--text)' }}>{result.encouragement}</p>
        </div>
      )}

      {/* Save CTA */}
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
        <p className="caption" style={{ textAlign: 'center' }}>
          Score {minScore.toFixed(1)}+ to save. Current: {ov.toFixed(1)}. Keep going!
        </p>
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
        { num: filler.total_words,                       label: 'Words' },
        { num: filler.filler_count,                      label: 'Fillers' },
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
  const { user } = useAuth()

  const [role,         setRole]         = useState(ROLES[0].value)
  const [itype,        setItype]        = useState(TYPES[0].value)
  const [pool,         setPool]         = useState([])   // [{id, question_text}]
  const [poolLoading,  setPoolLoading]  = useState(false)
  const [currentQ,     setCurrentQ]     = useState(null) // {id, question_text}
  const [audioURL,     setAudioURL]     = useState(null)
  const [transcript,   setTranscript]   = useState('')
  const [filler,       setFiller]       = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [scoring,      setScoring]      = useState(false)
  const [result,       setResult]       = useState(null)

  // Fetch questions when role or type changes
  useEffect(() => {
    setPool([]); setCurrentQ(null); setResult(null)
    setPoolLoading(true)
    fetch(`/api/questions?role=${role}&type=${itype}`)
      .then(r => r.json())
      .then(data => setPool(Array.isArray(data) ? data : []))
      .catch(() => setPool([]))
      .finally(() => setPoolLoading(false))
  }, [role, itype])

  function newQuestion() {
    if (!pool.length) return
    const q = pool[Math.floor(Math.random() * pool.length)]
    setCurrentQ(q)
    setAudioURL(null); setTranscript(''); setFiller(null); setResult(null)
  }

  const handleStop = useCallback(async (blob) => {
    setAudioURL(URL.createObjectURL(blob))
    setTranscript(''); setFiller(null); setResult(null)
    setTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'recording.webm')  // field name: 'file' per API spec
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

  async function scoreResponse() {
    if (!currentQ || !transcript) return
    setScoring(true)
    try {
      const res  = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQ.question_text, transcript }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) { alert('Scoring failed: ' + e.message) }
    finally { setScoring(false) }
  }

  return (
    <>
      <div className="page-header">
        <span className="page-header-icon">🎙</span>
        <div>
          <h2>Practice Session</h2>
          <p>Record your answer and get instant feedback</p>
        </div>
      </div>

      {/* Setup controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label>Interview Type</label>
          <select value={itype} onChange={e => setItype(e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={newQuestion} disabled={!pool.length || poolLoading}>
          {poolLoading ? <><span className="spinner" />&nbsp;Loading…</> : '🎲 New Question'}
        </button>
      </div>

      {/* Question card */}
      {currentQ ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="pill pill-green">
              {ROLES.find(r => r.value === role)?.label ?? role}
            </span>
            <span className="pill pill-amber">
              {TYPES.find(t => t.value === itype)?.label ?? itype}
            </span>
          </div>
          <div className="question-card">{currentQ.question_text}</div>
        </>
      ) : (
        <div style={{
          background: 'rgba(99,102,241,0.07)', border: '1px dashed rgba(99,102,241,0.3)',
          borderRadius: 12, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎲</div>
          <div style={{ color: 'var(--muted)' }}>Click <strong>New Question</strong> to get started</div>
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
              <button className="mic-btn recording" onClick={stopRecording} title="Stop recording">🛑</button>
            ) : (
              <button className="mic-btn idle" onClick={startRecording} disabled={transcribing} title="Start recording">🎙</button>
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
                  disabled={scoring || !currentQ}
                >
                  {scoring
                    ? <><span className="spinner" />&nbsp; Analysing…</>
                    : '📊 Score My Response'}
                </button>
              )}
            </>
          )}

          <div className="hint-box" style={{ marginTop: 20 }}>
            🎙 Auto-stops after <strong>5s silence</strong><br />
            📝 Edit transcript before scoring if needed<br />
            🏆 Score 7.0+ to save a response
          </div>
        </div>

        {/* RIGHT: score panel */}
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>📊 Score</div>
          <ScorePanel
            result={result}
            questionId={currentQ?.id ?? null}
            question={currentQ?.question_text ?? ''}
            transcript={transcript}
            filler={filler}
            userId={user?.id ?? null}
          />
        </div>

      </div>
    </>
  )
}
