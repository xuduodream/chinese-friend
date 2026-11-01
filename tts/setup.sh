#!/usr/bin/env bash
# Creates the TTS sidecar's virtualenv, installs its pinned dependencies, and
# downloads the Kokoro ONNX model and voice pack on first run.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pick_python() {
  if [[ -n "${TTS_PYTHON:-}" ]]; then
    printf '%s' "$TTS_PYTHON"
    return
  fi
  # Prefer interpreters that onnxruntime publishes wheels for.
  for candidate in python3.12 python3.11 python3.13 python3.14 python3; do
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c 'import venv, ensurepip' >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return
    fi
  done
}

python="$(pick_python)"
if [[ -z "$python" ]]; then
  echo "No Python interpreter with venv support found." >&2
  echo "Install python3-venv, or set TTS_PYTHON to a Python 3.11+ binary." >&2
  exit 1
fi

if [[ ! -x "$here/.venv/bin/python" ]]; then
  "$python" -m venv "$here/.venv"
fi
"$here/.venv/bin/python" -m pip install --upgrade pip
"$here/.venv/bin/python" -m pip install -r "$here/requirements.txt"

model_dir="${TTS_MODEL_DIR:-$here/models}"
mirror_base="${KOKORO_MIRROR_BASE_URL:-https://hf-mirror.com/zijuncheng/kokoro_model_v1.0/resolve/main}"
github_base="${KOKORO_MODEL_BASE_URL:-https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1}"

mkdir -p "$model_dir"

download() {
  local dest="$1"
  shift
  local name url
  name="$(basename "$dest")"
  if [[ -s "$dest" ]]; then
    echo "Using existing $name"
    return
  fi
  for url in "$@"; do
    echo "Downloading $name from $url"
    rm -f "$dest.part"
    if "$here/.venv/bin/python" "$here/download.py" "$url" "$dest"; then
      return
    fi
    echo "Download failed; trying another source." >&2
  done
  echo "Could not download $name." >&2
  echo "Set KOKORO_MODEL_URL / KOKORO_VOICES_URL to a reachable source and retry." >&2
  exit 1
}

if [[ -n "${KOKORO_MODEL_URL:-}" ]]; then
  model_sources=("$KOKORO_MODEL_URL")
else
  model_sources=("$mirror_base/kokoro-v1.0.onnx" "$github_base/kokoro-v1.0.onnx")
fi
if [[ -n "${KOKORO_VOICES_URL:-}" ]]; then
  voices_sources=("$KOKORO_VOICES_URL")
else
  voices_sources=("$mirror_base/voices-v1.0.bin" "$github_base/voices-v1.0.bin")
fi

download "$model_dir/kokoro-v1.0.onnx" "${model_sources[@]}"
download "$model_dir/voices-v1.0.bin" "${voices_sources[@]}"

echo "TTS sidecar ready. Start it with: npm run tts:dev"
