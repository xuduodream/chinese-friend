"""Local OCR and pinyin sidecar.

RapidOCR (ONNX Runtime) reads the Chinese text; pypinyin plus jieba produce the
display pinyin and the numbered reading used for speech. The Express server
calls this over localhost, so screenshots never reach a third-party provider.
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import cv2
import numpy as np
from pypinyin import Style, lazy_pinyin
from rapidocr import RapidOCR

MAX_BODY_BYTES = 12 * 1024 * 1024
MAX_TEXT_LENGTH = 2000
CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
SPACE_BEFORE_PUNCTUATION = re.compile(r"\s+([，。！？、；：,.!?;:）)」』】》])")

engine = RapidOCR()
engine_lock = threading.Lock()


def tidy(parts: list[str]) -> str:
    """Joins pinyin syllables without a space before punctuation."""
    joined = re.sub(r"\s+", " ", " ".join(parts)).strip()
    return SPACE_BEFORE_PUNCTUATION.sub(r"\1", joined)


def pinyin_for(text: str) -> dict[str, str]:
    """Tone-marked pinyin for display and numbered pinyin for TTS."""
    plain = text.replace("\n", " ").strip()
    if not plain:
        return {"pinyin": "", "reading": ""}
    tone_marked = tidy(lazy_pinyin(plain, style=Style.TONE))
    numbered = tidy(lazy_pinyin(plain, style=Style.TONE3, neutral_tone_with_five=True))
    return {"pinyin": tone_marked, "reading": numbered}


def recognize(image_b64: str) -> dict[str, Any]:
    try:
        raw = base64.b64decode(image_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image is not valid base64") from exc
    if not raw:
        raise ValueError("image is empty")

    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("image could not be decoded")

    with engine_lock:
        result = engine(frame)

    texts = getattr(result, "txts", None) or []
    scores = getattr(result, "scores", None) or []

    lines: list[dict[str, Any]] = []
    for index, text in enumerate(texts):
        cleaned = text.strip()
        if not cleaned or not CJK.search(cleaned):
            continue
        score = float(scores[index]) if index < len(scores) else 0.0
        lines.append({"text": cleaned, "score": round(score, 4)})

    chinese = "\n".join(line["text"] for line in lines)
    spoken = pinyin_for(chinese)
    return {
        "chinese": chinese,
        "pinyin": spoken["pinyin"],
        "reading": spoken["reading"],
        "lines": lines,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "chinese-friend-ocr/1.0"

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, code: str, message: str) -> None:
        self.send_json(status, {"error": {"code": code, "message": message}})

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        if self.path == "/health":
            self.send_json(200, {"ok": True})
        else:
            self.send_error_json(404, "NOT_FOUND", "Unknown path.")

    def do_POST(self) -> None:  # noqa: N802 - http.server API
        if self.path not in ("/ocr", "/pinyin"):
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

        try:
            if self.path == "/ocr":
                image = payload.get("image")
                if not isinstance(image, str) or not image:
                    raise ValueError("image is required")
                self.send_json(200, recognize(image))
            else:
                text = payload.get("text")
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("text is required")
                if len(text) > MAX_TEXT_LENGTH:
                    raise ValueError("text is too long")
                self.send_json(200, pinyin_for(text))
        except ValueError as exc:
            self.send_error_json(400, "INVALID_REQUEST", str(exc))
        except Exception as exc:  # noqa: BLE001 - report, keep serving
            self.send_error_json(500, "OCR_FAILED", str(exc))

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        print(f"{self.address_string()} {format % args}", flush=True)


def warm_up() -> None:
    """Loads the detection and recognition models before the first request."""
    blank = np.full((32, 32, 3), 255, dtype=np.uint8)
    with engine_lock:
        engine(blank)


def main() -> None:
    host = os.environ.get("OCR_HOST", "127.0.0.1")
    port = int(os.environ.get("OCR_PORT", "7861"))
    warm_up()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Chinese Friend OCR listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
