# LLM Integration — Scoring Engine

## Chain of Responsibility
`scoring.py` tries providers in order until one succeeds:
1. **Ollama** (local) — preferred, zero cost, no network
2. **HuggingFace Inference API** (cloud) — free tier, needs `HF_TOKEN`
3. **Rule-based** (always works) — deterministic, no model

The `scorer` key in the return dict tells you which was used.

## Ollama Integration

**Setup:**
```bash
# Install from https://ollama.com
ollama serve           # starts on localhost:11434
ollama pull llama3.2   # ~2GB, good quality/speed
# Alternatives: mistral, phi3, gemma2:2b (smaller/faster)
```

**Python:**
```python
import ollama

response = ollama.chat(
    model=os.getenv("OLLAMA_MODEL", "llama3.2"),
    messages=[{"role": "user", "content": prompt}],
    format="json",   # forces JSON output
    options={"temperature": 0.1}  # low temp for consistent scoring
)
scores = json.loads(response.message.content)
```

**Ollama not running?** The `ollama.chat()` call raises `ConnectionError`. `scoring.py` catches this and falls through to HuggingFace.

## HuggingFace Inference API

```python
from huggingface_hub import InferenceClient

client = InferenceClient(token=os.getenv("HF_TOKEN", ""))
response = client.text_generation(
    prompt,
    model="mistralai/Mistral-7B-Instruct-v0.2",
    max_new_tokens=512,
    temperature=0.1,
)
```

Free tier: rate-limited, ~1 req/sec. Good enough for demo. Requires `HF_TOKEN` env var.

## Scoring Prompt Template
```
You are an expert interview coach. Score this interview response.

Question: {question}
Response: {transcript}

Score each category 0–10 and provide brief feedback.
Categories: clarity, conciseness, structure, confidence, relevance

Respond with ONLY valid JSON:
{
  "clarity": <int>,
  "clarity_feedback": "<str>",
  "conciseness": <int>,
  "conciseness_feedback": "<str>",
  "structure": <int>,
  "structure_feedback": "<str>",
  "confidence": <int>,
  "confidence_feedback": "<str>",
  "relevance": <int>,
  "relevance_feedback": "<str>",
  "feedback": "<2-3 sentence overall feedback>"
}
```

Keep transcripts under 500 words before sending to LLM to stay within context limits.

## Rule-Based Fallback Heuristics
| Category | Heuristic |
|----------|-----------|
| Clarity | Penalize avg sentence length > 25 words |
| Conciseness | Optimal range: 100–250 words |
| Structure | Count STAR-method keywords (situation, task, action, result) |
| Confidence | Penalize hedging words (maybe, perhaps, kind of, I think) |
| Relevance | Keyword overlap between question and answer |

Filler word count (from `filler.py`) applies a -1 penalty per filler to Confidence score.

## Recommended Models by Use Case
| Use Case | Model | Notes |
|----------|-------|-------|
| Fast feedback | `phi3:mini` via Ollama | 3.8B, very fast |
| Best quality | `llama3.2:8b` via Ollama | 8B, slower |
| No local GPU | `mistralai/Mistral-7B-Instruct-v0.2` via HF | Cloud |
| Offline only | Rule-based fallback | Always available |

## JSON Parse Safety
LLM output may include markdown fences. Strip before parsing:
```python
import re, json

def parse_llm_json(text: str) -> dict:
    text = re.sub(r"```json?\s*|\s*```", "", text).strip()
    return json.loads(text)
```

## Future: Local HuggingFace Models
To run a model fully offline without Ollama:
```python
from transformers import pipeline

pipe = pipeline("text-generation", model="microsoft/Phi-3-mini-4k-instruct", 
                device_map="auto")
```
Heavier dependency, requires CUDA for speed. Not in MVP1.5.
