import streamlit as st


def inject_css():
    st.markdown(
        """
        <style>
        /* ── Typography ─────────────────────────────── */
        h1 { letter-spacing: -0.5px; }
        .stApp { font-family: 'Inter', 'Segoe UI', sans-serif; }

        /* ── Cards ──────────────────────────────────── */
        .card {
            background: var(--secondary-background-color);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 16px;
        }

        /* ── Question card ───────────────────────────── */
        .question-card {
            background: linear-gradient(135deg, #1e293b, #1a2540);
            border: 1px solid rgba(99,102,241,0.35);
            border-left: 4px solid #6366f1;
            border-radius: 10px;
            padding: 18px 20px;
            font-size: 1.05rem;
            line-height: 1.6;
            color: #e2e8f0;
        }

        /* ── Score badge ─────────────────────────────── */
        .score-ring {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 110px;
            height: 110px;
            border-radius: 50%;
            margin: 0 auto 12px;
            font-weight: 800;
            font-size: 2rem;
            line-height: 1;
        }
        .score-ring small {
            font-size: 0.85rem;
            font-weight: 500;
            opacity: 0.75;
            margin-top: 2px;
        }
        .score-green  { background: #22c55e22; border: 3px solid #22c55e; color: #22c55e; }
        .score-amber  { background: #f59e0b22; border: 3px solid #f59e0b; color: #f59e0b; }
        .score-red    { background: #ef444422; border: 3px solid #ef4444; color: #ef4444; }

        /* ── Category pill ───────────────────────────── */
        .pill {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 99px;
            font-size: 0.78rem;
            font-weight: 600;
            margin-right: 4px;
        }
        .pill-green { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e55; }
        .pill-amber { background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b55; }
        .pill-red   { background: #ef444422; color: #ef4444; border: 1px solid #ef444455; }

        /* ── Recording pulse ─────────────────────────── */
        @keyframes pulse {
            0%   { box-shadow: 0 0 0 0 rgba(231,76,60,0.6); }
            70%  { box-shadow: 0 0 0 12px rgba(231,76,60,0); }
            100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
        }
        .recording-dot {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #e74c3c;
            border-radius: 50%;
            animation: pulse 1.4s infinite;
            margin-right: 8px;
            vertical-align: middle;
        }

        /* ── Feature card (home page) ────────────────── */
        .feature-card {
            background: var(--secondary-background-color);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 28px 24px;
            text-align: center;
            height: 100%;
        }
        .feature-icon { font-size: 2.2rem; margin-bottom: 10px; }
        .feature-title { font-weight: 700; font-size: 1.1rem; margin-bottom: 6px; }
        .feature-desc  { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }

        /* ── Step list (how it works) ────────────────── */
        .step {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .step-num {
            min-width: 30px;
            height: 30px;
            background: #6366f1;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.85rem;
        }
        .step-text { line-height: 1.5; color: #cbd5e1; }

        /* ── Stat block ──────────────────────────────── */
        .stat-block {
            text-align: center;
            padding: 16px;
            background: var(--secondary-background-color);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.07);
        }
        .stat-num  { font-size: 2rem; font-weight: 800; color: #6366f1; }
        .stat-label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

        /* ── Filler highlight ────────────────────────── */
        .filler-tag {
            background: #f59e0b33;
            color: #f59e0b;
            border-radius: 4px;
            padding: 1px 4px;
            font-weight: 600;
        }

        /* ── Sidebar nav styling ─────────────────────── */
        section[data-testid="stSidebar"] {
            background: #0f172a;
            border-right: 1px solid rgba(255,255,255,0.07);
        }
        section[data-testid="stSidebar"] .stButton > button {
            background: transparent !important;
            border: none !important;
            text-align: left !important;
            color: #94a3b8 !important;
            font-weight: 500 !important;
            font-size: 0.9rem !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            transition: background 0.15s, color 0.15s;
        }
        section[data-testid="stSidebar"] .stButton > button:hover {
            background: rgba(99,102,241,0.12) !important;
            color: #e2e8f0 !important;
        }
        section[data-testid="stSidebar"] .stButton > button:disabled {
            background: rgba(99,102,241,0.18) !important;
            color: #a5b4fc !important;
            opacity: 1 !important;
        }

        /* ── Page divider ────────────────────────────── */
        hr { border-color: rgba(255,255,255,0.07) !important; }

        /* ── Metric labels ───────────────────────────── */
        [data-testid="stMetricLabel"] { color: #64748b !important; font-size: 0.75rem !important; }
        [data-testid="stMetricValue"] { font-weight: 700 !important; color: #e2e8f0 !important; }

        /* ── Hide default streamlit menu ─────────────── */
        footer { visibility: hidden; }
        #MainMenu { visibility: hidden; }

        /* ── Progress bar color override ─────────────── */
        .stProgress > div > div > div > div {
            background: linear-gradient(90deg, #6366f1, #8b5cf6);
        }

        /* ── Button — primary ────────────────────────── */
        .stButton > button[kind="primary"] {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            border: none !important;
            font-weight: 600 !important;
        }

        /* ── Info box ────────────────────────────────── */
        .stAlert {
            border-radius: 10px !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def score_color_class(score: float) -> str:
    if score >= 7:
        return "score-green"
    elif score >= 5:
        return "score-amber"
    return "score-red"


def pill_class(score: float) -> str:
    if score >= 7:
        return "pill-green"
    elif score >= 5:
        return "pill-amber"
    return "pill-red"


def score_ring_html(score: float, label: str = "Overall") -> str:
    css_class = score_color_class(score)
    return f"""
    <div class="score-ring {css_class}">
        {score:.1f}
        <small>{label}</small>
    </div>
    """


def feature_card_html(icon: str, title: str, desc: str) -> str:
    return f"""
    <div class="feature-card">
        <div class="feature-icon">{icon}</div>
        <div class="feature-title">{title}</div>
        <div class="feature-desc">{desc}</div>
    </div>
    """


def step_html(num: int, title: str, desc: str) -> str:
    return f"""
    <div class="step">
        <div class="step-num">{num}</div>
        <div class="step-text"><strong>{title}</strong><br>{desc}</div>
    </div>
    """
