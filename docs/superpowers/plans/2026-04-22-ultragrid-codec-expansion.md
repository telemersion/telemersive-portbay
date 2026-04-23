# UltraGrid Codec Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the UltraGrid device panel's codec dropdowns to the full Max patcher 0–9 index table (10 video, 10 audio), extend `cliBuilder` to translate all indices, and add a `probe-uv-codecs.sh` script that validates each codec name against the vendored `uv` binary.

**Architecture:** Two codec-name maps (one per media type) are the single source of truth, consumed by both the CLI builder (for argv) and the Vue template (for the `<option>` list, if we choose). The builder's mapping functions become table lookups that throw on unsupported indices. Tests cover every index individually plus failure modes (speex, codec=0). A shell probe script re-validates the mapping against live `uv` on every UG upgrade.

**Tech Stack:** TypeScript (main + renderer), Vue 3 SFC, vitest, bash.

---

## File Structure

**Modified files:**

- [src/main/devices/ultragrid/cliBuilder.ts](../../../src/main/devices/ultragrid/cliBuilder.ts) — replace `videoCodecName()` and `audioCodecName()` lookup functions (lines 144–152) with full 10-entry maps; teach callers to skip the `-c` / `--audio-codec` flag when codec === `'0'`.
- [tests/main/devices/ultragrid/cliBuilder.test.ts](../../../tests/main/devices/ultragrid/cliBuilder.test.ts) — add a new `describe` block with per-index cases plus omit/throw cases.
- [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — replace the two inline `<option>` lists at lines 453–454 (video) and 632 (audio) with full 0–9 option lists.

**New files:**

- `scripts/probe-uv-codecs.sh` — shell probe modelled on [scripts/capture-uv-fixtures.sh](../../../scripts/capture-uv-fixtures.sh). For each Max-listed codec name, runs `uv` and records accept/reject. Writes `docs/ug-codecs-<version>.txt` alongside the fixtures.
- `tests/main/devices/ultragrid/codecAcceptance.integration.test.ts` — spawns live `uv` (when `vendor/ultragrid/active` or `UG_PATH` is available) and asserts every "accepted" codec in our mapping is still accepted by UG. Gated the same way as `uvArgvParsing.integration.test.ts`.

**Out of scope (per spec):** PRORES variants; encoder-level selection; samplerate/bitrate range validation; upstream Max MJPEG fix; the `-none-` (codec=0) option for video over network.

---

## Task 1: Extract codec maps as module-level constants with explicit index keys

**Files:**
- Modify: [src/main/devices/ultragrid/cliBuilder.ts:144-153](../../../src/main/devices/ultragrid/cliBuilder.ts#L144-L153)

Rationale: replace the conditional `if` chains with lookup tables before expanding them. No behavior change. This isolates the upcoming expansion to a data edit.

- [ ] **Step 1: Read the current file to confirm the starting state**

Run: `grep -n "videoCodecName\|audioCodecName" src/main/devices/ultragrid/cliBuilder.ts`
Expected output (exactly):
```
128:  args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
140:  args.push('--audio-codec', `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`)
144:function videoCodecName(codec: string): string {
145:  if (codec === '2') return 'H.264'
146:  if (codec === '1') return 'JPEG'
147:  throw new Error(`unsupported video codec id: ${codec}`)
148:}
150:function audioCodecName(codec: string): string {
151:  if (codec === '1') return 'OPUS'
152:  throw new Error(`unsupported audio codec id: ${codec}`)
153:}
```

- [ ] **Step 2: Replace the two mapping functions with table-driven lookups (behavior-preserving refactor)**

Replace lines 144–153 with:

```typescript
// Video codec umenu from Max tg.deviceUG_view.maxpat (line 22391).
// Index 0 (-none-) and index 1 (MJPEG in Max) are deliberately absent here:
//   - index 0 means "no -c flag at all" — handled by the caller, not this map
//   - index 1 Max-label is MJPEG but UG 1.10.3 rejects that literal; UG accepts
//     "JPEG" instead. Max has shipped this broken for years; we map to JPEG.
const VIDEO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'JPEG',
  '2': 'H.264'
}

// Audio codec umenu from Max tg.deviceUG_view.maxpat (line 12555).
// Index 0 means "no --audio-codec flag" — handled by caller.
const AUDIO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'OPUS'
}

function videoCodecName(codec: string): string {
  const name = VIDEO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported video codec id: ${codec}`)
  return name
}

