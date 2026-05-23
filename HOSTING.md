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

## Option 1 — Local (always works)

```bash
pip install -r requirements.txt
cp .env.example .env       # edit as needed
streamlit run frontend/app.py
```

Open http://localhost:8501

**For LLM scoring (optional):**
```bash
# Install from https://ollama.com
ollama serve
ollama pull llama3.2
```

Without Ollama, the rule-based scorer runs automatically — no setup needed.

---

## Option 2 — HuggingFace Spaces (free, recommended for demos)

HuggingFace Spaces has native Streamlit support and free 16 GB RAM CPU instances
that can comfortably run `faster-whisper base`.

**Limitation:** The filesystem resets on restart, so `data/best_responses.json` is lost.
Good for demos; not for personal use where you want persistent history.

### Steps

1. Create a free account at https://huggingface.co
2. Go to https://huggingface.co/new-space
   - SDK: **Streamlit**
   - Hardware: **CPU Basic** (free, 16 GB RAM)
3. Connect your GitHub repo **or** upload files manually
4. The app starts automatically — HF reads the `README.md` to find the entry point

The `README.md` in this repo already contains the correct HF Spaces frontmatter:
```yaml
sdk: streamlit
app_file: frontend/app.py
```

### Environment secrets on HF Spaces

In your Space → Settings → Repository secrets, add:
```
TRANSCRIPTION_MODEL = base
OLLAMA_MODEL =          (leave blank — Ollama can't run on HF free tier)
HF_TOKEN = hf_...      (optional, for HuggingFace scoring fallback)
BEST_RESPONSE_MIN_SCORE = 7.0
```

Without Ollama, scoring falls back to the rule-based engine automatically.

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
   This creates `fly.toml` — one is already included in this repo.
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

### fly.toml is already in the repo
See `fly.toml` — uses the existing Dockerfile, mounts the volume at `/app/data`,
and forwards port 8501.

---

## Option 4 — Render (easy GitHub integration)

1. Sign up at https://render.com
2. New → Web Service → connect GitHub repo
3. Runtime: **Docker**
4. Plan: **Free** (sleeps after 15 min, 512 MB RAM) or **Starter** ($7/mo, always on)
5. Set environment variables in the Render dashboard (same as the `.env.example` keys)
6. For persistent storage: Render → your service → Disks → add `/app/data`

---

## Notes on Whisper model download

On first startup, `faster-whisper` downloads the model weights from HuggingFace:
- `tiny`: 75 MB
- `base`: 145 MB (default)
- `small`: 465 MB

On Fly.io and Render with a mounted volume, cache the model by setting:
```
HF_HUB_CACHE=/app/data/.hf_cache
```
This persists the download across deploys.

---

## Notes on Ollama in hosted environments

Ollama needs its own process and 2–8 GB of RAM depending on the model.
Running it alongside Streamlit on a single small VM is not practical.

**On hosted platforms (HF Spaces, Render free, Fly.io small):**
- Skip Ollama entirely — the app uses rule-based scoring by default
- Optional: set `HF_TOKEN` to use HuggingFace Inference API as the LLM

**If you have a VPS with 8+ GB RAM:**
- Install Ollama directly on the VM
- Set `OLLAMA_BASE_URL=http://localhost:11434`
- Pull `phi3:mini` (3.8 B, fastest) or `llama3.2` (8 B, better quality)

---

## Security checklist before going public

- [ ] Add authentication (see `CLAUDE/auth.md` for the `streamlit-authenticator` plan)
- [ ] Set `BEST_RESPONSE_MIN_SCORE` deliberately
- [ ] Remove `HF_TOKEN` from `.env` if committed to a public repo — use secrets management
- [ ] Enable HTTPS (Fly.io and Render do this automatically)
- [ ] Consider rate limiting if the app is publicly accessible
