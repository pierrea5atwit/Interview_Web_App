# Audio — Recording & Transcription

## Recording Stack
**Package:** `audio-recorder-streamlit` (PyPI: `audio-recorder-streamlit`)

```python
from audio_recorder_streamlit import audio_recorder

audio_bytes = audio_recorder(
    text="Click to record",
    recording_color="#e74c3c",
    neutral_color="#3498db",
    icon_size="3x",
    pause_threshold=5.0,   # seconds of silence → auto-stop
    sample_rate=41_000,
)
```

Returns `bytes | None`. `None` = no recording yet. On silence for `pause_threshold` seconds, recording stops automatically. User can also click to stop manually.

## Transcription Stack
**Package:** `faster-whisper` — local Whisper inference, **no OpenAI API call**.

```python
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio_path, beam_size=5)
for segment in segments:
    yield segment.text   # use this for progressive display in st.empty()
```

Model sizes (tradeoff: speed vs accuracy):
| Model | Size | Speed (CPU) | Accuracy |
|-------|------|-------------|---------|
| `tiny` | 75 MB | ~2s | OK |
| `base` | 145 MB | ~5s | Good (default) |
| `small` | 465 MB | ~15s | Better |
| `medium` | 1.5 GB | ~45s | Best local |

Model is loaded once at `backend/app/services/transcription.py` module level and cached. Do not reload per request.

## Audio Format Handling
`audio-recorder-streamlit` returns WAV bytes. `faster-whisper` accepts WAV, MP3, OGG, and FLAC via temp file.

Conversion flow (in `backend/app/services/audio.py`):
```python
import tempfile, os

def bytes_to_tempfile(audio_bytes: bytes, suffix=".wav") -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(audio_bytes)
    tmp.close()
    return tmp.name
```

Always `os.unlink(path)` the temp file after transcription.

## Silence Detection
`pause_threshold=5.0` in `audio_recorder()` handles this at the browser level via Web Audio API analysis inside the `audio-recorder-streamlit` JS bundle.

Backend VAD (optional, for post-processing):
- `webrtcvad` — frame-based VAD (10/20/30 ms frames), aggressiveness 0–3
- `silero-vad` via `torch` — neural VAD, more accurate, heavier dependency
- For MVP1.5 use the browser-side `pause_threshold` only.

## Progressive Transcript Display Pattern
```python
placeholder = st.empty()
transcript = ""
for segment in model.transcribe(path)[0]:
    transcript += segment.text + " "
    placeholder.markdown(f"> {transcript.strip()}")
```

## Alternatives Considered
| Tool | Why not used |
|------|-------------|
| OpenAI Whisper API | Cloud dependency, cost, user asked to avoid |
| AssemblyAI | Requires API key, cloud upload |
| SpeechRecognition (Google STT) | Cloud, privacy concerns |
| Vosk | Good offline, but lower accuracy than Whisper |
| streamlit-webrtc | Requires STUN server, complex setup for self-hosted |

## Future: Real-Time Streaming Transcript
For true word-by-word live transcription, replace `audio-recorder-streamlit` with `streamlit-webrtc` + server-side VAD. This requires:
1. STUN/TURN server config (or local-network-only)
2. Audio frame accumulation + chunk transcription
3. WebSocket state updates via `st.session_state`

Not in scope for MVP1.5.
