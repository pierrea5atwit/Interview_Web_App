# Backend — Service Layer

## Architecture
No web framework in MVP1.5. `backend/app/services/` contains pure Python modules imported directly by Streamlit pages. No FastAPI, no SQLAlchemy, no Celery.

```
backend/app/services/
  __init__.py        # empty
  transcription.py   # WhisperModel singleton + transcribe_audio()
  scoring.py         # score_response() with Ollama → HF → rule-based chain
  filler.py          # analyze_fillers() — pure regex
  responses.py       # load/save best_responses.json
  audio.py           # bytes_to_tempfile(), cleanup helpers
```

## Import Pattern in Streamlit Pages
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.services.transcription import transcribe_audio
from backend.app.services.scoring import score_response
```

## Service Contracts

### transcription.py
```python
def transcribe_audio(audio_bytes: bytes) -> str:
    """Returns full transcript string. Uses faster-whisper base model."""
    
def transcribe_audio_streaming(audio_bytes: bytes):
    """Generator that yields transcript text segment-by-segment."""
```

### scoring.py
```python
CATEGORIES = ["clarity", "conciseness", "structure", "confidence", "relevance"]

def score_response(question: str, transcript: str) -> dict:
    """
    Returns dict with keys:
      clarity, conciseness, structure, confidence, relevance  (int 0-10 each)
      {category}_feedback  (str, brief)
      feedback  (str, 2-3 sentence overall)
      scorer  (str: "ollama" | "huggingface" | "rule_based")
    """
```

### filler.py
```python
FILLER_WORDS = {"um", "uh", "like", "you know", "basically", "actually", 
                "so", "right", "literally", "kind of", "sort of"}

def analyze_fillers(text: str) -> dict:
    """
    Returns:
      total_words (int)
      filler_count (int)
      filler_rate (float, percentage)
      fillers_found (list[str])
      top_fillers (list[tuple[str, int]], top 3)
    """
```

### responses.py
```python
RESPONSES_FILE = "data/best_responses.json"

def load_best_responses() -> list[dict]:
    """Returns list of saved response dicts, newest first."""

def save_best_response(question, transcript, scores, overall_score, role, interview_type) -> None:
    """Appends to best_responses.json. Only saves if overall_score >= MIN_SCORE."""

def load_questions() -> dict:
    """Loads questions/questions.json. Returns role → type → list[str]."""
```

### audio.py
```python
def bytes_to_tempfile(audio_bytes: bytes, suffix=".wav") -> str:
    """Writes bytes to a named temp file. Caller must unlink."""
    
def cleanup_tempfile(path: str) -> None:
    """Silent unlink."""
```

## Error Handling
Services raise plain `Exception` with human-readable messages. Streamlit pages catch and display via `st.error()`. No custom exception classes in MVP1.5.

## Data Files
```
questions/questions.json       # READ ONLY — do not modify in services
data/best_responses.json       # READ/WRITE — created on first save
```

`best_responses.json` schema:
```json
[
  {
    "id": "uuid4-string",
    "timestamp": "2026-05-23T11:00:00",
    "role": "software_engineering",
    "interview_type": "behavioral",
    "question": "Tell me about a time...",
    "transcript": "In my last role...",
    "overall_score": 8.2,
    "scores": {
      "clarity": 9, "conciseness": 8, "structure": 8,
      "confidence": 8, "relevance": 8,
      "clarity_feedback": "...", ...
    }
  }
]
```

## Adding a New Service
1. Create `backend/app/services/myservice.py`
2. Import in the relevant Streamlit page
3. Add test in `tests/test_myservice.py`
4. Document contract here
