# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /build
COPY frontend-react/package.json frontend-react/package.json
RUN cd frontend-react && npm install

COPY frontend-react/ frontend-react/
RUN cd frontend-react && npm run build

# ── Stage 2: Python runtime ────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# System deps: ffmpeg for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first — avoids pulling the full CUDA wheel (~800 MB)
# when requirements.txt is processed later.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Remaining Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY . .

# React build from stage 1
COPY --from=frontend-build /build/frontend-react/dist ./frontend-react/dist

# Ensure data dir exists
RUN mkdir -p data

ENV PYTHONPATH=/app

# HuggingFace Spaces uses port 7860
EXPOSE 7860

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
