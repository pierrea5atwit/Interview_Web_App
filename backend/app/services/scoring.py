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

    sentences = [s.strip() for s in re.split(r"[.!?]", transcript) if s.strip()]
    avg_sentence_len = word_count / max(len(sentences), 1)
    clarity = max(0, min(10, round(10 - max(0, avg_sentence_len - 25) * 0.4)))

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
        "clarity_feedback": f"Avg sentence length: {avg_sentence_len:.0f} words. {'Good flow.' if clarity >= 7 else 'Try shorter sentences.'}",
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
    for scorer in [_score_with_ollama, _score_with_huggingface, _score_rule_based]:
        try:
            return scorer(question, transcript)
        except Exception:
            continue
    return _score_rule_based(question, transcript)


def overall_score(scores: dict) -> float:
    return round(sum(scores.get(c, 0) for c in CATEGORIES) / len(CATEGORIES), 1)
