#!/usr/bin/env bash
# Creates the sidecar's virtualenv and installs its pinned dependencies.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pick_python() {
  if [[ -n "${OCR_PYTHON:-}" ]]; then
    printf '%s' "$OCR_PYTHON"
    return
  fi
  # Debian's python3.11 can lack ensurepip unless python3.11-venv is installed,
  # so prefer an interpreter that can actually build a venv.
  for candidate in python3.14 python3.13 python3.12 python3.11 python3; do
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
  echo "Install python3-venv, or set OCR_PYTHON to a Python 3.11+ binary." >&2
  exit 1
fi

"$python" -m venv "$here/.venv"
"$here/.venv/bin/python" -m pip install --upgrade pip
"$here/.venv/bin/python" -m pip install -r "$here/requirements.txt"

echo "OCR sidecar ready. Start it with: npm run ocr:dev"
