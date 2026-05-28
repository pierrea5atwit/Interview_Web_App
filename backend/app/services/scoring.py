"""
Scoring service — single HuggingFace inference call with rule-based fallback.

Output schema (always):
  clarity      float 0-10
  conciseness  float 0-10
  structure    float 0-10
  confidence   float 0-10
  relevance    float 0-10
  suggestion   str   one specific actionable improvement (≤30 words)
  encouragement str  one encouraging sentence (≤20 words)
  scorer       str   "huggingface" | "rule_based"
"""
import json
import os
import re
from .filler import analyze_fillers

CATEGORIES = ["clarity", "conciseness", "structure", "confidence", "relevance"]

_SYSTEM = """\
You are a warm, practical interview coach. Your job is to score interview answers and give one concrete, helpful suggestion.

Rules you must follow without exception:
- Reply with valid JSON only. No markdown fences, no prose outside the JSON.
- Do not use "---" anywhere in your output.
- Do not use phrases like "That's not X, it's Y" or "This isn't X, it's Y".
- Do not use AI / tech-sounding words like "leveraging", "delve", "in the realm of", "as an AI", "it's important to note".
- Write like a mentor texting a friend — warm, direct, specific.
- Keep suggestion under 30 words. Keep encouragement under 20 words.

Scoring guide (0–10 for each category):
  clarity      How easy is the answer to follow? Clear language, no rambling. 8+ = crisp and easy to follow.
  conciseness  Is it the right length? 100–250 words is ideal. Penalise heavy over- or under-explaining.
  structure    Does it have a logical flow (e.g. STAR: Situation, Task, Action, Result)? 8+ = obvious structure.
  confidence   Direct language, no excessive hedging ("I think", "maybe", "kind of"). 8+ = assertive and grounded.
  relevance    Does the answer actually address what was asked? Keyword alignment + on-topic content. 8+ = clearly on-point.
"""

_USER_PROMPT = """\
Score this interview answer and give ONE specific, actionable suggestion.

Question: {question}

Answer: {transcript}

Return ONLY this JSON (numbers are floats 0–10):
{{
  "clarity": <float>,
  "conciseness": <float>,
  "structure": <float>,
  "confidence": <float>,
  "relevance": <float>,
  "suggestion": "<one specific improvement, max 30 words>",
  "encouragement": "<one encouraging sentence, max 20 words>"
}}"""


def _parse_json(raw: str) -> dict:
    """Strip markdown fences, extract the first JSON object, parse it."""
    text = re.sub(r"```json?\s*|\s*```", "", raw).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group()
    return json.loads(text)


def _normalise(result: dict) -> dict:
    """Coerce scores to float and clamp to [0, 10]."""
    for cat in CATEGORIES:
        result[cat] = float(max(0.0, min(10.0, result.get(cat, 5.0))))
    result.setdefault("suggestion", "Pick one moment from your answer and add a concrete detail to make it stick.")
    result.setdefault("encouragement", "Good effort — keep building on this.")
    return result


# ── HuggingFace inference ──────────────────────────────────────────────────────

def _score_with_huggingface(question: str, transcript: str) -> dict:
    from huggingface_hub import InferenceClient

    token = os.getenv("HF_TOKEN", "") or None
    client = InferenceClient(token=token)

    response = client.chat_completion(
        model="mistralai/Mistral-7B-Instruct-v0.2",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": _USER_PROMPT.format(
                question=question,
                transcript=transcript[:1500],
            )},
        ],
        max_tokens=280,
        temperature=0.2,
    )

    raw = response.choices[0].message.content
    result = _normalise(_parse_json(raw))
    result["scorer"] = "huggingface"
    return result


# ── Rule-based fallback ────────────────────────────────────────────────────────

_SUGGESTIONS = {
    "clarity":     "Use shorter sentences and one concrete example to make your point easy to follow.",
    "conciseness": "Aim for 150–200 words — cut any recap that doesn't add new information.",
    "structure":   "Walk through Situation, Task, Action, Result so the listener knows where you are at each step.",
    "confidence":  "Swap phrases like 'I think' and 'kind of' for direct statements — you know this.",
    "relevance":   "Start by echoing a word from the question so the connection is obvious from the first sentence.",
}

_ENCOURAGEMENTS = {
    "high":   "Excellent — this answer is interview-ready.",
    "mid":    "Solid foundation here — one small tweak will make it land.",
    "low":    "Good effort getting it out — consistency will move these scores fast.",
}


def _score_rule_based(question: str, transcript: str) -> dict:
    words     = transcript.split()
    wc        = len(words)
    lower     = transcript.lower()
    filler    = analyze_fillers(transcript)

    # Clarity (length proxy)
    if   80 <= wc <= 220:  clarity = 8.0
    elif 40 <= wc <   80:  clarity = 6.0
    elif 220 < wc <= 320:  clarity = 6.0
    elif wc < 40:          clarity = 4.0
    else:                  clarity = 3.0

    # Conciseness
    if   100 <= wc <= 250: conciseness = 8.0
    elif  60 <= wc < 100:  conciseness = 6.0
    elif 250 < wc <= 350:  conciseness = 6.0
    elif  30 <= wc <  60:  conciseness = 4.0
    elif 350 < wc <= 450:  conciseness = 4.0
    else:                  conciseness = 2.0

    # Structure (STAR keyword hits)
    star = ["situation", "task", "action", "result", "problem", "solution",
            "first", "then", "finally", "ultimately", "as a result", "consequently"]
    structure = float(min(10, sum(2 for kw in star if kw in lower)))

    # Confidence (hedges + fillers)
    hedges = ["maybe", "perhaps", "kind of", "sort of", "i think", "i guess",
              "probably", "might", "i'm not sure", "possibly"]
    hedge_hits = sum(1 for h in hedges if h in lower)
    confidence = float(max(0.0, 8.0 - hedge_hits * 2.0 - min(3, filler["filler_count"])))

    # Relevance (keyword overlap)
    q_words  = set(re.findall(r"\b\w{4,}\b", question.lower()))
    a_words  = set(re.findall(r"\b\w{4,}\b", lower))
    overlap  = len(q_words & a_words) / max(len(q_words), 1)
    relevance = float(min(10.0, round(overlap * 20)))

    scores  = dict(clarity=clarity, conciseness=conciseness,
                   structure=structure, confidence=confidence, relevance=relevance)
    weakest = min(scores, key=scores.get)
    avg     = sum(scores.values()) / 5

    tier = "high" if avg >= 7 else "mid" if avg >= 5 else "low"

    return {
        **scores,
        "suggestion":    _SUGGESTIONS[weakest],
        "encouragement": _ENCOURAGEMENTS[tier],
        "scorer":        "rule_based",
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def score_response(question: str, transcript: str) -> dict:
    """HuggingFace → rule-based fallback. Always returns the standard schema."""
    try:
        return _score_with_huggingface(question, transcript)
    except Exception:
        result = _score_rule_based(question, transcript)
        result["scorer"] = "rule_based (HF unavailable)"
        return result


def overall_score(scores: dict) -> float:
    return round(sum(float(scores.get(c, 0)) for c in CATEGORIES) / len(CATEGORIES), 1)
