import { useState, useEffect } from 'react'

const MODEL_OPTIONS = {
  tiny:   'Tiny (~75 MB) — Fastest, OK accuracy',
  base:   'Base (~145 MB) — Recommended for most machines',
  small:  'Small (~465 MB) — Better accuracy, ~3× slower',
  medium: 'Medium (~1.5 GB) — Best accuracy, needs 4+ GB RAM',
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{title}</div>
      <hr style={{ margin: '8px 0 16px' }} />
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  const map = {
    ok:      { cls: 'alert-success', icon: '✅' },
    warn:    { cls: 'alert-warning', icon: '⚠️' },
    error:   { cls: 'alert-error',   icon: '❌' },
    loading: { cls: 'alert-info',    icon: '⏳' },
  }
  const { cls, icon } = map[status.type] || map.error
  return <div className={`alert ${cls}`}>{icon} {status.message}</div>
}

export default function Settings() {
  const [form, setForm] = useState({
    transcription_model: 'base',
    ollama_base_url:     'http://localhost:11434',
    ollama_model:        'llama3.2',
    hf_token:            '',
    best_response_min_score:    '7.0',
    silence_threshold_seconds:  '5.0',
  })

  const [saved,       setSaved]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState(null)
  const [hfStatus,     setHfStatus]     = useState(null)
  const [sysInfo,      setSysInfo]      = useState(null)
  const [dangerCount,  setDangerCount]  = useState(null)
  const [clearing,     setClearing]     = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => setForm(f => ({ ...f, ...data }))).catch(() => {})
    fetch('/api/system-info').then(r => r.json()).then(setSysInfo).catch(() => {})
    fetch('/api/best-responses').then(r => r.json()).then(d => setDangerCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
  }, [])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) setSaved(true)
      else throw new Error(await res.text())
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function testOllama() {
    setOllamaStatus({ type: 'loading', message: 'Connecting…' })
    try {
      const res = await fetch('/api/settings/test-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.ollama_base_url, model: form.ollama_model }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.model_found) {
          setOllamaStatus({ type: 'ok', message: `Connected. Model \`${form.ollama_model}\` is available.` })
        } else {
          setOllamaStatus({ type: 'warn', message: `Connected but \`${form.ollama_model}\` not found. Available: ${(data.available_models || []).join(', ')}` })
        }
      } else {
        setOllamaStatus({ type: 'error', message: data.detail || 'Connection failed' })
      }
    } catch (e) {
      setOllamaStatus({ type: 'error', message: String(e) })
    }
  }

  async function testHF() {
    if (!form.hf_token || form.hf_token === '***') {
      setHfStatus({ type: 'warn', message: 'No token entered.' })
      return
    }
    setHfStatus({ type: 'loading', message: 'Authenticating…' })
    try {
      const res = await fetch('/api/settings/test-hf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: form.hf_token }),
      })
      const data = await res.json()
      if (res.ok) setHfStatus({ type: 'ok', message: `Connected as ${data.username}.` })
      else setHfStatus({ type: 'error', message: data.detail || 'Auth failed' })
    } catch (e) {
      setHfStatus({ type: 'error', message: String(e) })
    }
  }

  async function clearAll() {
    if (!window.confirm(`Delete all ${dangerCount} saved responses? This cannot be undone.`)) return
    setClearing(true)
    try {
      await fetch('/api/best-responses/all', { method: 'DELETE' })
      setDangerCount(0)
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <span className="page-header-icon">⚙️</span>
        <div>
          <h2>Settings</h2>
          <p>Configure AI models and preferences</p>
        </div>
      </div>

      {/* ── Transcription ── */}
      <Section title="🎙 Transcription Model">
        <p className="caption" style={{ marginBottom: 12 }}>
          faster-whisper runs locally on your CPU. Larger models are more accurate but slower.
        </p>
        <div style={{ maxWidth: 400 }}>
          <label>Model size</label>
          <select value={form.transcription_model} onChange={e => set('transcription_model', e.target.value)}>
            {Object.entries(MODEL_OPTIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </Section>

      {/* ── LLM Scoring ── */}
      <Section title="🤖 LLM Scoring Engine">
        <p className="caption" style={{ marginBottom: 16 }}>
          Scoring tries providers in order: <strong>Ollama → HuggingFace → Rule-based</strong>.
          Rule-based scoring always works with no setup.
        </p>
        <div className="grid-2" style={{ gap: 32 }}>
          {/* Ollama */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Ollama (local)</div>
            <p className="caption" style={{ marginBottom: 12 }}>
              <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                Install Ollama →
              </a>{' '}then run <code>ollama pull llama3.2</code>
            </p>
            <label>Base URL</label>
            <input
              type="text"
              value={form.ollama_base_url}
              onChange={e => set('ollama_base_url', e.target.value)}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '8px 12px', width: '100%', marginBottom: 10, outline: 'none' }}
            />
            <label>Model name</label>
            <input
              type="text"
              value={form.ollama_model}
              onChange={e => set('ollama_model', e.target.value)}
              placeholder="llama3.2"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '8px 12px', width: '100%', marginBottom: 10, outline: 'none' }}
            />
            <button className="btn btn-secondary" onClick={testOllama} style={{ marginBottom: 8 }}>
              Test Ollama connection
            </button>
            <StatusBadge status={ollamaStatus} />
          </div>

          {/* HuggingFace */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>HuggingFace (cloud fallback)</div>
            <p className="caption" style={{ marginBottom: 12 }}>
              Get a free token at{' '}
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                huggingface.co/settings/tokens
              </a>
            </p>
            <label>HuggingFace token</label>
            <input
              type="password"
              value={form.hf_token}
              onChange={e => set('hf_token', e.target.value)}
              placeholder="hf_..."
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '8px 12px', width: '100%', marginBottom: 10, outline: 'none' }}
            />
            <button className="btn btn-secondary" onClick={testHF} style={{ marginBottom: 8 }}>
              Test HuggingFace connection
            </button>
            <StatusBadge status={hfStatus} />
          </div>
        </div>
      </Section>

      {/* ── Preferences ── */}
      <Section title="🎛 Preferences">
        <div className="grid-2" style={{ maxWidth: 600 }}>
          <div>
            <label>Min score to save: {parseFloat(form.best_response_min_score).toFixed(1)}</label>
            <input
              type="range" min={5} max={10} step={0.5}
              value={form.best_response_min_score}
              onChange={e => set('best_response_min_score', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }}
            />
            <p className="caption">Responses must meet this threshold to be saved.</p>
          </div>
          <div>
            <label>Silence auto-stop: {parseFloat(form.silence_threshold_seconds).toFixed(1)}s</label>
            <input
              type="range" min={2} max={10} step={0.5}
              value={form.silence_threshold_seconds}
              onChange={e => set('silence_threshold_seconds', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }}
            />
            <p className="caption">Seconds of silence before the recorder auto-stops.</p>
          </div>
        </div>
      </Section>

      {/* ── Save button ── */}
      <div style={{ marginBottom: 32 }}>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ minWidth: 180 }}>
          {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Settings'}
        </button>
        {saved && (
          <span style={{ marginLeft: 12, color: 'var(--green)', fontSize: '0.9rem' }}>
            ✅ Saved — restart the server for model changes to take effect.
          </span>
        )}
      </div>

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
          <button
            className="btn btn-secondary"
            onClick={clearAll}
            disabled={clearing || dangerCount === 0}
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: 'var(--red)' }}
          >
            {clearing ? <><span className="spinner" /> Deleting…</> : '🗑 Delete all saved responses'}
          </button>
        </div>
      </Section>

      {/* ── System info ── */}
      <Section title="ℹ️ System Info">
        {sysInfo ? (
          <div className="grid-2" style={{ maxWidth: 520 }}>
            <div>
              <p className="caption" style={{ marginBottom: 6 }}><strong>Python:</strong> <code>{sysInfo.python}</code></p>
              <p className="caption"><strong>Platform:</strong> <code>{sysInfo.platform}</code></p>
            </div>
            <div>
              {[
                ['faster-whisper', sysInfo.faster_whisper],
                ['ollama client',  sysInfo.ollama],
                ['fastapi',        sysInfo.fastapi],
              ].map(([name, ok]) => (
                <p key={name} className="caption" style={{ marginBottom: 6 }}>
                  <strong>{name}:</strong> {ok ? '✅ installed' : '❌ not installed'}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <span className="spinner" />
        )}
      </Section>
    </>
  )
}