function audioCodecName(codec: string): string {
  const name = AUDIO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported audio codec id: ${codec}`)
  return name
}
```

- [ ] **Step 3: Run the existing cliBuilder tests to confirm no regression**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all existing tests pass (same count as before — should be >15).

- [ ] **Step 4: Commit**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts
git commit -m "ug-cli: refactor codec name resolution to table-driven lookups"
```

---

## Task 2: Add failing tests for all 10 video codec indices

**Files:**
- Modify: [tests/main/devices/ultragrid/cliBuilder.test.ts](../../../tests/main/devices/ultragrid/cliBuilder.test.ts) — append a new `describe` block at the end of the file.

- [ ] **Step 1: Read the test file to locate the end and existing patterns**

Run: `tail -30 tests/main/devices/ultragrid/cliBuilder.test.ts`
Note the closing `})` of the last `describe`. The new block goes after it.

- [ ] **Step 2: Append the failing describe block**

At the very end of `tests/main/devices/ultragrid/cliBuilder.test.ts`, **after the last `})` that closes the final existing describe**, append:

```typescript
describe('buildUvArgs — video codec table', () => {
  function buildMode1VideoOnly(videoCodecIndex: string): string[] {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/advanced/compress/codec',
      videoCodecIndex
    )
    const ports = allocateUgPorts(11, 0)
    return buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
  }

  it.each([
    ['1', 'JPEG'],    // Max label "MJPEG" → UG-accepted "JPEG"
    ['2', 'H.264'],
    ['3', 'H.265'],
    ['4', 'J2K'],
    ['5', 'AV1'],
    ['6', 'VP8'],
    ['7', 'VP9'],
    ['8', 'HFYU'],
    ['9', 'FFV1']
  ])('codec index %s → libavcodec:codec=%s:bitrate=10M', (idx, name) => {
    const args = buildMode1VideoOnly(idx)
    expect(args).toContain('-c')
    const cIndex = args.indexOf('-c')
    expect(args[cIndex + 1]).toBe(`libavcodec:codec=${name}:bitrate=10M`)
  })

  it('codec index 0 (-none-) omits the -c flag entirely', () => {
    const args = buildMode1VideoOnly('0')
    expect(args).not.toContain('-c')
  })

  it('unknown codec index throws a descriptive error', () => {
    expect(() => buildMode1VideoOnly('42')).toThrow(/unsupported video codec id: 42/)
  })
})

describe('buildUvArgs — audio codec table', () => {
  function buildMode1AudioOnly(audioCodecIndex: string): string[] {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '1')
    config = applyTopicChange(
      config,
      'audioVideo/audioCapture/advanced/compress/codec',
      audioCodecIndex
    )
    const ports = allocateUgPorts(11, 0)
    return buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: null,
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
  }

  it.each([
    ['1', 'OPUS'],
    ['3', 'FLAC'],
    ['4', 'AAC'],
    ['5', 'MP3'],
    ['6', 'G.722'],
    ['7', 'u-law'],
    ['8', 'A-law'],
    ['9', 'PCM']
  ])('codec index %s → --audio-codec %s:bitrate=64000', (idx, name) => {
    const args = buildMode1AudioOnly(idx)
    expect(args).toContain('--audio-codec')
    const cIndex = args.indexOf('--audio-codec')
    expect(args[cIndex + 1]).toBe(`${name}:bitrate=64000`)
  })

  it('codec index 0 (-none-) omits the --audio-codec flag entirely', () => {
    const args = buildMode1AudioOnly('0')
    expect(args).not.toContain('--audio-codec')
  })

  it('codec index 2 (speex) throws because UG 1.10.3 cannot encode it', () => {
    expect(() => buildMode1AudioOnly('2')).toThrow(/speex/)
  })

  it('unknown audio codec index throws a descriptive error', () => {
    expect(() => buildMode1AudioOnly('99')).toThrow(/unsupported audio codec id: 99/)
  })
})
```

- [ ] **Step 3: Run the new tests and verify most fail (TDD red phase)**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: several failures. Specifically:
- Video indices 3–9: fail with `unsupported video codec id: …` (these aren't in the map yet).
- Video index 0: fails because current code calls `videoCodecName('0')` which throws, rather than skipping the `-c` flag.
- Audio indices 3–9: fail with `unsupported audio codec id: …`.
- Audio index 0: fails for the same reason as video index 0.
- Audio index 2 (speex): currently would throw `unsupported audio codec id: 2` — not the speex-specific message the test expects.
- Video indices 1, 2 and audio index 1 should already pass (existing mappings).
- The "unknown codec" cases (`42` / `99`) should already pass.

This is the expected TDD red state before Task 3.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/main/devices/ultragrid/cliBuilder.test.ts
git commit -m "ug-cli: add failing tests for full codec index tables"
```

