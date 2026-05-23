import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
from frontend.styles import inject_css, feature_card_html, step_html
from backend.app.services.responses import load_best_responses

st.set_page_config(
    page_title="InterviewAI Coach",
    page_icon="🎙",
    layout="wide",
    initial_sidebar_state="collapsed",
)

inject_css()

# ── Sidebar nav ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        "<div style='padding:12px 0 20px;'>"
        "<div style='font-size:1.4rem; font-weight:800; color:#6366f1; letter-spacing:-0.5px;'>InterviewAI</div>"
        "<div style='font-size:0.75rem; color:#64748b; margin-top:2px;'>Your personal coach</div>"
        "</div>",
        unsafe_allow_html=True,
    )
    st.button("🏠  Home", use_container_width=True, disabled=True, type="primary")
    if st.button("🎙  Practice", use_container_width=True):
        st.switch_page("pages/1_Practice.py")
    if st.button("🏆  Best Responses", use_container_width=True):
        st.switch_page("pages/2_Best_Responses.py")
    if st.button("⚙️  Settings", use_container_width=True):
        st.switch_page("pages/3_Settings.py")

# ── Hero ───────────────────────────────────────────────────────────────────────
st.markdown(
    """
    <div style="padding: 48px 0 32px; max-width: 640px; margin: 0 auto; text-align: center;">
        <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(99,102,241,0.12);
                    border:1px solid rgba(99,102,241,0.3); border-radius:99px;
                    padding:6px 16px; font-size:0.8rem; color:#818cf8; margin-bottom:20px;">
            <span>🎙</span> <span>AI-powered interview coaching</span>
        </div>
        <h1 style="font-size:2.8rem; font-weight:900; margin:0 0 12px; letter-spacing:-1px;
                   background:linear-gradient(135deg,#e2e8f0,#a5b4fc); -webkit-background-clip:text;
                   -webkit-text-fill-color:transparent; background-clip:text;">
            InterviewAI Coach
        </h1>
        <p style="color:#94a3b8; font-size:1.1rem; margin:0; line-height:1.6;">
            Practice interview answers. Get scored instantly.<br>Land the job.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

col_l, col_c, col_r = st.columns([2, 1, 2])
with col_c:
    if st.button("Start Practicing →", type="primary", use_container_width=True):
        st.switch_page("pages/1_Practice.py")

st.markdown("<br><br>", unsafe_allow_html=True)

# ── Feature cards ──────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4, gap="medium")

cards = [
    ("🎤", "Voice Recording",
     "Record directly in the browser. Auto-stops after 5 seconds of silence — no button needed."),
    ("📝", "Live Transcript",
     "See your answer transcribed in real time using a local AI model. No audio leaves your machine."),
    ("📊", "5-Category Score",
     "Rated 0–10 on Clarity, Conciseness, Structure, Confidence, and Relevance."),
    ("🏆", "Best Responses",
     "Answers scoring 7.0+ are saved locally. Review and compare your strongest takes."),
]

for col, (icon, title, desc) in zip([c1, c2, c3, c4], cards):
    with col:
        st.markdown(feature_card_html(icon, title, desc), unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ── How it works + Stats ────────────────────────────────────────────────────────
left, right = st.columns([3, 2], gap="large")

with left:
    st.markdown(
        "<div style='font-weight:700; font-size:1.1rem; margin-bottom:12px;'>How it works</div>",
        unsafe_allow_html=True,
    )
    steps = [
        ("Choose a role & question type",
         "Software Engineering, Marketing, Finance, and more — Behavioral, Technical, or Mixed."),
        ("Get a question from the bank",
         "Draw from 45 pre-loaded questions instantly. No LLM call needed."),
        ("Record your answer",
         "Click the microphone. Speak naturally. The app auto-stops after 5s of silence."),
        ("See your transcript appear",
         "faster-whisper processes audio locally and streams text as it goes."),
        ("Review your score",
         "Get a breakdown across 5 categories with specific coaching tips."),
        ("Save high-scoring responses",
         "Anything 7.0+ is eligible to save to your personal Best Responses tracker."),
    ]
    for num, (title, desc) in enumerate(steps, start=1):
        st.markdown(step_html(num, title, desc), unsafe_allow_html=True)

with right:
    st.markdown(
        "<div style='font-weight:700; font-size:1.1rem; margin-bottom:12px;'>Your progress</div>",
        unsafe_allow_html=True,
    )
    try:
        saved = load_best_responses()
        total = len(saved)
        avg = round(sum(r["overall_score"] for r in saved) / total, 1) if saved else 0.0
        best = max((r["overall_score"] for r in saved), default=0.0)
    except Exception:
        total, avg, best = 0, 0.0, 0.0

    s1, s2 = st.columns(2)
    s1.markdown(
        f'<div class="stat-block"><div class="stat-num">{total}</div>'
        f'<div class="stat-label">Saved Responses</div></div>',
        unsafe_allow_html=True,
    )
    s2.markdown(
        f'<div class="stat-block"><div class="stat-num">{avg:.1f}</div>'
        f'<div class="stat-label">Avg Score</div></div>',
        unsafe_allow_html=True,
    )
    st.markdown("<br>", unsafe_allow_html=True)
    s3, s4 = st.columns(2)
    s3.markdown(
        f'<div class="stat-block"><div class="stat-num">{best:.1f}</div>'
        f'<div class="stat-label">Best Score</div></div>',
        unsafe_allow_html=True,
    )
    s4.markdown(
        f'<div class="stat-block"><div class="stat-num">45</div>'
        f'<div class="stat-label">Questions</div></div>',
        unsafe_allow_html=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("View Best Responses →", use_container_width=True):
        st.switch_page("pages/2_Best_Responses.py")

# ── Privacy note ───────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(
    "<p style='text-align:center; color:#475569; font-size:0.82rem;'>"
    "🔒 All audio is processed locally. No recordings are uploaded to any server. "
    "Transcription runs on your machine via <code>faster-whisper</code>."
    "</p>",
    unsafe_allow_html=True,
)
