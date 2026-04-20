#!/usr/bin/env bash
# Capture golden UltraGrid CLI fixtures for parser testing.
#
# Runs each enumeration probe command against the UV version at
# vendor/ultragrid/active/, writes stdout to
# tests/fixtures/ultragrid/<version>/<backend>.txt, and auto-detects
# the version from `uv --version`.
#
# Usage:
#   scripts/capture-uv-fixtures.sh          # uses vendor/ultragrid/active
#   UG_PATH=/path/to/uv scripts/...         # explicit override
#
# Run from repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -n "${UG_PATH:-}" ]; then
  UV="$UG_PATH"
elif [ -x "vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv" ]; then
  UV="vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv"
else
  echo "error: no UltraGrid found." >&2
  echo "  install a version under vendor/ultragrid/<version>/ and symlink:" >&2
  echo "    cd vendor/ultragrid && ln -sfn <version> active" >&2
  echo "  or set UG_PATH=/full/path/to/uv" >&2
  exit 1
fi

if [ ! -x "$UV" ]; then
  echo "error: $UV is not executable" >&2
  exit 1
fi

VERSION_LINE="$("$UV" --version 2>&1 | grep -E '^UltraGrid [0-9]' | head -1 || true)"
VERSION="$(echo "$VERSION_LINE" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true)"

if [ -z "$VERSION" ]; then
  echo "error: could not parse UV version from:" >&2
  echo "  $VERSION_LINE" >&2
  exit 1
fi

OUT_DIR="tests/fixtures/ultragrid/$VERSION"
mkdir -p "$OUT_DIR"

echo "UltraGrid version: $VERSION"
echo "Fixture directory: $OUT_DIR"
echo "UV binary:         $UV"
echo

# capture <name> <args...>
capture() {
  local name="$1"; shift
  local out="$OUT_DIR/$name.txt"
  echo "capturing $name ($*)"
  # UV probes typically exit non-zero after printing help — allow that.
  "$UV" "$@" > "$out" 2>&1 || true
  local lines; lines="$(wc -l < "$out" | tr -d ' ')"
  echo "  → $out ($lines lines)"
}

capture texture-capture  -t help
capture ndi              -t ndi:help
capture syphon           -t syphon:help
capture spout            -t spout:help
capture portaudio-cap    -s portaudio:help
capture coreaudio-cap    -s coreaudio:help
capture wasapi-cap       -s wasapi:help
capture jack-cap         -s jack:help
capture portaudio-recv   -r portaudio:help
capture coreaudio-recv   -r coreaudio:help

echo
echo "done. Review the captured files, commit them, and re-run parser tests:"
echo "  git add $OUT_DIR"
echo "  npx vitest run tests/main/enumeration/parsers"