---

## Task 3: Expand the video codec map and skip -c when index=0

**Files:**
- Modify: [src/main/devices/ultragrid/cliBuilder.ts](../../../src/main/devices/ultragrid/cliBuilder.ts) — `VIDEO_CODEC_NAMES` (added in Task 1), `pushVideoCapture()` body.

- [ ] **Step 1: Replace the `VIDEO_CODEC_NAMES` constant with the full 9-entry map**

In [src/main/devices/ultragrid/cliBuilder.ts](../../../src/main/devices/ultragrid/cliBuilder.ts), replace the existing `VIDEO_CODEC_NAMES` block with:

```typescript
// Video codec umenu from Max tg.deviceUG_view.maxpat (line 22391).
// Index 0 (-none-) is deliberately absent here: it means "no -c flag at all",
// which is handled by the caller (see pushVideoCapture).
// Index 1 Max-label is MJPEG but UG 1.10.3 rejects that literal; UG accepts
// "JPEG" instead. Max has shipped this broken for years; we map to JPEG.
// Codec name acceptance re-verified with scripts/probe-uv-codecs.sh — see
// docs/ug-codecs-<version>.txt for the live probe output.
const VIDEO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'JPEG',
  '2': 'H.264',
  '3': 'H.265',
  '4': 'J2K',
  '5': 'AV1',
  '6': 'VP8',
  '7': 'VP9',
  '8': 'HFYU',
  '9': 'FFV1'
}
```

- [ ] **Step 2: Teach `pushVideoCapture()` to skip the `-c` flag when codec is `'0'`**

In the same file, find the `pushVideoCapture` function (currently around line 105–129). Its last two lines are:

```typescript
  const { codec, bitrate } = config.audioVideo.videoCapture.advanced.compress
  args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
```

Replace with:

```typescript
  const { codec, bitrate } = config.audioVideo.videoCapture.advanced.compress
  if (codec !== '0') {
    args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
  }
```

- [ ] **Step 3: Run the video codec tests and verify they pass**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts -t "video codec table"`
Expected: all 11 cases pass (9 parametric indices + `codec index 0` + `unknown codec index`).

- [ ] **Step 4: Commit**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts
git commit -m "ug-cli: expand video codec table to full Max umenu (indices 1-9) + skip -c on index 0"
```

---

## Task 4: Expand the audio codec map with a speex-specific error

**Files:**
- Modify: [src/main/devices/ultragrid/cliBuilder.ts](../../../src/main/devices/ultragrid/cliBuilder.ts) — `AUDIO_CODEC_NAMES` (added in Task 1), `audioCodecName()`, `pushAudioCapture()`.

- [ ] **Step 1: Replace `AUDIO_CODEC_NAMES` with the full map (minus speex)**

Replace the existing `AUDIO_CODEC_NAMES` block with:

```typescript
// Audio codec umenu from Max tg.deviceUG_view.maxpat (line 12555).
// Index 0 (-none-) means "no --audio-codec flag" — handled by caller.
// Index 2 (speex) is intentionally absent: UG 1.10.3 lists speex as
// "unavailable" — a spawn with --audio-codec speex fails at runtime with
// "Unable to find encoder for audio codec 'speex'". We throw in audioCodecName
// rather than letting that reach the user via a spawn crash.
const AUDIO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'OPUS',
  '3': 'FLAC',
  '4': 'AAC',
  '5': 'MP3',
  '6': 'G.722',
  '7': 'u-law',
  '8': 'A-law',
  '9': 'PCM'
}
```

- [ ] **Step 2: Update `audioCodecName()` to surface the speex-specific error**

Replace the current `audioCodecName` function with:

```typescript
function audioCodecName(codec: string): string {
  if (codec === '2') {
    throw new Error('audio codec index 2 (speex) is unavailable in UG 1.10.3')
  }
  const name = AUDIO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported audio codec id: ${codec}`)
  return name
}
```

- [ ] **Step 3: Teach `pushAudioCapture()` to skip `--audio-codec` when codec is `'0'`**

Find `pushAudioCapture` (around line 131–142). Its last two lines currently are:

```typescript
  const audio = config.audioVideo.audioCapture.advanced
  args.push('--audio-codec', `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`)
  args.push('--audio-capture-format', `channels=${audio.channels.channels}`)
