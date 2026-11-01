"""Local Kokoro text-to-speech sidecar.

Kokoro-82M runs on ONNX Runtime. Cards store syllable-separated, numbered
pinyin (``yin2 hang2``); misaki converts each syllable to IPA and Kokoro
synthesizes from those phonemes, so polyphonic characters are spoken exactly
as the card's reading says. When the reading is missing or unusable, the
sidecar falls back to Kokoro's Chinese text front end.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import numpy as np
from kokoro_onnx import Kokoro
from misaki import zh

HERE = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = HERE / "models"
MODEL_FILE = "kokoro-v1.0.onnx"
VOICES_FILE = "voices-v1.0.bin"

MAX_BODY_BYTES = 64 * 1024
MAX_TEXT_LENGTH = 1000
MAX_READING_LENGTH = 1000
SAMPLE_RATE = 24_000

# Kokoro's tokenizer only knows a small ASCII punctuation set, so Chinese
# punctuation is mapped before the reading is converted to phonemes.
PUNCTUATION = str.maketrans(
    {
        "，": ",",
        "。": ".",
        "！": "!",
        "？": "?",
        "、": ",",
        "；": ";",
        "：": ":",
        "…": ".",
        "—": "-",
        "－": "-",
        "（": "(",
        "）": ")",
        "「": "",
        "」": "",
        "『": "",
        "』": "",
        "“": "",
        "”": "",
        "‘": "",
        "’": "",
    }
)
SYLLABLE = re.compile(r"^([A-Za-z]+[0-5]?)([.,!?;:()\-]*)$")

engine: Kokoro | None = None
g2p: zh.ZHG2P | None = None
engine_lock = threading.Lock()

voice_name = os.environ.get("TTS_VOICE", "zf_xiaoxiao")
try:
    speed = min(2.0, max(0.5, float(os.environ.get("TTS_SPEED", "1"))))
except ValueError:
    speed = 1.0


def reading_to_phonemes(reading: str) -> str:
    """Converts syllable-separated, numbered pinyin to Kokoro IPA phonemes."""
    text = reading.translate(PUNCTUATION).strip()
    if not text:
        return ""
    if not re.search(r"[0-5]", text):
        raise ValueError("the reading has no tone numbers")

    parts: list[str] = []
    for token in text.split():
        if re.fullmatch(r"[.,!?;:()\-]+", token):
            parts.append(token)
            continue
        match = SYLLABLE.fullmatch(token)
        if not match:
            raise ValueError(f"not a pinyin syllable: {token!r}")
        syllable, punctuation = match.groups()
        if not re.search(r"[0-5]$", syllable):
            raise ValueError(f"the syllable has no tone number: {syllable!r}")
        parts.append(zh.ZHG2P.py2ipa(syllable.lower()))
        if punctuation:
            parts.append(punctuation)
    return " ".join(parts)


def phonemes_for(chinese: str, reading: str) -> str:
    """Prefers the stored reading; falls back to text G2P when it is unusable."""
    if reading.strip():
        try:
            return reading_to_phonemes(reading)
        except ValueError as exc:
            print(f"Falling back to text G2P: {exc}", flush=True)
    if g2p is None:
        raise RuntimeError("the Kokoro front end is not loaded")
    return g2p(chinese)


def wav_bytes(samples: np.ndarray, rate: int) -> bytes:
    """Packs Kokoro's float samples into a mono 16-bit WAV file."""
    pcm = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm.tobytes())
    return buffer.getvalue()


def synthesize(chinese: str, reading: str) -> bytes:
    if engine is None:
        raise RuntimeError("the Kokoro engine is not loaded")
    phonemes = phonemes_for(chinese, reading)
    if not phonemes.strip():
        raise ValueError("there was nothing to speak")
    with engine_lock:
        samples, rate = engine.create(
            phonemes, voice_name, speed=speed, is_phonemes=True
        )
    return wav_bytes(samples, rate)


class Handler(BaseHTTPRequestHandler):
    server_version = "chinese-friend-tts/1.0"

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, code: str, message: str) -> None:
        self.send_json(status, {"error": {"code": code, "message": message}})

    def send_audio(self, audio: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        if self.path == "/health":
            self.send_json(
                200,
                {"ok": True, "voice": voice_name, "sampleRate": SAMPLE_RATE},
            )
        else:
            self.send_error_json(404, "NOT_FOUND", "Unknown path.")

    def do_POST(self) -> None:  # noqa: N802 - http.server API
        if self.path != "/tts":
            self.send_error_json(404, "NOT_FOUND", "Unknown path.")
            return

        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("application/json"):
            self.send_error_json(415, "UNSUPPORTED_CONTENT_TYPE", "Send application/json.")
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self.send_error_json(400, "INVALID_REQUEST", "The request body is empty.")
            return
        if length > MAX_BODY_BYTES:
            self.send_error_json(413, "REQUEST_TOO_LARGE", "The request body is too large.")
            return

        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self.send_error_json(400, "INVALID_JSON", "The request body is not valid JSON.")
            return
        if not isinstance(payload, dict):
            self.send_error_json(400, "INVALID_REQUEST", "The request body must be an object.")
            return

        chinese = payload.get("chinese")
        reading = payload.get("reading", "")
        if not isinstance(chinese, str) or not chinese.strip():
            self.send_error_json(400, "INVALID_REQUEST", "chinese is required")
            return
        if len(chinese) > MAX_TEXT_LENGTH:
            self.send_error_json(400, "INVALID_REQUEST", "chinese is too long")
            return
        if not isinstance(reading, str) or len(reading) > MAX_READING_LENGTH:
            self.send_error_json(400, "INVALID_REQUEST", "reading must be a string")
            return

        try:
            self.send_audio(synthesize(chinese, reading))
        except ValueError as exc:
            self.send_error_json(400, "INVALID_REQUEST", str(exc))
        except Exception as exc:  # noqa: BLE001 - report, keep serving
            self.send_error_json(500, "TTS_FAILED", str(exc))

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        print(f"{self.address_string()} {format % args}", flush=True)


def load_engine() -> None:
    global engine, g2p

    model_dir = Path(os.environ.get("TTS_MODEL_DIR", str(DEFAULT_MODEL_DIR)))
    model_path = model_dir / MODEL_FILE
    voices_path = model_dir / VOICES_FILE
    missing = [path.name for path in (model_path, voices_path) if not path.exists()]
    if missing:
        print(
            f"Kokoro model files are missing from {model_dir}: {', '.join(missing)}",
            file=sys.stderr,
        )
        print("Run: npm run tts:setup", file=sys.stderr)
        raise SystemExit(1)

    engine = Kokoro(str(model_path), str(voices_path))
    # Depending on the release, np.load returns either a structured array or an
    # NpzFile; both expose their voice ids differently.
    voices = engine.voices
    if hasattr(voices, "files"):
        available = sorted(voices.files)
    else:
        available = sorted(voices.dtype.names or [])
    if voice_name not in available:
        chinese = [name for name in available if name.startswith(("zf_", "zm_"))]
        print(
            f"Voice {voice_name!r} is not in {VOICES_FILE}. "
            f"Chinese voices: {', '.join(chinese)}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    g2p = zh.ZHG2P()
    print(
        f"Kokoro loaded: voice={voice_name} speed={speed} sampleRate={SAMPLE_RATE}",
        flush=True,
    )


def main() -> None:
    host = os.environ.get("TTS_HOST", "127.0.0.1")
    port = int(os.environ.get("TTS_PORT", "7862"))
    load_engine()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Chinese Friend TTS listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
