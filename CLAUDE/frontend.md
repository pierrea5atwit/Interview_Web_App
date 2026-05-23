# Frontend — Streamlit UI

## Entry Point
```bash
streamlit run frontend/app.py
```

## Page Structure
```
frontend/
  app.py                    ← Home/welcome page (st.set_page_config here)
  pages/
    1_Practice.py           ← Main interview flow
    2_Best_Responses.py     ← Saved high-score responses
```

Streamlit auto-generates sidebar navigation from `pages/` filenames. The number prefix controls order; underscores become spaces.

## Session State Keys
Managed in `1_Practice.py`:
```python
st.session_state.transcript      # str — current transcript text
st.session_state.scores          # dict | None — scoring result
st.session_state.current_question  # str | None — selected question
st.session_state.role            # str — selected role
st.session_state.interview_type  # str — selected interview type
```

Initialize at the top of each page that uses them:
```python
for key, default in [("transcript", ""), ("scores", None), ("current_question", None)]:
    if key not in st.session_state:
        st.session_state[key] = default
```

## Layout Pattern (Practice Page)
```
st.sidebar  → question setup (role, type, "Get New Question")
col1 (left) → question display + recorder + transcript
col2 (right) → score display (overall + 5 category bars + feedback)
```

Use `st.columns([3, 2])` for the main split.

## Scoring Display
Score color thresholds:
- ≥ 7.0 → green `#22c55e`
- ≥ 5.0 → amber `#f59e0b`
- < 5.0 → red `#ef4444`

Display pattern:
```python
st.progress(score / 10)  # bar
st.metric("Overall", f"{score:.1f}/10")
```

## Progressive Transcript Display
```python
transcript_box = st.empty()
full_text = ""
for segment_text in transcribe_audio_streaming(audio_bytes):
    full_text += segment_text + " "
    transcript_box.text_area("Transcript", value=full_text.strip(), height=150)
```

After streaming completes, replace with editable `st.text_area` bound to session state.

## Best Responses Page
Display as expandable cards sorted by score descending:
```python
for resp in sorted(responses, key=lambda r: r["overall_score"], reverse=True):
    with st.expander(f"⭐ {resp['overall_score']:.1f}/10 — {resp['question'][:60]}..."):
        st.write(resp["transcript"])
        # mini score table
```

Allow delete per response (update JSON file on click).

## Streamlit Gotchas
- `st.set_page_config()` must be the FIRST Streamlit call in each page file
- Widgets re-run the entire script on interaction — use `st.session_state` to persist values across re-runs
- `st.audio(bytes, format="audio/wav")` to play back recording before scoring
- Use `st.spinner()` context manager around transcription/scoring calls
- `st.rerun()` forces a full page refresh (use sparingly)

## Theming
Configure in `.streamlit/config.toml`:
```toml
[theme]
primaryColor = "#6366f1"
backgroundColor = "#0f172a"
secondaryBackgroundColor = "#1e293b"
textColor = "#e2e8f0"
font = "sans serif"
```

## Do Not
- Do not use `st.experimental_*` (deprecated)
- Do not run blocking code without `st.spinner()`
- Do not store large audio bytes in session state across pages (pass via temp file path)
