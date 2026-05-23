# InterviewAI Coach — CLAUDE Context

## What This Project Is
A self-hosted Streamlit web app for interview practice. Users select a role, receive questions from a local JSON bank, record their answer, see a transcript, and receive a scored evaluation (0–10) across 5 categories.

## MVP1.5 Scope
- Streamlit multi-page UI (no FastAPI, no external APIs required)
- Local audio transcription via `faster-whisper` (no OpenAI API)
- LLM scoring via Ollama → HuggingFace → rule-based fallback chain
- JSON-only storage: `questions/questions.json` + `data/best_responses.json`
- No database, no auth (optional future auth in `auth/`)

## Project Layout
```
frontend/           ← Streamlit pages (entry point: `streamlit run frontend/app.py`)
  app.py            ← Home page
  pages/
    1_Practice.py   ← Question selection + recording + scoring
    2_Best_Responses.py ← Best response tracker
backend/app/services/  ← Business logic (imported by Streamlit pages)
  transcription.py  ← faster-whisper local STT
  scoring.py        ← 5-category LLM scoring (Ollama/HF/rule-based)
  filler.py         ← Filler word detection (regex)
  responses.py      ← JSON read/write for best responses
  audio.py          ← Audio format conversion + VAD helpers
auth/               ← Placeholder for future session auth
questions/          ← questions.json (do not delete)
data/               ← best_responses.json (auto-created)
CLAUDE/             ← Per-domain context files
tests/              ← pytest unit tests
```

## Running Locally
```bash
pip install -r requirements.txt
# Optional: start Ollama — ollama serve && ollama pull llama3.2
streamlit run frontend/app.py
```

## Environment Variables (`.env`)
```
TRANSCRIPTION_MODEL=base          # faster-whisper model: tiny|base|small|medium
OLLAMA_MODEL=llama3.2             # Ollama model name
OLLAMA_BASE_URL=http://localhost:11434
HF_TOKEN=                         # Optional HuggingFace token
SILENCE_THRESHOLD_SECONDS=5.0    # Auto-stop silence duration
BEST_RESPONSE_MIN_SCORE=7.0      # Minimum score to offer saving
```

## Key Design Decisions
- `audio-recorder-streamlit` for browser recording — native `pause_threshold` handles 5s silence
- `faster-whisper` yields segments so transcript appears progressively in UI
- Scoring always falls back gracefully — no LLM required to run the app
- Questions come from local JSON only — zero LLM calls for question generation

## Skill Files
| File | Domain |
|------|--------|
| [CLAUDE/audio.md](CLAUDE/audio.md) | Recording, transcription, VAD |
| [CLAUDE/backend.md](CLAUDE/backend.md) | Service layer architecture |
| [CLAUDE/frontend.md](CLAUDE/frontend.md) | Streamlit UI patterns |
| [CLAUDE/llm.md](CLAUDE/llm.md) | Ollama + HuggingFace integration |
| [CLAUDE/auth.md](CLAUDE/auth.md) | Future auth design |
