#!/usr/bin/env bash
# Starts the local Kokoro TTS sidecar on 127.0.0.1:$TTS_PORT (default 7862).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -x "$here/.venv/bin/python" ]]; then
  echo "The TTS sidecar is not set up yet. Run: npm run tts:setup" >&2
  exit 1
fi

exec "$here/.venv/bin/python" "$here/server.py"
