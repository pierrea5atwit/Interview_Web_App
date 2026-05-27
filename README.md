---
title: InterviewAI Coach
emoji: 🎙
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# InterviewAI Coach

Practice interview answers. Get scored instantly. Land the job.

## What it does

- **Record** your answer directly in the browser — auto-stops after 5 seconds of silence
- **Transcribe** on the server using `faster-whisper` — no third-party audio API
- **Score** across 5 categories (Clarity, Conciseness, Structure, Confidence, Relevance) via Ollama → HuggingFace → rule-based fallback
- **Track** your best responses (score 7.0+) with a built-in response library

## Stack

| Layer | Tool |
|-------|------|
| Frontend | React 18 + Vite (served as static files) |
| Backend | FastAPI + Uvicorn (port 7860) |
| Transcription | faster-whisper (local, no OpenAI API) |
| LLM scoring | Ollama → HuggingFace → rule-based fallback |
| Storage | JSON files (no database) |

## Quick start (local)

```bash
# 1. Install Python deps
pip install -r requirements.txt

# 2. Build the React frontend
cd frontend-react && npm install && npm run build && cd ..

# 3. Copy and edit environment config
cp .env.example .env

# 4. Start the server
uvicorn backend.app.main:app --reload --port 7860
```

Open http://localhost:7860

**Optional — local LLM scoring:**
```bash
# Install from https://ollama.com
ollama serve && ollama pull llama3.2
```

Without Ollama, scoring falls back to a rule-based engine automatically.

## Project structure

```
frontend-react/         React + Vite app
  src/
    pages/
      Home.jsx          Landing page
      Practice.jsx      Record + transcript + score
      BestResponses.jsx Saved response tracker
      Settings.jsx      Model & preference configuration
    components/
      Sidebar.jsx
  dist/                 Built static files (served by FastAPI)

backend/app/
  main.py               FastAPI app — REST API + serves React dist
  services/
    transcription.py    faster-whisper local STT
    scoring.py          Ollama → HuggingFace → rule-based scoring chain
    filler.py           Filler word detection
    responses.py        JSON storage for best responses

questions/
  questions.json        45 pre-loaded interview questions (3 roles × 3 types)

Dockerfile              Multi-stage: Node builds React → Python runs FastAPI
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSCRIPTION_MODEL` | `base` | faster-whisper model: `tiny` `base` `small` `medium` |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `HF_TOKEN` | _(empty)_ | HuggingFace token for cloud LLM fallback |
| `BEST_RESPONSE_MIN_SCORE` | `7.0` | Minimum score (0–10) to offer saving |
| `SILENCE_THRESHOLD_SECONDS` | `5.0` | Silence duration before recording auto-stops |

## HuggingFace Spaces (Docker SDK)

This Space uses the **Docker SDK**. HF Spaces builds the `Dockerfile` directly:

1. Stage 1 (Node): installs npm deps and runs `vite build`
2. Stage 2 (Python): installs Python deps, copies the React `dist/`, runs `uvicorn` on port 7860

Set secrets in your Space → Settings → Repository secrets:
```
TRANSCRIPTION_MODEL = base
HF_TOKEN = hf_...      # optional — enables HuggingFace LLM scoring fallback
BEST_RESPONSE_MIN_SCORE = 7.0
```

## Hosting

See [HOSTING.md](HOSTING.md) for Fly.io, Render, and Railway deployment guides.