```

Replace with:

```typescript
  const audio = config.audioVideo.audioCapture.advanced
  if (audio.compress.codec !== '0') {
    args.push('--audio-codec', `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`)
  }
  args.push('--audio-capture-format', `channels=${audio.channels.channels}`)
```

(The `--audio-capture-format` flag stays regardless — it configures channel layout, not codec.)

- [ ] **Step 4: Run the audio codec tests and verify they pass**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts -t "audio codec table"`
Expected: all 11 cases pass (8 parametric indices + `codec index 0` + `codec index 2` speex + `unknown audio codec`).

- [ ] **Step 5: Run the full cliBuilder test file for a regression sweep**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all tests pass — the pre-existing mode 1 / mode 4 / gating cases should not be affected.

- [ ] **Step 6: Commit**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts
git commit -m "ug-cli: expand audio codec table to full Max umenu + reject speex + skip flag on index 0"
```

---

## Task 5: Expand the Vue codec dropdowns to the full 0–9 lists

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — video codec `<select>` (line 448–456 currently), audio codec `<select>` (line 626–634 currently).

- [ ] **Step 1: Verify the current `<option>` lines**

Run: `grep -n '<option value="[0-9]">' src/renderer/components/panels/UltraGridPanel.vue`
Expected:
```
453:              <option value="2">H.264</option>
454:              <option value="1">JPEG</option>
632:              <option value="1">OPUS</option>
```

- [ ] **Step 2: Replace the video codec options**

In [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue), find the block (lines ~448–456):

```vue
          <div class="field-row">
            <label>codec</label>
            <select
              :value="videoCodec.value.value"
              :disabled="isLocked"
              @change="videoCodec.set(($event.target as HTMLSelectElement).value)"
            >
              <option value="2">H.264</option>
              <option value="1">JPEG</option>
            </select>
          </div>
```

Replace the two `<option>` lines with the full 10-entry list in Max umenu order:

```vue
          <div class="field-row">
            <label>codec</label>
            <select
              :value="videoCodec.value.value"
              :disabled="isLocked"
              @change="videoCodec.set(($event.target as HTMLSelectElement).value)"
            >
              <option value="0">-none-</option>
              <option value="1">MJPEG</option>
              <option value="2">H.264</option>
              <option value="3">H.265</option>
              <option value="4">J2K</option>
              <option value="5">AV1</option>
              <option value="6">VP8</option>
              <option value="7">VP9</option>
              <option value="8">HFYU</option>
              <option value="9">FFV1</option>
            </select>
          </div>
```

(Label `MJPEG` matches the Max patcher umenu verbatim — the builder translates it to the UG-accepted `JPEG` internally.)

- [ ] **Step 3: Replace the audio codec options**

Find the block (lines ~626–634):

```vue
          <div class="field-row">
            <label>codec</label>
            <select
              :value="audioCodec.value.value"
              :disabled="isLocked"
              @change="audioCodec.set(($event.target as HTMLSelectElement).value)"
            >
              <option value="1">OPUS</option>
            </select>
          </div>
```

Replace the single `<option>` line with the full 10-entry list:

```vue
          <div class="field-row">
            <label>codec</label>
            <select
              :value="audioCodec.value.value"
              :disabled="isLocked"
              @change="audioCodec.set(($event.target as HTMLSelectElement).value)"
            >
              <option value="0">-none-</option>
              <option value="1">OPUS</option>
              <option value="2">speex (unavailable)</option>
              <option value="3">FLAC</option>
              <option value="4">AAC</option>
              <option value="5">MP3</option>
              <option value="6">G.722</option>
              <option value="7">u-law</option>
              <option value="8">A-law</option>
              <option value="9">PCM</option>
            </select>
          </div>
```

(`speex (unavailable)` suffix signals to the user that picking it will fail; we keep it listed for Max parity so the Max→NG roundtrip doesn't silently drop an index.)

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: expand codec dropdowns to full Max umenu (video 0-9, audio 0-9)"
```

---

## Task 6: Create the `probe-uv-codecs.sh` script

**Files:**
- Create: `scripts/probe-uv-codecs.sh`

This script is the human-readable version of what Task 7's integration test does programmatically. It lives alongside [scripts/capture-uv-fixtures.sh](../../../scripts/capture-uv-fixtures.sh) and follows the same conventions (auto-detect `vendor/ultragrid/active`, allow `UG_PATH` override, version-stamp the output).

