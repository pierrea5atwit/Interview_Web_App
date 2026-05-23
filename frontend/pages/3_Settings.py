import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import os
import json
import streamlit as st
from dotenv import load_dotenv, set_key

from frontend.styles import inject_css
from backend.app.services.responses import load_best_responses, _RESPONSES_FILE

st.set_page_config(
    page_title="Settings — InterviewAI",
    page_icon="⚙️",
    layout="wide",
)

load_dotenv()
inject_css()

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
    if st.button("🎙  Practice", use_container_width=True):
        st.switch_page("pages/1_Practice.py")
    if st.button("🏆  Best Responses", use_container_width=True):
        st.switch_page("pages/2_Best_Responses.py")
    st.button("⚙️  Settings", use_container_width=True, disabled=True, type="primary")

st.markdown(
    "<div style='display:flex; align-items:center; gap:12px; margin-bottom:4px;'>"
    "<span style='font-size:1.8rem;'>⚙️</span>"
    "<div><h2 style='margin:0; font-weight:800;'>Settings</h2>"
    "<p style='margin:0; color:#64748b; font-size:0.9rem;'>Configure AI models and preferences</p>"
    "</div></div>",
    unsafe_allow_html=True,
)

env_path = Path(__file__).parent.parent.parent / ".env"

# ── Transcription ─────────────────────────────────────────────────────────────
st.markdown("### 🎙 Transcription Model")
st.markdown(
    "faster-whisper runs locally on your CPU. Larger models are more accurate but slower."
)

model_options = {
    "tiny":   "Tiny (~75 MB) — Fastest, OK accuracy",
    "base":   "Base (~145 MB) — Recommended for most machines",
    "small":  "Small (~465 MB) — Better accuracy, ~3× slower",
    "medium": "Medium (~1.5 GB) — Best accuracy, needs 4+ GB RAM",
}
current_model = os.getenv("TRANSCRIPTION_MODEL", "base")
new_model = st.selectbox(
    "Model size",
    options=list(model_options.keys()),
    index=list(model_options.keys()).index(current_model),
    format_func=lambda k: model_options[k],
)

st.markdown("---")

# ── LLM Scoring ───────────────────────────────────────────────────────────────
st.markdown("### 🤖 LLM Scoring Engine")
st.markdown(
    "Scoring tries providers in order: **Ollama → HuggingFace → Rule-based**. "
    "If none are configured, rule-based scoring always works with no setup."
)

col_a, col_b = st.columns(2, gap="large")

with col_a:
    st.markdown("#### Ollama (local)")
    st.markdown(
        "[Install Ollama →](https://ollama.com) then run `ollama pull llama3.2`"
    )
    ollama_url = st.text_input(
        "Ollama base URL",
        value=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    )
    ollama_model = st.text_input(
        "Model name",
        value=os.getenv("OLLAMA_MODEL", "llama3.2"),
        help="Any model pulled via ollama pull — e.g. llama3.2, mistral, phi3",
    )

    if st.button("Test Ollama connection"):
        try:
            import ollama as _ollama
            client = _ollama.Client(host=ollama_url)
            models = client.list()
            names = [m.model for m in models.models]
            if ollama_model in names or any(ollama_model in n for n in names):
                st.success(f"Connected. Model `{ollama_model}` is available.")
            else:
                st.warning(
                    f"Connected but `{ollama_model}` not found. "
                    f"Available: {', '.join(names[:5])}"
                )
        except Exception as e:
            st.error(f"Cannot reach Ollama at {ollama_url}: {e}")

with col_b:
    st.markdown("#### HuggingFace (cloud fallback)")
    st.markdown(
        "Get a free token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)"
    )
    hf_token = st.text_input(
        "HuggingFace token",
        value=os.getenv("HF_TOKEN", ""),
        type="password",
    )

    if st.button("Test HuggingFace connection"):
        if not hf_token:
            st.warning("No token entered.")
        else:
            try:
                from huggingface_hub import whoami
                info = whoami(token=hf_token)
                st.success(f"Connected as **{info['name']}**.")
            except Exception as e:
                st.error(f"HuggingFace auth failed: {e}")

st.markdown("---")

# ── Preferences ───────────────────────────────────────────────────────────────
st.markdown("### 🎛 Preferences")

pref_col1, pref_col2 = st.columns(2)
with pref_col1:
    min_score = st.slider(
        "Minimum score to save",
        min_value=5.0, max_value=10.0,
        value=float(os.getenv("BEST_RESPONSE_MIN_SCORE", "7.0")),
        step=0.5,
        help="Responses must score at or above this to be eligible for saving.",
    )
with pref_col2:
    silence_s = st.slider(
        "Silence auto-stop (seconds)",
        min_value=2.0, max_value=10.0,
        value=float(os.getenv("SILENCE_THRESHOLD_SECONDS", "5.0")),
        step=0.5,
        help="How long the recorder waits in silence before automatically stopping.",
    )

st.markdown("---")

# ── Save settings ─────────────────────────────────────────────────────────────
if st.button("💾 Save Settings", type="primary"):
    try:
        env_path.touch(exist_ok=True)
        set_key(str(env_path), "TRANSCRIPTION_MODEL", new_model)
        set_key(str(env_path), "OLLAMA_BASE_URL", ollama_url)
        set_key(str(env_path), "OLLAMA_MODEL", ollama_model)
        set_key(str(env_path), "HF_TOKEN", hf_token)
        set_key(str(env_path), "BEST_RESPONSE_MIN_SCORE", str(min_score))
        set_key(str(env_path), "SILENCE_THRESHOLD_SECONDS", str(silence_s))
        st.success(
            "Settings saved to `.env`. "
            "**Restart the app** (`Ctrl+C` then `streamlit run frontend/app.py`) "
            "for model changes to take effect."
        )
    except Exception as e:
        st.error(f"Could not save settings: {e}")

st.markdown("---")

# ── Danger zone ───────────────────────────────────────────────────────────────
with st.expander("⚠️ Danger Zone"):
    st.markdown("**Clear all saved responses** — this cannot be undone.")
    try:
        count = len(load_best_responses())
        st.markdown(f"You have **{count}** saved responses.")
    except Exception:
        count = 0

    if count > 0:
        if st.button("🗑 Delete all saved responses", type="secondary"):
            _RESPONSES_FILE.write_text("[]", encoding="utf-8")
            st.success("All saved responses deleted.")
            st.rerun()

# ── System info ───────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown("### ℹ️ System Info")

import platform
info_col1, info_col2 = st.columns(2)
with info_col1:
    st.markdown(f"**Python:** `{platform.python_version()}`")
    st.markdown(f"**Platform:** `{platform.system()} {platform.release()}`")

    try:
        import streamlit
        st.markdown(f"**Streamlit:** `{streamlit.__version__}`")
    except Exception:
        pass

with info_col2:
    try:
        import faster_whisper
        st.markdown(f"**faster-whisper:** ✅ installed")
    except ImportError:
        st.markdown("**faster-whisper:** ❌ not installed — run `pip install faster-whisper`")

    try:
        import ollama
        st.markdown("**ollama (client):** ✅ installed")
    except ImportError:
        st.markdown("**ollama (client):** ❌ not installed — run `pip install ollama`")

    try:
        import audio_recorder_streamlit
        st.markdown("**audio-recorder-streamlit:** ✅ installed")
    except ImportError:
        st.markdown("**audio-recorder-streamlit:** ❌ not installed")
