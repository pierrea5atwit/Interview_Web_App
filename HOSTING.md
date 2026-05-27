# Hosting Guide — InterviewAI Coach

## Quick comparison

| Platform | Cost | Persistent storage | Difficulty | Best for |
|----------|------|--------------------|------------|---------|
| **Local** | Free | ✅ Yes | Easy | Dev / personal use |
| **HuggingFace Spaces** | Free | ❌ Resets on restart | Easy | Demos / sharing |
| **Fly.io** | ~$4–7/mo | ✅ Yes (volume) | Medium | Self-hosted production |
| **Render** | Free / $7/mo | ✅ Paid tier | Easy | Small team |
| **Railway** | $5/mo | ✅ Yes | Easy | Small team |

---

## Option 1 — Local

```bash
# Install Python deps
pip install -r requirements.txt

# Build the React frontend once
cd frontend-react && npm install && npm run build && cd ..

# Copy env config and edit as needed
cp .env.example .env

# Start the server
uvicorn backend.app.main:app --reload --port 7860
```

Open http://localhost:7860

**For LLM scoring (optional):**
```bash
# Install from https://ollama.com
ollama serve
ollama pull llama3.2
```

Without Ollama, scoring falls back to the rule-based engine automatically.

---

## Option 2 — HuggingFace Spaces (Docker SDK, free)

This project uses the **Docker SDK** on HF Spaces (not the Streamlit or Gradio SDKs).
HF Spaces builds the `Dockerfile` and runs the container.

**Limitation:** The container filesystem resets on restart, so `data/best_responses.json`
is lost between cold starts. Suitable for demos; use Fly.io for persistent history.

### Steps

1. Create a free account at https://huggingface.co
2. Go to https://huggingface.co/new-space
   - **SDK: Docker**
   - Hardware: **CPU Basic** (free, 16 GB RAM — enough for `faster-whisper base`)
3. Push this repo (the `README.md` frontmatter already sets `sdk: docker` and `app_port: 7860`)

### Secrets (Space → Settings → Repository secrets)

```
TRANSCRIPTION_MODEL = base
HF_TOKEN = hf_...              # optional — enables HuggingFace LLM scoring fallback
BEST_RESPONSE_MIN_SCORE = 7.0
SILENCE_THRESHOLD_SECONDS = 5.0
```

Ollama cannot run on HF free tier — leave `OLLAMA_*` unset. The app scores with
HuggingFace Inference API (if `HF_TOKEN` is set) or rule-based fallback automatically.

### What the Dockerfile does

```
Stage 1 (node:20-slim)   — npm install + vite build → produces frontend-react/dist/
Stage 2 (python:3.12-slim) — pip install + copy dist + uvicorn on port 7860
```

---

## Option 3 — Fly.io (self-hosted, persistent storage)

Fly.io runs the Docker container and attaches a persistent volume for
`data/best_responses.json` and the Whisper model cache.

### Cost
- Machines: shared-cpu-1x with 512 MB RAM ≈ $4–7/month
- Volume (1 GB): ~$0.15/month

### Steps

1. Install the Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
2. Log in: `fly auth login`
3. Launch (first time):
   ```bash
   fly launch --name interviewai-coach --region ewr --no-deploy
   ```
4. Create a persistent volume:
   ```bash
   fly volumes create interviewai_data --size 1 --region ewr
   ```
5. Set secrets:
   ```bash
   fly secrets set TRANSCRIPTION_MODEL=base BEST_RESPONSE_MIN_SCORE=7.0
   fly secrets set HF_TOKEN=hf_...   # optional
   ```
6. Deploy:
   ```bash
   fly deploy
   ```

App will be live at `https://interviewai-coach.fly.dev`

---

## Option 4 — Render

1. Sign up at https://render.com
2. New → Web Service → connect GitHub repo
3. Runtime: **Docker**
4. Plan: **Free** (sleeps after 15 min) or **Starter** ($7/mo, always on)
5. Set environment variables in the Render dashboard (same as `.env.example` keys)
6. For persistent storage: Render → your service → Disks → add `/app/data`

---

## Notes on Whisper model download

On first startup, `faster-whisper` downloads model weights from HuggingFace:
- `tiny`: 75 MB
- `base`: 145 MB (default)
- `small`: 465 MB

On Fly.io or Render with a mounted volume, cache the model by setting:
```
HF_HUB_CACHE=/app/data/.hf_cache
```
This persists the download across deploys.

---

## Notes on Ollama in hosted environments

Ollama needs its own process and 2–8 GB of RAM. Not practical on free-tier VMs.

**On hosted platforms (HF Spaces, Render free, Fly.io small):**
- Skip Ollama — the app uses HuggingFace Inference API (with `HF_TOKEN`) or rule-based scoring

**If you have a VPS with 8+ GB RAM:**
- Install Ollama directly on the VM
- Set `OLLAMA_BASE_URL=http://localhost:11434`
- Pull `phi3:mini` (3.8 B) or `llama3.2` (8 B)

---

## Security checklist before going public

- [ ] Add authentication (see `CLAUDE/auth.md`)
- [ ] Set `BEST_RESPONSE_MIN_SCORE` deliberately
- [ ] Do not commit `.env` with real tokens — use secrets management
- [ ] Enable HTTPS (Fly.io and Render handle this automatically)
- [ ] Consider rate limiting the `/api/transcribe` endpoint if publicly accessible
