import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
import streamlit as st

from frontend.styles import inject_css, pill_class
from backend.app.services.responses import load_best_responses, delete_response
from backend.app.services.scoring import CATEGORIES

st.set_page_config(
    page_title="Best Responses — InterviewAI",
    page_icon="🏆",
    layout="wide",
)

inject_css()

st.markdown("# 🏆 Best Responses")
st.markdown("Your saved high-scoring interview answers, sorted by score.")

try:
    responses = load_best_responses()
except Exception as e:
    st.error(f"Could not load best_responses.json: {e}")
    st.stop()

if not responses:
    st.markdown(
        '<div class="card" style="text-align:center; padding:60px; color:#475569;">'
        '<div style="font-size:3rem;">🎯</div>'
        '<h3>No saved responses yet</h3>'
        '<p>Score 7.0 or above on the Practice page to save your best answers here.</p>'
        '</div>',
        unsafe_allow_html=True,
    )
    if st.button("Go to Practice →", type="primary"):
        st.switch_page("pages/1_Practice.py")
    st.stop()

responses = sorted(responses, key=lambda r: r["overall_score"], reverse=True)

# ── Summary bar ───────────────────────────────────────────────────────────────
total   = len(responses)
avg_ov  = sum(r["overall_score"] for r in responses) / total
best_ov = responses[0]["overall_score"]
roles   = {r.get("role", "").replace("_", " ").title() for r in responses}

m1, m2, m3, m4 = st.columns(4)
m1.markdown(
    f'<div class="stat-block"><div class="stat-num">{total}</div><div class="stat-label">Saved</div></div>',
    unsafe_allow_html=True,
)
m2.markdown(
    f'<div class="stat-block"><div class="stat-num">{avg_ov:.1f}</div><div class="stat-label">Avg Score</div></div>',
    unsafe_allow_html=True,
)
m3.markdown(
    f'<div class="stat-block"><div class="stat-num">{best_ov:.1f}</div><div class="stat-label">Best Score</div></div>',
    unsafe_allow_html=True,
)
m4.markdown(
    f'<div class="stat-block"><div class="stat-num">{len(roles)}</div><div class="stat-label">Roles Practiced</div></div>',
    unsafe_allow_html=True,
)

st.markdown("<br>", unsafe_allow_html=True)

# ── Filters ────────────────────────────────────────────────────────────────────
with st.expander("🔍 Filter & Export"):
    fc1, fc2 = st.columns(2)
    with fc1:
        filter_role = st.multiselect(
            "Role",
            options=sorted({r.get("role", "").replace("_", " ").title() for r in responses}),
        )
    with fc2:
        min_score = st.slider("Minimum score", 0.0, 10.0, 0.0, 0.5)

    export_data = json.dumps(responses, indent=2)
    st.download_button(
        "⬇ Export all as JSON",
        data=export_data,
        file_name="best_responses.json",
        mime="application/json",
    )

filtered = [
    r for r in responses
    if (not filter_role or r.get("role", "").replace("_", " ").title() in filter_role)
    and r["overall_score"] >= min_score
]

st.markdown(f"**{len(filtered)}** of {total} responses")
st.markdown("---")

# ── Response cards ─────────────────────────────────────────────────────────────
for resp in filtered:
    ov          = resp["overall_score"]
    role_label  = resp.get("role", "").replace("_", " ").title()
    type_label  = resp.get("interview_type", "").title()
    ts          = resp.get("timestamp", "")[:10]
    badge       = "🥇" if ov >= 9 else "🥈" if ov >= 8 else "🥉"
    scores      = resp.get("scores", {})

    with st.expander(
        f"{badge} **{ov:.1f}/10** — {resp['question'][:72]}{'…' if len(resp['question']) > 72 else ''}",
        expanded=False,
    ):
        col_q, col_s = st.columns([3, 2], gap="large")

        with col_q:
            st.markdown(
                f"<small style='color:#6366f1; font-weight:600;'>"
                f"{role_label} · {type_label} · {ts}</small>",
                unsafe_allow_html=True,
            )
            st.markdown(
                f'<div class="question-card" style="margin:8px 0;">{resp["question"]}</div>',
                unsafe_allow_html=True,
            )
            st.markdown("**Your answer:**")
            st.markdown(
                f'<div class="card" style="font-size:0.92rem; line-height:1.7; color:#cbd5e1;">'
                f'{resp["transcript"]}</div>',
                unsafe_allow_html=True,
            )

        with col_s:
            st.markdown("**Category scores:**")
            for cat in CATEGORIES:
                val = scores.get(cat, 0)
                css = pill_class(val)
                st.markdown(
                    f"<div style='display:flex; justify-content:space-between; margin-bottom:2px;'>"
                    f"<span>{cat.title()}</span>"
                    f"<span class='pill {css}'>{val}/10</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
                st.progress(val / 10)

            if scores.get("feedback"):
                st.markdown("---")
                st.caption(f"💬 {scores['feedback']}")

        st.markdown("---")
        del_col, _ = st.columns([1, 3])
        with del_col:
            if st.button("🗑 Delete", key=f"del_{resp['id']}", type="secondary"):
                if delete_response(resp["id"]):
                    st.success("Deleted.")
                    st.rerun()