- [ ] **Step 1: Verify the parent directory and the sibling script exist**

Run: `ls scripts/`
Expected: output includes `capture-uv-fixtures.sh`.

- [ ] **Step 2: Create `scripts/probe-uv-codecs.sh`**

Create the file with this content:

```bash
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
```

- [ ] **Step 3: Make the script executable**

Run: `chmod +x scripts/probe-uv-codecs.sh`

- [ ] **Step 4: Run the script against the vendored UG to produce a baseline report**

Run: `scripts/probe-uv-codecs.sh`
Expected: prints the report, writes `docs/ug-codecs-1.10.3.txt`. Every video codec except MJPEG should be "accepted"; the `1-alt:JPEG` line should be "accepted". Every audio codec except speex should be "accepted".

- [ ] **Step 5: Commit the script and the baseline report**

```bash
git add scripts/probe-uv-codecs.sh docs/ug-codecs-1.10.3.txt
git commit -m "scripts: add probe-uv-codecs.sh for UG codec name validation"
```

---

## Task 7: Add an integration test that re-runs the probes in CI/local vitest

**Files:**
- Create: `tests/main/devices/ultragrid/codecAcceptance.integration.test.ts`

This is the programmatic, committed version of Task 6's script. Task 6 gives humans a readable report; Task 7 fails the test suite if our mapping drifts from live UG. They cover the same ground intentionally — the script is for one-shot upgrades, the test is continuous.

- [ ] **Step 1: Read the pattern file to mirror its structure**

Run: `head -50 tests/main/devices/ultragrid/uvArgvParsing.integration.test.ts`
Note the `describeIfUv` pattern — the test is skipped automatically if no `uv` binary is available.

- [ ] **Step 2: Create the test file**

Create `tests/main/devices/ultragrid/codecAcceptance.integration.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Integration test: verify every "accepted" codec in our mapping is still
// accepted by the live `uv` binary. Runs against vendor/ultragrid/active or
// $UG_PATH. Skipped automatically when neither is available.
//
// If this test starts failing after a UG upgrade, the codec acceptance map
// in src/main/devices/ultragrid/cliBuilder.ts needs to be revisited. Re-run
// scripts/probe-uv-codecs.sh for a human-readable diff and update the maps
// (and the docs/ug-codecs-<version>.txt report) together.

const VENDORED_UV = resolve(
  __dirname,
  '../../../../vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv'
)

const UV_BIN = process.env.UG_PATH && existsSync(process.env.UG_PATH)
  ? process.env.UG_PATH
  : existsSync(VENDORED_UV)
    ? VENDORED_UV
    : null

const describeIfUv = UV_BIN ? describe : describe.skip

// Names here must match the strings our cliBuilder emits, NOT the Max umenu
// labels. In particular: index 1 is "JPEG" (not "MJPEG") and speex is absent.
const VIDEO_CODEC_NAMES = ['JPEG', 'H.264', 'H.265', 'J2K', 'AV1', 'VP8', 'VP9', 'HFYU', 'FFV1']
const AUDIO_CODEC_NAMES = ['OPUS', 'FLAC', 'AAC', 'MP3', 'G.722', 'u-law', 'A-law', 'PCM']

function runUvCollect(args: string[], timeoutMs = 3000): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(UV_BIN!, args)
    let combined = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
    }, timeoutMs)
    child.stdout.on('data', (c) => { combined += c.toString() })
    child.stderr.on('data', (c) => { combined += c.toString() })
    child.on('error', (err) => { clearTimeout(timer); rejectP(err) })
    child.on('close', () => { clearTimeout(timer); resolveP(combined) })
  })
}

describeIfUv('UG codec acceptance (live `uv` binary)', () => {
  it.each(VIDEO_CODEC_NAMES)('accepts video codec %s via libavcodec:codec=%s:help', async (name) => {
    const out = await runUvCollect(['-c', `libavcodec:codec=${name}:help`])
    expect(out).not.toMatch(/Unable to find codec/)
  })

  it.each(AUDIO_CODEC_NAMES)('accepts audio codec %s via short spawn', async (name) => {
    const out = await runUvCollect([
      '-s', 'testcard',
      '--audio-codec', `${name}:bitrate=64000`,
      '-P', '11002:11002:11004:11004',
      '192.0.2.1'
    ])
    expect(out).not.toMatch(/Unable to find encoder for audio codec/)
    expect(out).toMatch(/Audio codec/)
  })

  it('confirms speex is rejected (reason we throw on index 2)', async () => {
    const out = await runUvCollect([
      '-s', 'testcard',
      '--audio-codec', 'speex:bitrate=64000',
      '-P', '11002:11002:11004:11004',
      '192.0.2.1'
    ])
    expect(out).toMatch(/Unable to find encoder for audio codec 'speex'/)
  })

  it('confirms MJPEG is rejected (reason we remap index 1 to JPEG)', async () => {
    const out = await runUvCollect(['-c', 'libavcodec:codec=MJPEG:help'])
    expect(out).toMatch(/Unable to find codec/)
  })
})
```

