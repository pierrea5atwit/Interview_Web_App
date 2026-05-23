import os
import tempfile


def bytes_to_tempfile(audio_bytes: bytes, suffix: str = ".wav") -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(audio_bytes)
    tmp.close()
    return tmp.name


def cleanup_tempfile(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass
