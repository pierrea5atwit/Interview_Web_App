from collections import Counter

FILLER_WORDS = {
    "um", "uh", "like", "you know", "basically", "actually",
    "so", "right", "literally", "kind of", "sort of", "i mean",
}

# Multi-word fillers checked separately
MULTI_WORD_FILLERS = {"you know", "kind of", "sort of", "i mean"}


def analyze_fillers(text: str) -> dict:
    lower = text.lower()

    # Find multi-word fillers first
    multi_hits = []
    for phrase in MULTI_WORD_FILLERS:
        count = lower.count(phrase)
        multi_hits.extend([phrase] * count)

    # Single-word fillers
    words = lower.split()
    single_words = [w.strip(".,!?;:\"'") for w in words]
    single_hits = [
        w for w in single_words
        if w in FILLER_WORDS and w not in MULTI_WORD_FILLERS
    ]

    all_fillers = multi_hits + single_hits
    total_words = len(words)
    filler_count = len(all_fillers)
    filler_rate = round((filler_count / total_words) * 100, 1) if total_words > 0 else 0.0

    counter = Counter(all_fillers)
    top_fillers = counter.most_common(3)

    return {
        "total_words": total_words,
        "filler_count": filler_count,
        "filler_rate": filler_rate,
        "fillers_found": all_fillers,
        "top_fillers": top_fillers,
    }
