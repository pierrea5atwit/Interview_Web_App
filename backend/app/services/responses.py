import json
import os
import uuid
from datetime import datetime
from pathlib import Path

_RESPONSES_FILE = Path(__file__).parent.parent.parent.parent / "data" / "best_responses.json"
_MIN_SCORE = float(os.getenv("BEST_RESPONSE_MIN_SCORE", "7.0"))


def _ensure_file() -> None:
    _RESPONSES_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not _RESPONSES_FILE.exists():
        _RESPONSES_FILE.write_text("[]", encoding="utf-8")


def load_best_responses() -> list[dict]:
    _ensure_file()
    return json.loads(_RESPONSES_FILE.read_text(encoding="utf-8"))


def save_best_response(
    question: str,
    transcript: str,
    scores: dict,
    overall_score: float,
    role: str,
    interview_type: str,
) -> bool:
    """Save if overall_score >= threshold. Returns True if saved."""
    if overall_score < _MIN_SCORE:
        return False

    _ensure_file()
    responses = load_best_responses()

    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "role": role,
        "interview_type": interview_type,
        "question": question,
        "transcript": transcript,
        "overall_score": overall_score,
        "scores": scores,
    }
    responses.append(entry)
    _RESPONSES_FILE.write_text(json.dumps(responses, indent=2), encoding="utf-8")
    return True


def delete_response(response_id: str) -> bool:
    """Remove a saved response by id. Returns True if found and removed."""
    _ensure_file()
    responses = load_best_responses()
    filtered = [r for r in responses if r.get("id") != response_id]
    if len(filtered) == len(responses):
        return False
    _RESPONSES_FILE.write_text(json.dumps(filtered, indent=2), encoding="utf-8")
    return True


def load_questions() -> dict:
    questions_path = Path(__file__).parent.parent.parent.parent / "questions" / "questions.json"
    return json.loads(questions_path.read_text(encoding="utf-8"))
