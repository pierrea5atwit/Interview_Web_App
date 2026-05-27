"""FastAPI backend for InterviewAI Coach."""
import os
import platform
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.services.responses import (
    load_best_responses,
    save_best_response,
    delete_response,
    load_questions,
    _RESPONSES_FILE,
)
from backend.app.services.scoring import score_response, overall_score, CATEGORIES
from backend.app.services.transcription import transcribe_audio
from backend.app.services.filler import analyze_fillers

app = FastAPI(title="InterviewAI Coach API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_ENV_PATH = Path(__file__).parent.parent.parent / ".env"


# ── Questions ──────────────────────────────────────────────────────────────────

@app.get("/api/questions")
def get_questions():
    try:
        return load_questions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Transcription ──────────────────────────────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        transcript = transcribe_audio(audio_bytes)
        filler = analyze_fillers(transcript)
        return {"transcript": transcript, "filler": filler}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Scoring ────────────────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    question: str
    transcript: str


@app.post("/api/score")
def score(req: ScoreRequest):
    try:
        scores = score_response(req.question, req.transcript)
        ov = overall_score(scores)
        return {"scores": scores, "overall_score": ov, "categories": CATEGORIES}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Best Responses ─────────────────────────────────────────────────────────────

@app.get("/api/best-responses")
def get_best_responses():
    try:
        return load_best_responses()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveRequest(BaseModel):
    question: str
    transcript: str
    scores: dict
    overall_score: float
    role: str
    interview_type: str


@app.post("/api/best-responses")
def create_best_response(req: SaveRequest):
    saved = save_best_response(
        question=req.question,
        transcript=req.transcript,
        scores=req.scores,
        overall_score=req.overall_score,
        role=req.role,
        interview_type=req.interview_type,
    )
    if not saved:
        raise HTTPException(status_code=400, detail="Score below threshold (7.0)")
    return {"ok": True}


@app.delete("/api/best-responses/all")
def delete_all_responses():
    """Clear every saved response (danger zone)."""
    try:
        _RESPONSES_FILE.parent.mkdir(parents=True, exist_ok=True)
        _RESPONSES_FILE.write_text("[]", encoding="utf-8")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/best-responses/{response_id}")
def delete_best_response(response_id: str):
    deleted = delete_response(response_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Response not found")
    return {"ok": True}


# ── Settings ───────────────────────────────────────────────────────────────────

def _read_env() -> dict:
    from dotenv import dotenv_values
    vals = dotenv_values(str(_ENV_PATH)) if _ENV_PATH.exists() else {}
    return {
        "transcription_model":    vals.get("TRANSCRIPTION_MODEL",       os.getenv("TRANSCRIPTION_MODEL", "base")),
        "ollama_base_url":        vals.get("OLLAMA_BASE_URL",           os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")),
        "ollama_model":           vals.get("OLLAMA_MODEL",              os.getenv("OLLAMA_MODEL", "llama3.2")),
        "hf_token":               vals.get("HF_TOKEN",                  os.getenv("HF_TOKEN", "")),
        "best_response_min_score":vals.get("BEST_RESPONSE_MIN_SCORE",  os.getenv("BEST_RESPONSE_MIN_SCORE", "7.0")),
        "silence_threshold_seconds": vals.get("SILENCE_THRESHOLD_SECONDS", os.getenv("SILENCE_THRESHOLD_SECONDS", "5.0")),
    }


@app.get("/api/settings")
def get_settings():
    settings = _read_env()
    settings["hf_token"] = "***" if settings["hf_token"] else ""
    return settings


class SettingsPayload(BaseModel):
    transcription_model: str = "base"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    hf_token: str = ""
    best_response_min_score: str = "7.0"
    silence_threshold_seconds: str = "5.0"


@app.post("/api/settings")
def save_settings(payload: SettingsPayload):
    try:
        from dotenv import set_key
        _ENV_PATH.touch(exist_ok=True)
        mapping = {
            "TRANSCRIPTION_MODEL":       payload.transcription_model,
            "OLLAMA_BASE_URL":           payload.ollama_base_url,
            "OLLAMA_MODEL":              payload.ollama_model,
            "BEST_RESPONSE_MIN_SCORE":   payload.best_response_min_score,
            "SILENCE_THRESHOLD_SECONDS": payload.silence_threshold_seconds,
        }
        if payload.hf_token and payload.hf_token != "***":
            mapping["HF_TOKEN"] = payload.hf_token
        for key, val in mapping.items():
            set_key(str(_ENV_PATH), key, val)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class OllamaTestRequest(BaseModel):
    url: str
    model: str


@app.post("/api/settings/test-ollama")
def test_ollama(req: OllamaTestRequest):
    try:
        import ollama
        client = ollama.Client(host=req.url)
        models = client.list()
        names = [m.model for m in models.models]
        model_found = req.model in names or any(req.model in n for n in names)
        return {"ok": True, "model_found": model_found, "available_models": names[:8]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


class HFTestRequest(BaseModel):
    token: str


@app.post("/api/settings/test-hf")
def test_hf(req: HFTestRequest):
    if not req.token:
        raise HTTPException(status_code=400, detail="No token provided")
    try:
        from huggingface_hub import whoami
        info = whoami(token=req.token)
        return {"ok": True, "username": info["name"]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── System info ────────────────────────────────────────────────────────────────

@app.get("/api/system-info")
def system_info():
    info = {
        "python":   platform.python_version(),
        "platform": f"{platform.system()} {platform.release()}",
        "faster_whisper": False,
        "ollama":         False,
        "fastapi":        False,
    }
    for pkg, key in [
        ("faster_whisper", "faster_whisper"),
        ("ollama",         "ollama"),
        ("fastapi",        "fastapi"),
    ]:
        try:
            __import__(pkg)
            info[key] = True
        except ImportError:
            pass
    return info


# ── Serve React SPA ────────────────────────────────────────────────────────────

_DIST = Path(__file__).parent.parent.parent / "frontend-react" / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        index = _DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
