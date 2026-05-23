import json
import os
import re
from .filler import analyze_fillers

CATEGORIES = ["clarity", "conciseness", "structure", "confidence", "relevance"]

_PROMPT_TEMPLATE = """You are an expert interview coach. Score this interview response objectively.

Question: {question}

Response: {transcript}

Score each category from 0 to 10 and provide brief, actionable feedback (one sentence each).

Respond with ONLY valid JSON — no markdown, no extra text:
{{
  "clarity": <int 0-10>,
  "clarity_feedback": "<one sentence>",
  "conciseness": <int 0-10>,
  "conciseness_feedback": "<one sentence>",
  "structure": <int 0-10>,
  "structure_feedback": "<one sentence>",
  "confidence": <int 0-10>,
  "confidence_feedback": "<one sentence>",
  "relevance": <int 0-10>,
  "relevance_feedback": "<one sentence>",
  "feedback": "<2-3 sentence overall feedback with one specific improvement>"
}}"""


def _parse_llm_json(text: str) -> dict:
    text = re.sub(r"```json?\s*|\s*```", "", text).strip()
    return json.loads(text)


def _score_with_ollama(question: str, transcript: str) -> dict:
    import ollama
    model = os.getenv("OLLAMA_MODEL", "llama3.2")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    client = ollama.Client(host=base_url)
    response = client.chat(
        model=model,
        messages=[{"role": "user", "content": _PROMPT_TEMPLATE.format(
            question=question, transcript=transcript[:2000]
        )}],
        options={"temperature": 0.1},
    )
    result = _parse_llm_json(response.message.content)
    result["scorer"] = "ollama"
    return result


def _score_with_huggingface(question: str, transcript: str) -> dict:
    from huggingface_hub import InferenceClient
    token = os.getenv("HF_TOKEN", "")
    client = InferenceClient(token=token if token else None)
    prompt = _PROMPT_TEMPLATE.format(
        question=question, transcript=transcript[:2000]
    )
    response = client.text_generation(
        prompt,
        model="mistralai/Mistral-7B-Instruct-v0.2",
        max_new_tokens=512,
        temperature=0.1,
    )
    result = _parse_llm_json(response)
    result["scorer"] = "huggingface"
    return result


def _score_rule_based(question: str, transcript: str) -> dict:
    words = transcript.split()
    word_count = len(words)
    lower = transcript.lower()

    # Clarity: Whisper output often has no punctuation, so avoid sentence-splitting.
    # Instead score based on whether the response is an appropriate length to follow.
    if 80 <= word_count <= 220:
        clarity = 8
        clarity_note = "Good length — easy to follow."
    elif 40 <= word_count < 80 or 220 < word_count <= 320:
        clarity = 6
        clarity_note = "Slightly short." if word_count < 80 else "Getting long — may lose the listener."
    elif word_count < 40:
        clarity = 4
        clarity_note = "Too brief to evaluate properly."
    else:
        clarity = 3
        clarity_note = "Very long — hard to follow."

    if 100 <= word_count <= 250:
        conciseness = 8
    elif 60 <= word_count < 100 or 250 < word_count <= 350:
        conciseness = 6
    elif 30 <= word_count < 60 or 350 < word_count <= 450:
        conciseness = 4
    else:
        conciseness = 2

    star_keywords = ["situation", "task", "action", "result", "problem",
                     "solution", "first", "then", "finally", "ultimately",
                     "as a result", "consequently"]
    structure = min(10, sum(2 for kw in star_keywords if kw in lower))

    hedging = ["maybe", "perhaps", "kind of", "sort of", "i think", "i guess",
               "probably", "might", "i'm not sure", "possibly"]
    hedge_count = sum(1 for h in hedging if h in lower)
    confidence = max(0, 8 - hedge_count * 2)

    q_words = set(re.findall(r"\b\w{4,}\b", question.lower()))
    a_words = set(re.findall(r"\b\w{4,}\b", lower))
    overlap = len(q_words & a_words) / max(len(q_words), 1)
    relevance = min(10, round(overlap * 20))

    filler_data = analyze_fillers(transcript)
    filler_penalty = min(3, filler_data["filler_count"])
    confidence = max(0, confidence - filler_penalty)

    scores_list = [clarity, conciseness, structure, confidence, relevance]
    worst_idx = scores_list.index(min(scores_list))
    worst_cat = CATEGORIES[worst_idx]

    overall = sum(scores_list) / 5
    tone = "strong" if overall >= 7 else "developing" if overall >= 5 else "early-stage"

    return {
        "clarity": clarity,
        "clarity_feedback": clarity_note,
        "conciseness": conciseness,
        "conciseness_feedback": f"Response is {word_count} words. {'On target.' if conciseness >= 7 else 'Aim for 100–250 words.'}",
        "structure": structure,
        "structure_feedback": "Good logical structure." if structure >= 6 else "Consider the STAR method (Situation, Task, Action, Result).",
        "confidence": confidence,
        "confidence_feedback": f"Found {filler_data['filler_count']} filler words. {'Sounds confident.' if confidence >= 7 else 'Reduce hedging language.'}",
        "relevance": relevance,
        "relevance_feedback": "Directly addresses the question." if relevance >= 6 else "Try to reference the question more explicitly.",
        "feedback": f"Your {word_count}-word response shows {tone} interview skills. Focus on improving your {worst_cat} — that's your biggest opportunity here. Keep practicing!",
        "scorer": "rule_based",
    }


