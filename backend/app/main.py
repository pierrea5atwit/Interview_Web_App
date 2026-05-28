"""FastAPI backend — InterviewAI Coach."""
import hashlib
import os
import platform
import sys
import uuid
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.services.supabase_client import get_client, is_configured
from backend.app.services.scoring import score_response, overall_score, CATEGORIES
from backend.app.services.transcription import transcribe_audio
from backend.app.services.filler import analyze_fillers

app = FastAPI(title="InterviewAI Coach API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_ENV_PATH = Path(__file__).parent.parent.parent / ".env"


# ── Public runtime config ──────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    """
    Return the subset of env vars the React frontend needs at runtime.

    Only the Supabase *public* keys are exposed here — they are designed to
    be visible in the browser (Row-Level Security enforces access control).
    Sensitive keys (HF_TOKEN, service-role key, etc.) are never returned.
    """
    return {
        "supabase_url":            os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key":       os.getenv("SUPABASE_ANON_KEY", ""),
        # Non-sensitive app config the frontend needs at runtime
        "best_response_min_score": float(os.getenv("BEST_RESPONSE_MIN_SCORE", "7.0")),
    }


# ── Auth dependency ────────────────────────────────────────────────────────────

def _authed_client(request: Request):
    """
    FastAPI dependency — creates a per-request Supabase client authenticated
    with the user's JWT so RLS policies see the correct auth.uid().
    """
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    from supabase import create_client
    client = create_client(url, key)
    client.postgrest.auth(token)
    return client


# ── Helpers ────────────────────────────────────────────────────────────────────

def _question_id(text: str) -> str:
    """Deterministic UUID from question text for local-JSON fallback."""
    return str(uuid.UUID(bytes=hashlib.md5(text.encode()).digest()))


def _load_local_questions():
    """Load questions.json as fallback when Supabase isn't configured."""
    from backend.app.services.responses import load_questions
    return load_questions()


# ── 1. Questions ───────────────────────────────────────────────────────────────

@app.get("/api/questions")
def get_questions(
    role: str = Query(..., description="e.g. software_engineering"),
    type: str = Query(..., description="behavioral | technical | mixed"),
    difficulty: Optional[int] = Query(None, description="0=easy 1=medium 2=hard"),
):
    """Fetch role-specific questions from Supabase (falls back to local JSON)."""
    db = get_client()

    if db:
        try:
            q = db.table("questions").select("id, question_text") \
                  .eq("role", role).eq("type", type)
            if difficulty is not None:
                q = q.eq("difficulty", difficulty)
            result = q.execute()
            if result.data:
                return result.data
            # Empty result — fall through to local JSON
        except Exception:
            pass

    # Local JSON fallback (generates deterministic UUIDs)
    bank = _load_local_questions()
    questions = bank.get(role, {}).get(type, [])
    items = [{"id": _question_id(t), "question_text": t} for t in questions]
    if difficulty is not None:
        # Heuristic filter: technical=2, behavioral=0, mixed=1
        heuristic = {"behavioral": 0, "technical": 2, "mixed": 1}.get(type, 1)
        if difficulty != heuristic:
            items = []
    return items


# ── 2. Transcribe ──────────────────────────────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Audio → transcript + filler stats."""
    try:
        audio_bytes = await file.read()
        transcript  = transcribe_audio(audio_bytes)
        filler      = analyze_fillers(transcript)
        return {"transcript": transcript, "filler_count": filler["filler_count"],
                "filler_rate": filler["filler_rate"], "filler": filler}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 3. Score ───────────────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    transcript: str
    question:   str


@app.post("/api/score")
def score(req: ScoreRequest):
    """
    AI scoring via HuggingFace → rule-based fallback.
    Returns flat JSON with all five scores + overall_score + suggestion + encouragement.
    """
    try:
        scores = score_response(req.question, req.transcript)
        ov     = overall_score(scores)
        return {
            "clarity":      scores.get("clarity",     5.0),
            "conciseness":  scores.get("conciseness", 5.0),
            "structure":    scores.get("structure",   5.0),
            "confidence":   scores.get("confidence",  5.0),
            "relevance":    scores.get("relevance",   5.0),
            "overall_score": ov,
            "suggestion":   scores.get("suggestion",    ""),
            "encouragement":scores.get("encouragement", ""),
            "scorer":       scores.get("scorer", "unknown"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 4. Save Response ───────────────────────────────────────────────────────────

class SaveResponseRequest(BaseModel):
    user_id:      str
    question_id:  str = ""
    question_text: str = ""
    transcript:   str
    clarity:      float
    conciseness:  float
    structure:    float
    confidence:   float
    relevance:    float
    overall_score: float
    suggestion:   str = ""
    encouragement: str = ""
    filler_count: int   = 0
    filler_rate:  float = 0.0


@app.post("/api/responses")
def save_response(req: SaveResponseRequest, db=Depends(_authed_client)):
    """Persist a completed interview response to Supabase."""
    try:
        db.table("responses").insert(req.model_dump()).execute()
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Get User Responses ──────────────────────────────────────────────────────

@app.get("/api/responses")
def get_responses(user_id: str = Query(...), db=Depends(_authed_client)):
    """Fetch all responses for a user, newest first."""
    try:
        result = (
            db.table("responses")
              .select(
                  "id, question_id, question_text, transcript, clarity, conciseness, structure, "
                  "confidence, relevance, overall_score, suggestion, encouragement, "
                  "filler_count, filler_rate, created_at"
              )
              .eq("user_id", user_id)
              .order("created_at", desc=True)
              .execute()
        )
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 6. Delete all responses ────────────────────────────────────────────────────

@app.delete("/api/responses/all")
def delete_all_responses(user_id: str = Query(...), db=Depends(_authed_client)):
    """Delete every response belonging to a user."""
    try:
        db.table("responses").delete().eq("user_id", user_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 7. Delete a single response ────────────────────────────────────────────────

@app.delete("/api/responses/{response_id}")
def delete_response(response_id: str, db=Depends(_authed_client)):
    """Delete a single response (RLS ensures the user can only delete their own rows)."""
    try:
        db.table("responses").delete().eq("id", response_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Settings ───────────────────────────────────────────────────────────────────

def _read_env() -> dict:
    from dotenv import dotenv_values
    vals = dotenv_values(str(_ENV_PATH)) if _ENV_PATH.exists() else {}
    return {
        "best_response_min_score": vals.get(
            "BEST_RESPONSE_MIN_SCORE", os.getenv("BEST_RESPONSE_MIN_SCORE", "7.0")
        ),
    }


@app.get("/api/settings")
def get_settings():
    return _read_env()


class SettingsPayload(BaseModel):
    best_response_min_score: str = "7.0"


@app.post("/api/settings")
def save_settings(payload: SettingsPayload):
    try:
        from dotenv import set_key
        _ENV_PATH.touch(exist_ok=True)
        set_key(str(_ENV_PATH), "BEST_RESPONSE_MIN_SCORE", payload.best_response_min_score)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── System info ────────────────────────────────────────────────────────────────

@app.get("/api/system-info")
def system_info():
    info = {
        "python":              platform.python_version(),
        "platform":            f"{platform.system()} {platform.release()}",
        "faster_whisper":      False,
        "fastapi":             False,
        "supabase":            False,
        "supabase_configured": is_configured(),
    }
    for pkg, key in [("faster_whisper", "faster_whisper"),
                     ("fastapi", "fastapi"), ("supabase", "supabase")]:
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
