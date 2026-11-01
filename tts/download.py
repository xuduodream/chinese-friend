"""Parallel ranged downloader used by ``tts/setup.sh``.

Model files are large and some networks throttle a single connection hard. This
fetches fixed-size ranges over several connections, writes them at their offsets
with ``os.pwrite``, and falls back to one stream when the server ignores Range.
"""

from __future__ import annotations

import concurrent.futures
import os
import shutil
import sys
import time
import urllib.request

CHUNK_BYTES = 8 * 1024 * 1024
WORKERS = max(1, min(16, int(os.environ.get("KOKORO_DOWNLOAD_WORKERS", "8"))))
ATTEMPTS = 3
TIMEOUT_SECONDS = 120


def probe(url: str) -> tuple[int, bool]:
    """Returns (total_bytes, supports_ranges) without downloading the body."""
    request = urllib.request.Request(url, headers={"Range": "bytes=0-0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status == 206:
            content_range = response.headers.get("Content-Range", "")
            total = content_range.rsplit("/", 1)[-1]
            if total.isdigit():
                return int(total), True
        length = response.headers.get("Content-Length")
        if length is not None:
            return int(length), False
    raise RuntimeError("the server did not report a file size")


def fetch(url: str, start: int, end: int) -> bytes:
    expected = end - start + 1
    last_error: Exception | None = None
    for attempt in range(ATTEMPTS):
        try:
            request = urllib.request.Request(
                url, headers={"Range": f"bytes={start}-{end}"}
            )
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                if response.status != 206:
                    raise RuntimeError(f"expected 206, got {response.status}")
                data = response.read()
            if len(data) != expected:
                raise RuntimeError(f"got {len(data)} of {expected} bytes")
            return data
        except Exception as exc:  # noqa: BLE001 - retry transient failures
            last_error = exc
            time.sleep(1 + attempt)
    raise RuntimeError(f"range {start}-{end} failed: {last_error}")


def download_parallel(url: str, dest: str, total: int) -> None:
    ranges = [(start, min(start + CHUNK_BYTES - 1, total - 1)) for start in range(0, total, CHUNK_BYTES)]
    part = f"{dest}.part"
    fd = os.open(part, os.O_CREAT | os.O_RDWR | os.O_TRUNC, 0o644)
    completed = 0
    started = time.time()
    last_report = 0.0
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [
                pool.submit(lambda s=start, e=end: (s, fetch(url, s, e)))
                for start, end in ranges
            ]
            for future in concurrent.futures.as_completed(futures):
                start, data = future.result()
                # Ranges are aligned to their file offsets, so a positional
                # write is safe from several threads at once.
                os.pwrite(fd, data, start)
                completed += len(data)
                now = time.time()
                if now - last_report >= 2 or completed == total:
                    rate = completed / max(now - started, 0.001) / 1024
                    print(
                        f"  {completed * 100 / total:5.1f}% ({rate:.0f} KiB/s)",
                        flush=True,
                    )
                    last_report = now
        os.ftruncate(fd, total)
    finally:
        os.close(fd)
    if os.path.getsize(part) != total:
        raise RuntimeError("the downloaded file is incomplete")
    os.replace(part, dest)


def download_single(url: str, dest: str) -> None:
    part = f"{dest}.part"
    with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response, open(part, "wb") as out:
        shutil.copyfileobj(response, out)
    os.replace(part, dest)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: download.py URL DEST", file=sys.stderr)
        return 2
    url, dest = sys.argv[1], sys.argv[2]
    try:
        total, supports_ranges = probe(url)
        size = total / (1024 * 1024)
        if supports_ranges:
            chunks = (total + CHUNK_BYTES - 1) // CHUNK_BYTES
            print(f"Downloading {os.path.basename(dest)} ({size:.1f} MiB, {chunks} chunks)", flush=True)
            download_parallel(url, dest, total)
        else:
            print(f"Downloading {os.path.basename(dest)} ({size:.1f} MiB, single stream)", flush=True)
            download_single(url, dest)
        return 0
    except Exception as exc:  # noqa: BLE001 - setup script reports the failure
        print(f"download failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
