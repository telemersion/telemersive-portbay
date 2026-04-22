#!/usr/bin/env bash
# Probe which codec names the active UltraGrid binary accepts.
#
# Runs `uv -c libavcodec:codec=<name>:help` for each Max-listed video codec
# and a short-spawn probe for each Max-listed audio codec, then writes a
# human-readable report to docs/ug-codecs-<version>.txt.
#
# UG parsers and codec acceptance are version-coupled (see CLAUDE.md
# "UltraGrid parsers are version-coupled"). Re-run this whenever a new UV
# build is vendored, commit the new report, and update
# VIDEO_CODEC_NAMES / AUDIO_CODEC_NAMES in
# src/main/devices/ultragrid/cliBuilder.ts if anything changed.
#
# Usage:
#   scripts/probe-uv-codecs.sh           # uses vendor/ultragrid/active
#   UG_PATH=/path/to/uv scripts/...      # explicit override
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

OUT_FILE="docs/ug-codecs-$VERSION.txt"
mkdir -p "$(dirname "$OUT_FILE")"

{
  echo "UltraGrid codec acceptance probe"
  echo "================================"
  echo "Version : $VERSION"
  echo "Binary  : $UV"
  echo "Date    : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Video codecs (Max umenu order, probed via '-c libavcodec:codec=<name>:help'):"
  # Index 0 (-none-) is skipped — it means "no -c flag" and has nothing to probe.
  # Index 1 Max-label is MJPEG, but UG rejects that literal; we probe both.
  for pair in "1:MJPEG" "1-alt:JPEG" "2:H.264" "3:H.265" "4:J2K" "5:AV1" "6:VP8" "7:VP9" "8:HFYU" "9:FFV1"; do
    idx="${pair%%:*}"
    name="${pair#*:}"
    out=$("$UV" -c "libavcodec:codec=${name}:help" 2>&1 || true)
    if echo "$out" | grep -q "Unable to find codec"; then
      echo "  [$idx] $name => REJECTED"
    else
      echo "  [$idx] $name => accepted"
    fi
  done
  echo
  echo "Audio codecs (Max umenu order, probed via short-spawn + capture-init log):"
  # Index 0 (-none-) skipped.
  for pair in "1:OPUS" "2:speex" "3:FLAC" "4:AAC" "5:MP3" "6:G.722" "7:u-law" "8:A-law" "9:PCM"; do
    idx="${pair%%:*}"
    name="${pair#*:}"
    tmp=$(mktemp)
    # Background spawn: UG binds, starts, then we kill it. 1s is plenty for
    # arg parsing + "Audio codec : <name>" / "Unable to find encoder" log line.
    ( "$UV" -s testcard --audio-codec "${name}:bitrate=64000" \
        -P 11002:11002:11004:11004 192.0.2.1 > "$tmp" 2>&1 ) &
    pid=$!
    sleep 1
    kill -KILL "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    if grep -q "Unable to find encoder for audio codec" "$tmp"; then
      echo "  [$idx] $name => REJECTED"
    elif grep -q "Audio codec" "$tmp"; then
      echo "  [$idx] $name => accepted"
    else
      echo "  [$idx] $name => UNKNOWN (no 'Audio codec' line)"
    fi
    rm -f "$tmp"
  done
} | tee "$OUT_FILE"

echo
echo "Report written to $OUT_FILE"
echo "Review, commit it, and cross-check VIDEO_CODEC_NAMES / AUDIO_CODEC_NAMES"
echo "in src/main/devices/ultragrid/cliBuilder.ts."
