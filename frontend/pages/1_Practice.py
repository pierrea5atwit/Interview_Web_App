import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import random
import streamlit as st
from audio_recorder_streamlit import audio_recorder

from frontend.styles import inject_css, score_ring_html, pill_class
from backend.app.services.transcription import transcribe_audio_streaming
from backend.app.services.scoring import score_response, overall_score, CATEGORIES
from backend.app.services.filler import analyze_fillers
from backend.app.services.responses import load_questions, save_best_response

st.set_page_config(
    page_title="Practice — InterviewAI",
    page_icon="🎙",
    layout="wide",
)

inject_css()

# ── Session state ──────────────────────────────────────────────────────────────
_DEFAULTS = {
    "transcript": "",
    "scores": None,
    "current_question": None,
    "audio_bytes": None,
    "role": None,
    "interview_type": None,
    "saved": False,
    "recording_done": False,
}
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Sidebar: question setup ────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## Setup")

    try:
        questions_bank = load_questions()
    except Exception as e:
        st.error(f"Could not load questions.json: {e}")
        st.stop()

    role = st.selectbox(
        "Role",
        options=list(questions_bank.keys()),
        format_func=lambda x: x.replace("_", " ").title(),
    )
    interview_type = st.selectbox(
        "Interview Type",
        options=list(questions_bank.get(role, {}).keys()),
        format_func=lambda x: x.title(),
    )
    available = questions_bank.get(role, {}).get(interview_type, [])

    if st.button("🎲 New Question", use_container_width=True, type="primary"):
        if available:
            st.session_state.current_question = random.choice(available)
        st.session_state.transcript = ""
        st.session_state.scores = None
        st.session_state.audio_bytes = None
        st.session_state.saved = False
        st.session_state.recording_done = False
        st.session_state.role = role
        st.session_state.interview_type = interview_type

    st.markdown("---")
    st.markdown(
        "<small style='color:#64748b'>🎙 Mic auto-stops after **5s silence**.<br>"
        "📝 Transcript updates as audio processes.<br>"
        "🏆 Score 7.0+ to save a response.</small>",
        unsafe_allow_html=True,
    )
    st.markdown("---")
    if st.button("⚙️ Settings", use_container_width=True):
        st.switch_page("pages/3_Settings.py")

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown("# 🎙 Practice Session")

# ── Question card ─────────────────────────────────────────────────────────────
if st.session_state.current_question:
    role_label = (st.session_state.role or role).replace("_", " ").title()
    type_label = (st.session_state.interview_type or interview_type).title()
    st.markdown(
        f"<small style='color:#6366f1; font-weight:600;'>{role_label} · {type_label}</small>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<div class="question-card">{st.session_state.current_question}</div>',
        unsafe_allow_html=True,
    )
else:
    st.info("Click **🎲 New Question** in the sidebar to get started.")

st.markdown("<br>", unsafe_allow_html=True)

# ── Main columns ──────────────────────────────────────────────────────────────
col_left, col_right = st.columns([3, 2], gap="large")

