"""FastAPI backend for InterviewAI Coach."""
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


# ── Questions ──────────────────────────────────────────────────────────────────

@app.get("/api/questions")
def get_questions():
    """Return the full question bank."""
    try:
        return load_questions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Transcription ──────────────────────────────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Accept a recorded audio file and return transcript + filler stats."""
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
    """Score a transcript across 5 categories. Tries Ollama → HF → rule-based."""
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


@app.delete("/api/best-responses/{response_id}")
def delete_best_response(response_id: str):
    deleted = delete_response(response_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Response not found")
    return {"ok": True}


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
