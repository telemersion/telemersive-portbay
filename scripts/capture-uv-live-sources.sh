#!/usr/bin/env bash
# Capture UltraGrid fixtures that contain *live* Syphon and NDI sources.
#
# capture-uv-fixtures.sh only sees whatever happens to run on the machine.
# This script makes its own sources: it starts testcard senders feeding two
# receiver instances that publish a named Syphon server ("UGFixtureSyphon")
# and a named NDI source ("UGFixtureNDI"), then probes with
# `-t syphon:help` / `-t ndi:help` and writes
# tests/fixtures/ultragrid/<version>/{syphon,ndi}-live.txt.
#
# macOS only (Syphon). Uses vendor/ultragrid/active or $UG_PATH. Run from repo root.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

UV="${UG_PATH:-vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv}"
[ -x "$UV" ] || { echo "error: $UV not executable (set UG_PATH)" >&2; exit 1; }

VERSION="$("$UV" --version 2>&1 | grep -E '^UltraGrid [0-9]' | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
[ -n "$VERSION" ] || { echo "error: cannot parse UV version" >&2; exit 1; }
OUT_DIR="tests/fixtures/ultragrid/$VERSION"
mkdir -p "$OUT_DIR"

PIDS=()
cleanup() {
  kill -INT "${PIDS[@]}" 2>/dev/null || true
  sleep 1
  kill -KILL "${PIDS[@]}" 2>/dev/null || true
}
trap cleanup EXIT

PORTS_SY=12100:12100:12102:12102
PORTS_NDI=12200:12200:12202:12202
"$UV" -d syphon:name=UGFixtureSyphon -P "$PORTS_SY"  >/dev/null 2>&1 & PIDS+=($!)
"$UV" -d ndi:name=UGFixtureNDI       -P "$PORTS_NDI" >/dev/null 2>&1 & PIDS+=($!)
sleep 3
for p in "$PORTS_SY" "$PORTS_NDI"; do
  "$UV" -t testcard:1280:720:30:UYVY -c libavcodec:codec=JPEG -P "$p" 127.0.0.1 >/dev/null 2>&1 & PIDS+=($!)
done
sleep 8

"$UV" -t syphon:help > "$OUT_DIR/syphon-live.txt" 2>&1 || true
"$UV" -t ndi:help    > "$OUT_DIR/ndi-live.txt"    2>&1 || true

grep -q UGFixtureSyphon "$OUT_DIR/syphon-live.txt" || { echo "error: Syphon server not listed" >&2; exit 1; }
grep -q UGFixtureNDI    "$OUT_DIR/ndi-live.txt"    || { echo "error: NDI source not listed" >&2; exit 1; }
echo "wrote $OUT_DIR/syphon-live.txt and $OUT_DIR/ndi-live.txt"
