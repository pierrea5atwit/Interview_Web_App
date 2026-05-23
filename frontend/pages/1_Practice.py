import html
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import random
import streamlit as st
from audio_recorder_streamlit import audio_recorder

from frontend.styles import inject_css, score_ring_html, pill_class
from backend.app.services.transcription import transcribe_audio_streaming
from backend.app.services.scoring import (
    score_response, overall_score, CATEGORIES,
    generate_better_response, _BETTER_FALLBACK,
)
from backend.app.services.filler import analyze_fillers
from backend.app.services.responses import load_questions, save_best_response

st.set_page_config(
    page_title="Practice — InterviewAI",
    page_icon="🎙",
    layout="wide",
)

inject_css()

# ── Session state ──────────────────────────────────────────────────────────────
for key, default in [
    ("transcript", ""),
    ("scores", None),
    ("current_question", None),
    ("audio_bytes", None),
    ("role", None),
    ("interview_type", None),
    ("saved", False),
    ("better_response", None),
    ("better_is_fallback", False),
]:
    if key not in st.session_state:
        st.session_state[key] = default

# ── Sidebar nav ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        "<div style='padding:12px 0 20px;'>"
        "<div style='font-size:1.4rem; font-weight:800; color:#6366f1; letter-spacing:-0.5px;'>InterviewAI</div>"
        "<div style='font-size:0.75rem; color:#64748b; margin-top:2px;'>Your personal coach</div>"
        "</div>",
        unsafe_allow_html=True,
    )

    if st.button("🏠  Home", use_container_width=True):
        st.switch_page("app.py")
    st.button("🎙  Practice", use_container_width=True, disabled=True, type="primary")
    if st.button("🏆  Best Responses", use_container_width=True):
        st.switch_page("pages/2_Best_Responses.py")
    if st.button("⚙️  Settings", use_container_width=True):
        st.switch_page("pages/3_Settings.py")

    st.markdown("---")
    st.markdown("#### Setup")

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
        st.session_state.better_response = None
        st.session_state.better_is_fallback = False
        st.session_state.role = role
        st.session_state.interview_type = interview_type

    st.markdown(
        "<div style='margin-top:16px; padding:12px; background:rgba(99,102,241,0.08); "
        "border-radius:8px; border:1px solid rgba(99,102,241,0.2);'>"
        "<div style='font-size:0.75rem; color:#94a3b8; line-height:1.6;'>"
        "🎙 Auto-stops after <b>5s silence</b><br>"
        "📝 Transcript appears after recording<br>"
        "🏆 Score 7.0+ to save a response"
        "</div></div>",
        unsafe_allow_html=True,
    )

# ── Page header ───────────────────────────────────────────────────────────────
st.markdown(
    "<div style='display:flex; align-items:center; gap:12px; margin-bottom:4px;'>"
    "<span style='font-size:1.8rem;'>🎙</span>"
    "<div><h2 style='margin:0; font-weight:800;'>Practice Session</h2>"
    "<p style='margin:0; color:#64748b; font-size:0.9rem;'>Record your answer and get instant feedback</p>"
    "</div></div>",
    unsafe_allow_html=True,
)

# ── Question card ─────────────────────────────────────────────────────────────
if st.session_state.current_question:
    role_label = (st.session_state.role or role).replace("_", " ").title()
    type_label = (st.session_state.interview_type or interview_type).title()
    st.markdown(
        f"<div style='display:flex; gap:8px; margin:12px 0 6px;'>"
        f"<span style='background:rgba(99,102,241,0.15); color:#818cf8; padding:3px 10px; "
        f"border-radius:99px; font-size:0.75rem; font-weight:600;'>{role_label}</span>"
        f"<span style='background:rgba(99,102,241,0.10); color:#6366f1; padding:3px 10px; "
        f"border-radius:99px; font-size:0.75rem; font-weight:600;'>{type_label}</span>"
        f"</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<div class="question-card">{html.escape(st.session_state.current_question)}</div>',
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        "<div style='background:rgba(99,102,241,0.07); border:1px dashed rgba(99,102,241,0.3); "
        "border-radius:12px; padding:24px; text-align:center; margin:12px 0;'>"
        "<div style='font-size:2rem; margin-bottom:8px;'>🎲</div>"
        "<div style='color:#94a3b8;'>Click <b>New Question</b> in the sidebar to get started</div>"
        "</div>",
        unsafe_allow_html=True,
    )

st.markdown("<br>", unsafe_allow_html=True)

col_left, col_right = st.columns([3, 2], gap="large")