def score_response(question: str, transcript: str) -> dict:
    """Try Ollama → HuggingFace → rule-based. Returns scoring dict."""
    llm_failed = False
    for scorer in [_score_with_ollama, _score_with_huggingface]:
        try:
            return scorer(question, transcript)
        except Exception:
            llm_failed = True
            continue
    result = _score_rule_based(question, transcript)
    if llm_failed:
        result["scorer"] = "rule_based (LLM unavailable)"
    return result


def overall_score(scores: dict) -> float:
    return round(sum(scores.get(c, 0) for c in CATEGORIES) / len(CATEGORIES), 1)


_BETTER_PROMPT = """You are an expert interview coach. A candidate answered an interview question.
Rewrite their response as a stronger 3–5 sentence answer that scores higher on clarity, structure, and confidence.
Keep the same topic and personal voice, but fix the weakest areas.

Question: {question}
Original response: {transcript}
Weakest areas: {weak_cats}

Write ONLY the improved response — no intro, no labels, just the answer itself."""

_BETTER_FALLBACK = (
    "Try using the STAR method: open with the **Situation** (one sentence), "
    "describe your **Task**, walk through the key **Actions** you took (two to three sentences), "
    "and close with the **Result** — ideally a measurable outcome. "
    "Aim for 150–200 words, start with a confident statement, and cut any filler words."
)


def _weak_categories(scores: dict) -> str:
    return ", ".join(
        cat for cat in CATEGORIES if scores.get(cat, 0) < 6
    ) or "overall polish"


def generate_better_response(question: str, transcript: str, scores: dict) -> str:
    """Return an example of a stronger answer. Tries Ollama → HuggingFace → template."""
    prompt = _BETTER_PROMPT.format(
        question=question,
        transcript=transcript[:1500],
        weak_cats=_weak_categories(scores),
    )

    def _try_ollama() -> str:
        import ollama
        client = ollama.Client(host=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
        r = client.chat(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.4},
        )
        return r.message.content.strip()

    def _try_huggingface() -> str:
        from huggingface_hub import InferenceClient
        token = os.getenv("HF_TOKEN", "")
        client = InferenceClient(token=token if token else None)
        return client.text_generation(
            prompt,
            model="mistralai/Mistral-7B-Instruct-v0.2",
            max_new_tokens=300,
            temperature=0.4,
        ).strip()

    for fn in [_try_ollama, _try_huggingface]:
        try:
            result = fn()
            if result:
                return result
        except Exception:
            continue

    raise RuntimeError("LLM unavailable")