- [ ] **Step 3: Run the new test file**

Run: `npx vitest run tests/main/devices/ultragrid/codecAcceptance.integration.test.ts`
Expected: 19 tests pass (9 video + 8 audio + 1 speex + 1 MJPEG). Each test spawns a short-lived `uv`; total duration should be around 10–30 seconds depending on machine.

If you're running without vendored UG or without `UG_PATH`, the whole block is skipped with no failures.

- [ ] **Step 4: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: all tests pass, including the new 19 codec acceptance tests and the existing integration tests. Total test count should increase by 19 (plus the 20 cliBuilder tests added in Task 2 — roughly 39 new tests total).

- [ ] **Step 5: Commit**

```bash
git add tests/main/devices/ultragrid/codecAcceptance.integration.test.ts
git commit -m "tests(ug): add codec acceptance integration test against live uv"
```

---

## Task 8: Full verification

**Files:** none modified (verification only).

- [ ] **Step 1: Run all automated checks**

Run: `npm run typecheck && npm test`
Expected: both exit 0. Total tests: 162 (pre-existing) + ~20 (cliBuilder) + ~19 (codec acceptance) = ~201 passing.

- [ ] **Step 2: Manual UI smoke test**

Run: `npm run dev`

In the running app:

1. **Add an UltraGrid device** to a channel in the default room.
2. **Video codec dropdown:** Open the Video Capture advanced fold. The codec `<select>` should list exactly:
   `-none-, MJPEG, H.264, H.265, J2K, AV1, VP8, VP9, HFYU, FFV1`
3. **Audio codec dropdown:** Open the Audio Capture advanced fold. The codec `<select>` should list exactly:
   `-none-, OPUS, speex (unavailable), FLAC, AAC, MP3, G.722, u-law, A-law, PCM`
4. **Pick H.265**, enable the device. In the main process stdout (`[UG ch.N] spawn:`), the argv should contain `-c libavcodec:codec=H.265:bitrate=10M`. Disable the device.
5. **Pick MJPEG (index 1)**, enable. The spawn line should show `-c libavcodec:codec=JPEG:bitrate=10M` — **not** `codec=MJPEG`. This is the critical Max-bug workaround. Disable.
6. **Pick audio codec FLAC**, enable. Argv should contain `--audio-codec FLAC:bitrate=64000`. Disable.
7. **Pick audio codec speex (unavailable)**, enable. The enable toggle should fail: the main process logs an error `audio codec index 2 (speex) is unavailable in UG 1.10.3` and the UI returns to the disabled state without spawning `uv`. (If it does spawn, UG will exit immediately with "Unable to find encoder" and the monitor log will show that — either outcome is acceptable for this test, but the thrown error is the cleaner path.)
8. **Pick video codec `-none-` (index 0)**, enable. Argv should NOT contain `-c` at all. Disable.
9. **Pick audio codec `-none-`**, enable. Argv should NOT contain `--audio-codec`. (`--audio-capture-format` still appears — that's expected.) Disable.

- [ ] **Step 3: If all manual checks pass, stop**

No final commit — each task already committed. Plan complete.

- [ ] **Step 4: If any manual check fails**

Do NOT mark this task done. Fix the failing behavior in whichever prior task is responsible, re-run the failing verification step, and commit the fix as `fix(ug-codec): <what>`.

---

## Out of scope (do NOT do in this plan)

- PRORES / PRORES_* variants — UG supports them, Max doesn't list them.
- Encoder-level selection (e.g. `nvenc` vs `libx264`) — UG picks automatically.
- Samplerate / bitrate range validation — UG does its own range checks.
- Upstream fix for the Max patcher's MJPEG bug — we just work around it.
- Renderer-side speex blocking (disable the option at `<select>` level). Keeping it present matches Max parity; the CLI builder throws before spawn, which is enough.
- Adding codecs to the CLI that Max doesn't expose (like RAW `-c none`) — would require new UI and new wire topics, out of scope.
