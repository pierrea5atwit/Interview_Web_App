import os
from typing import Generator
from .audio import bytes_to_tempfile, cleanup_tempfile

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("TRANSCRIPTION_MODEL", "base")
        _model = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _model


def transcribe_audio(audio_bytes: bytes) -> str:
    path = bytes_to_tempfile(audio_bytes, suffix=".wav")
    try:
        model = _get_model()
        segments, _ = model.transcribe(path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        cleanup_tempfile(path)


def transcribe_audio_streaming(audio_bytes: bytes) -> Generator[str, None, None]:
    """Yields transcript text segment-by-segment for progressive display."""
    path = bytes_to_tempfile(audio_bytes, suffix=".wav")
    try:
        model = _get_model()
        segments, _ = model.transcribe(path, beam_size=5)
        for seg in segments:
            text = seg.text.strip()
            if text:
                yield text
    finally:
        cleanup_tempfile(path)
