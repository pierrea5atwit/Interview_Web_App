# Frontend — React UI

## Entry Point
`frontend-react/src/main.jsx` → renders `App.jsx` inside `BrowserRouter`

## Routing (react-router-dom v6)
| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Home.jsx` | Hero, feature cards, how-it-works, live stats |
| `/practice` | `Practice.jsx` | Q selection, recorder, transcript, score panel |
| `/best-responses` | `BestResponses.jsx` | Saved high-score response tracker |
| `/settings` | `Settings.jsx` | Model config, preferences, system info |

## Build
```bash
cd frontend-react
npm install
npm run build          # outputs to frontend-react/dist/
npm run dev            # dev server on :5173, proxies /api → :7860
```

## Design Tokens (styles.css CSS variables)
- `--bg: #0f172a` — page background
- `--bg-2: #1e293b` — card background
- `--accent: #6366f1` — indigo primary
- `--accent-2: #8b5cf6` — purple secondary
- `--text: #e2e8f0`, `--muted: #94a3b8`

## Component Conventions
- Shared styles in `src/styles.css` (no CSS modules or Tailwind)
- No external component library — all UI is plain React + CSS classes
- API calls use native `fetch('/api/...')` — no axios

## Audio Recording
`Practice.jsx` uses the browser's `MediaRecorder` API with a custom hook (`useAudioRecorder`):
- Silence detection via `Web Audio API AnalyserNode` (auto-stop after 5s)
- Audio sent as `FormData` to `POST /api/transcribe`
- Playback via `<audio controls src={objectURL} />`

## Score Display
- Color-coded rings: green ≥7, amber ≥5, red <5
- Per-category progress bars with one-sentence feedback
- Save CTA only shown when overall ≥ 7.0
