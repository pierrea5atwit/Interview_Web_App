---
title: InterviewAI Coach
emoji: 🎙
colorFrom: indigo
colorTo: purple
sdk: streamlit
sdk_version: "1.39"
app_file: frontend/app.py
pinned: false
---

# InterviewAI Coach

Practice interview answers. Get scored instantly. Land the job.

## What it does

- **Record** your answer directly in the browser — auto-stops after 5 seconds of silence
- **Transcribe** locally using `faster-whisper` — no audio leaves your machine
- **Score** across 5 categories (Clarity, Conciseness, Structure, Confidence, Relevance) with LLM or rule-based engine
- **Track** your best responses (score 7.0+) with a built-in response library

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env
streamlit run frontend/app.py
```

Optional — local LLM scoring (better feedback):
```bash
# Install from https://ollama.com
ollama serve && ollama pull llama3.2
```

Without Ollama, scoring falls back to a rule-based engine automatically. The app works with zero configuration.

## Project structure

```
frontend/           Streamlit UI (entry: streamlit run frontend/app.py)
  app.py            Home page
  pages/
    1_Practice.py   Record + transcript + score
    2_Best_Responses.py  Saved response tracker
    3_Settings.py   Model & preference configuration
backend/app/services/
  transcription.py  faster-whisper local STT
  scoring.py        Ollama → HuggingFace → rule-based scoring chain
  filler.py         Filler word detection
  responses.py      JSON storage for best responses
questions/
  questions.json    45 pre-loaded interview questions (3 roles × 3 types)
CLAUDE/             Context files for Claude Code (see CLAUDE.md)
HOSTING.md          Deployment guide (local, HuggingFace Spaces, Fly.io, Render)
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

## Hosting

See [HOSTING.md](HOSTING.md) for full deployment options:
- **HuggingFace Spaces** — free, great for demos (this README is already configured for it)
- **Fly.io** — ~$5/month, persistent storage, `fly.toml` included
- **Render / Railway** — easy GitHub integration

## Tech stack

| Layer | Tool |
|-------|------|
| UI | Streamlit 1.39+ |
| Recording | audio-recorder-streamlit (5s silence auto-stop) |
| Transcription | faster-whisper (local, no OpenAI API) |
| LLM scoring | Ollama → HuggingFace → rule-based fallback |
| Storage | JSON files (no database) |
| Auth | Not implemented in MVP1.5 (see `CLAUDE/auth.md`) |
