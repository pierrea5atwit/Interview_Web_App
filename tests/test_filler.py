from backend.app.services.filler import analyze_fillers


def test_filler_detection():
    text = "Um so I basically like went to the store you know"
    result = analyze_fillers(text)
    assert result["filler_count"] > 0
    assert result["filler_rate"] > 0
    assert result["total_words"] == 11  # "Um so I basically like went to the store you know"


def test_clean_answer():
    text = "I led the project from design through deployment in three months."
    result = analyze_fillers(text)
    assert result["filler_count"] == 0
    assert result["filler_rate"] == 0.0


def test_top_fillers_returned():
    text = "Um um um like like basically"
    result = analyze_fillers(text)
    assert "top_fillers" in result
    assert len(result["top_fillers"]) > 0
    top_word, top_count = result["top_fillers"][0]
    assert top_word == "um"
    assert top_count == 3
