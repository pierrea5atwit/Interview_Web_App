# Audio — Recording & Transcription

## Recording Stack
- **Browser**: `MediaRecorder` API (built-in, no npm package needed)
- **Format**: WebM/Opus (default) or WebM fallback
- **Silence auto-stop**: Web Audio API `AnalyserNode` — RMS energy threshold <5 for 5s
- **Transport**: `FormData` multipart upload to `POST /api/transcribe`

## Silence Detection (Practice.jsx — useAudioRecorder hook)
```js
analyser.fftSize = 512
const data = new Uint8Array(analyser.frequencyBinCount)
// In rAF loop:
analyser.getByteFrequencyData(data)
const rms = data.reduce((s, v) => s + v, 0) / data.length
if (rms < 5) { /* start silence timer */ }
```

## Server-side Transcription (backend/app/services/transcription.py)
- `faster-whisper` model loaded once, cached in `_model` global
- Model size: `TRANSCRIPTION_MODEL` env var (default: `base`)
- Input: raw audio bytes → written to temp file → transcribed → cleaned up
- Returns: full transcript string (non-streaming for REST API)

## Audio Format
- Client sends WebM/Opus; `faster-whisper` accepts it directly via ffmpeg
- `ffmpeg` is installed in the Docker image (`packages.txt` / apt)

## Filler Detection (backend/app/services/filler.py)
- Regex-based — no ML needed
- Returns: `total_words`, `filler_count`, `filler_rate`, `top_fillers`