# ── LEFT: recording + transcript ──────────────────────────────────────────────
with col_left:
    st.markdown(
        "<div style='font-weight:700; font-size:1rem; margin-bottom:4px;'>Record Your Answer</div>"
        "<div style='color:#64748b; font-size:0.82rem; margin-bottom:12px;'>"
        "Click the mic. Auto-stops after 5 seconds of silence.</div>",
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

    if audio_bytes and audio_bytes != st.session_state.audio_bytes:
        st.session_state.audio_bytes = audio_bytes
        st.session_state.transcript = ""
        st.session_state.scores = None
        st.session_state.saved = False
        st.session_state.better_response = None
        st.session_state.better_is_fallback = False

        st.audio(audio_bytes, format="audio/wav")

        st.markdown(
            '<div style="display:flex; align-items:center; gap:8px; margin:8px 0;">'
            '<span class="recording-dot"></span>'
            '<span style="color:#94a3b8; font-size:0.9rem; font-weight:500;">Transcribing…</span>'
            '</div>',
            unsafe_allow_html=True,
        )
        placeholder = st.empty()
        full_text = ""
        gen = transcribe_audio_streaming(audio_bytes)
        try:
            for seg in gen:
                full_text += seg + " "
                placeholder.markdown(
                    f'<div class="card" style="color:#e2e8f0; line-height:1.7;">'
                    f'{html.escape(full_text.strip())}</div>',
                    unsafe_allow_html=True,
                )
        except Exception as e:
            st.error(f"Transcription error: {e}")
        finally:
            gen.close()

        placeholder.empty()
        st.session_state.transcript = full_text.strip()

    elif st.session_state.audio_bytes:
        st.audio(st.session_state.audio_bytes, format="audio/wav")

    if st.session_state.transcript:
        st.markdown(
            "<div style='font-weight:700; font-size:1rem; margin:16px 0 4px;'>📝 Transcript</div>",
            unsafe_allow_html=True,
        )
        st.session_state.transcript = st.text_area(
            "Edit if needed:",
            value=st.session_state.transcript,
            height=160,
            label_visibility="collapsed",
        )

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
                    st.warning("Select a question first — click 🎲 New Question in the sidebar.")
                else:
                    with st.spinner("Analysing your response…"):
                        try:
                            st.session_state.scores = score_response(
                                question=st.session_state.current_question,
                                transcript=st.session_state.transcript,
                            )
                        except Exception as e:
                            st.error(f"Scoring error: {e}")

# ── RIGHT: score panel ────────────────────────────────────────────────────────
with col_right:
    st.markdown(
        "<div style='font-weight:700; font-size:1rem; margin-bottom:12px;'>📊 Score</div>",
        unsafe_allow_html=True,
    )

    if not st.session_state.scores:
        st.markdown(
            '<div class="card" style="text-align:center; color:#475569; padding:40px 24px;">'
            '<div style="font-size:2.5rem; margin-bottom:12px;">🎯</div>'
            '<p style="margin:0;">Record your answer, then click<br><strong>Score My Response</strong></p>'
            '</div>',
            unsafe_allow_html=True,
        )
    else:
        scores = st.session_state.scores
        ov = overall_score(scores)

        st.markdown(score_ring_html(ov), unsafe_allow_html=True)

        scorer_label = scores.get("scorer", "?")
        scorer_color = "#64748b" if "unavailable" not in scorer_label else "#f59e0b"
        st.markdown(
            f"<p style='text-align:center; color:{scorer_color}; font-size:0.78rem; margin-top:-6px;'>"
            f"scored by <code>{scorer_label}</code></p>",
            unsafe_allow_html=True,
        )

        st.markdown("---")

        for cat in CATEGORIES:
            val = scores.get(cat, 0)
            fb  = scores.get(f"{cat}_feedback", "")
            css = pill_class(val)
            st.markdown(
                f"<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;'>"
                f"<span style='font-weight:600; font-size:0.9rem;'>{cat.title()}</span>"
                f"<span class='pill {css}'>{val}/10</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
            st.progress(val / 10)
            if fb:
                st.caption(fb)

        if scores.get("feedback"):
            st.markdown("---")
            st.markdown(
                f'<div class="card" style="border-left:3px solid #6366f1; font-size:0.92rem; line-height:1.6;">'
                f'💬 {html.escape(scores["feedback"])}</div>',
                unsafe_allow_html=True,
            )

        # ── Better response ──────────────────────────────────────────────────
        st.markdown("---")
        st.markdown(
            "<div style='font-weight:700; font-size:0.95rem; margin-bottom:6px;'>✨ Stronger Response Example</div>",
            unsafe_allow_html=True,
        )

        if st.session_state.better_response:
            if st.session_state.better_is_fallback:
                st.info("LLM unavailable — showing a general STAR-method template:")
            st.markdown(
                f'<div class="card" style="border-left:3px solid #22c55e; font-size:0.92rem; line-height:1.7; color:#cbd5e1;">'
                f'{html.escape(st.session_state.better_response)}</div>',
                unsafe_allow_html=True,
            )
        else:
            can_generate = bool(st.session_state.current_question and st.session_state.transcript)
            if st.button(
                "Show me a stronger answer →",
                use_container_width=True,
                disabled=not can_generate,
            ):
                with st.spinner("Generating example…"):
                    try:
                        st.session_state.better_response = generate_better_response(
                            question=st.session_state.current_question,
                            transcript=st.session_state.transcript,
                            scores=scores,
                        )
                        st.session_state.better_is_fallback = False
                    except RuntimeError:
                        st.session_state.better_response = _BETTER_FALLBACK
                        st.session_state.better_is_fallback = True
                    except Exception as e:
                        st.error(f"Could not generate example: {e}")

        # ── Save CTA ─────────────────────────────────────────────────────────
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
                st.success("Saved!")
        elif st.session_state.saved:
            st.success("✅ Saved to Best Responses.")
            if st.button("View Best Responses →", use_container_width=True):
                st.switch_page("pages/2_Best_Responses.py")
        else:
            st.caption(f"Score 7.0+ to save. Current: {ov:.1f}. Keep going!")
