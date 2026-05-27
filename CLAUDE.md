# InterviewAI Coach — CLAUDE Context

## What This Project Is
A self-hosted web app for interview practice. Users select a role, receive questions from a local JSON bank, record their answer in the browser, see a transcript, and receive a scored evaluation (0–10) across 5 categories.

## Architecture
- **Frontend**: React 18 + Vite SPA (`frontend-react/`) — built to `dist/`, served as static files by FastAPI
- **Backend**: FastAPI + Uvicorn (`backend/app/main.py`) — REST API on port 7860
- **Hosting**: HuggingFace Spaces (Docker SDK), Fly.io, or Render

## Project Layout
```
frontend-react/         ← React + Vite (entry: npm run dev / npm run build)
  src/
    pages/
      Home.jsx          ← Landing page with stats
      Practice.jsx      ← Question selection + recording + scoring
      BestResponses.jsx ← Best response tracker
      Settings.jsx      ← Model & preference configuration
    components/
      Sidebar.jsx
    App.jsx
    styles.css
  dist/                 ← Production build (served by FastAPI at /)

backend/app/
  main.py               ← FastAPI app — all API routes + serves React dist
  services/
    transcription.py    ← faster-whisper local STT
    scoring.py          ← 5-category LLM scoring (Ollama/HF/rule-based)
    filler.py           ← Filler word detection (regex)
    responses.py        ← JSON read/write for best responses
    audio.py            ← Audio format conversion helpers

auth/                   ← Placeholder for future session auth
questions/              ← questions.json (do not delete)
data/                   ← best_responses.json (auto-created)
CLAUDE/                 ← Per-domain context files
tests/                  ← pytest unit tests
```

## Running Locally
```bash
# Python backend
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --port 7860

# React frontend (dev mode with HMR — proxies /api to :7860)
cd frontend-react && npm install && npm run dev
# OR build once and let FastAPI serve it:
cd frontend-react && npm run build
```

## API Endpoints (backend/app/main.py)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/questions | Full question bank |
| POST | /api/transcribe | Audio → transcript + filler stats |
| POST | /api/score | Transcript → 5-category scores |
| GET | /api/best-responses | Load saved responses |
| POST | /api/best-responses | Save a response (score ≥ 7.0) |
| DELETE | /api/best-responses/{id} | Delete one response |
| DELETE | /api/best-responses/all | Clear all responses |
| GET | /api/settings | Current .env values |
| POST | /api/settings | Save to .env |
| POST | /api/settings/test-ollama | Test Ollama connection |
| POST | /api/settings/test-hf | Test HuggingFace token |
| GET | /api/system-info | Python/package versions |

## Environment Variables (`.env`)
```
TRANSCRIPTION_MODEL=base          # faster-whisper model: tiny|base|small|medium
OLLAMA_MODEL=llama3.2             # Ollama model name
OLLAMA_BASE_URL=http://localhost:11434
HF_TOKEN=                         # Optional HuggingFace token
SILENCE_THRESHOLD_SECONDS=5.0    # Auto-stop silence duration (used client-side)
BEST_RESPONSE_MIN_SCORE=7.0      # Minimum score to offer saving
```

## Key Design Decisions
- React SPA is built via `vite build` and served as static files by FastAPI (`/assets` + SPA catch-all)
- `faster-whisper` runs server-side; audio is uploaded via `POST /api/transcribe`
- Browser's MediaRecorder API captures audio (WebM/opus); 5s silence auto-stop via Web Audio API AnalyserNode
- Scoring always falls back gracefully — no LLM required to run the app
- Questions come from local JSON only — zero LLM calls for question generation

## HuggingFace Spaces
- `README.md` frontmatter: `sdk: docker`, `app_port: 7860`
- Dockerfile does a multi-stage build: Node (React) → Python (FastAPI)
- Port 7860 is the HF Spaces standard

## Skill Files
| File | Domain |
|------|--------|
| [CLAUDE/audio.md](CLAUDE/audio.md) | Recording, transcription, VAD |
| [CLAUDE/backend.md](CLAUDE/backend.md) | Service layer architecture |
| [CLAUDE/frontend.md](CLAUDE/frontend.md) | React UI patterns |
| [CLAUDE/llm.md](CLAUDE/llm.md) | Ollama + HuggingFace integration |
| [CLAUDE/auth.md](CLAUDE/auth.md) | Future auth design |