# ── LEFT: record + transcript ─────────────────────────────────────────────────
with col_left:
    st.markdown("### Record Your Answer")
    st.markdown(
        "<small style='color:#64748b'>Click the microphone to start. "
        "Recording stops automatically after 5 seconds of silence.</small>",
        unsafe_allow_html=True,
    )

    audio_bytes = audio_recorder(
        text="",
        recording_color="#e74c3c",
        neutral_color="#6366f1",
        icon_name="microphone",
        icon_size="3x",
        pause_threshold=5.0,
        sample_rate=41_000,
    )

    # Detect new recording
    if audio_bytes and audio_bytes != st.session_state.audio_bytes:
        st.session_state.audio_bytes = audio_bytes
        st.session_state.transcript = ""
        st.session_state.scores = None
        st.session_state.saved = False
        st.session_state.recording_done = False

    # Playback
    if st.session_state.audio_bytes:
        st.audio(st.session_state.audio_bytes, format="audio/wav")

        # Transcribe if not yet done
        if not st.session_state.recording_done:
            st.markdown(
                '<span class="recording-dot"></span>'
                '<strong style="color:#e74c3c;">Transcribing…</strong>',
                unsafe_allow_html=True,
            )
            transcript_placeholder = st.empty()
            full_text = ""
            try:
                for seg in transcribe_audio_streaming(st.session_state.audio_bytes):
                    full_text += seg + " "
                    transcript_placeholder.markdown(
                        f'<div class="card" style="min-height:80px; color:#e2e8f0; line-height:1.7;">'
                        f'{full_text.strip()}</div>',
                        unsafe_allow_html=True,
                    )
            except Exception as e:
                st.error(f"Transcription error: {e}")

            st.session_state.transcript = full_text.strip()
            st.session_state.recording_done = True
            st.rerun()

    # Editable transcript
    if st.session_state.transcript:
        st.markdown("### 📝 Transcript")
        st.session_state.transcript = st.text_area(
            "Edit if needed:",
            value=st.session_state.transcript,
            height=160,
            label_visibility="collapsed",
        )

        # Filler stats
        filler = analyze_fillers(st.session_state.transcript)
        f1, f2, f3 = st.columns(3)
        f1.metric("Words", filler["total_words"])
        f2.metric("Fillers", filler["filler_count"])
        f3.metric("Filler Rate", f"{filler['filler_rate']:.1f}%")

        if filler["top_fillers"]:
            pills = " ".join(
                f'<span class="pill pill-amber">"{w}" ×{n}</span>'
                for w, n in filler["top_fillers"]
            )
            st.markdown(f"Most used: {pills}", unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        if not st.session_state.scores:
            if st.button("📊 Score My Response", type="primary", use_container_width=True):
                if not st.session_state.current_question:
                    st.warning("Select a question first (click 🎲 New Question in sidebar).")
                else:
                    with st.spinner("Analysing your response…"):
                        try:
                            result = score_response(
                                question=st.session_state.current_question,
                                transcript=st.session_state.transcript,
                            )
                            st.session_state.scores = result
                            st.session_state.saved = False
                        except Exception as e:
                            st.error(f"Scoring error: {e}")

# ── RIGHT: score panel ────────────────────────────────────────────────────────
with col_right:
    st.markdown("### 📊 Score")

    if not st.session_state.scores:
        st.markdown(
            '<div class="card" style="text-align:center; color:#475569; padding:40px 24px;">'
            '<div style="font-size:2.5rem;">🎯</div>'
            '<p>Record your answer and click<br><strong>Score My Response</strong></p>'
            '</div>',
            unsafe_allow_html=True,
        )
    else:
        scores = st.session_state.scores
        ov = overall_score(scores)

        # Score ring
        st.markdown(score_ring_html(ov), unsafe_allow_html=True)
        st.markdown(
            f"<p style='text-align:center; color:#64748b; font-size:0.8rem; margin-top:-8px;'>"
            f"scored by <code>{scores.get('scorer', '?')}</code></p>",
            unsafe_allow_html=True,
        )

        st.markdown("---")

        # Per-category breakdown
        for cat in CATEGORIES:
            val = scores.get(cat, 0)
            fb  = scores.get(f"{cat}_feedback", "")
            css = pill_class(val)
            st.markdown(
                f"<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;'>"
                f"<span style='font-weight:600;'>{cat.title()}</span>"
                f"<span class='pill {css}'>{val}/10</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
            st.progress(val / 10)
            if fb:
                st.caption(fb)

        # Overall feedback box
        if scores.get("feedback"):
            st.markdown("---")
            st.markdown(
                f'<div class="card" style="border-left:3px solid #6366f1; font-size:0.92rem; line-height:1.6;">'
                f'💬 {scores["feedback"]}</div>',
                unsafe_allow_html=True,
            )

        # Save CTA
        st.markdown("---")
        if ov >= 7.0 and not st.session_state.saved:
            st.success("🏆 High score! Save this response?")
            if st.button("💾 Save to Best Responses", use_container_width=True):
                save_best_response(
                    question=st.session_state.current_question or "",
                    transcript=st.session_state.transcript,
                    scores=scores,
                    overall_score=ov,
                    role=st.session_state.role or role,
                    interview_type=st.session_state.interview_type or interview_type,
                )
                st.session_state.saved = True
                st.success("Saved! View it in Best Responses.")
        elif st.session_state.saved:
            st.success("✅ Saved to Best Responses.")
            if st.button("View Best Responses →", use_container_width=True):
                st.switch_page("pages/2_Best_Responses.py")
        else:
            st.caption(f"Score **7.0 or above** to save. Current: {ov:.1f}. Keep going!")
