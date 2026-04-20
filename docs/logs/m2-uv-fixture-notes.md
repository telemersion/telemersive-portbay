# UltraGrid fixture notes (M2)

Golden fixtures under [tests/fixtures/ultragrid/<version>/](../../tests/fixtures/ultragrid/)
are the ground truth the parsers at [src/main/enumeration/parsers/](../../src/main/enumeration/parsers/) test against. UV's CLI output drifts version to version — re-capture on every upgrade and re-run `npx vitest run tests/main/enumeration/parsers`.

## Captured versions

### UltraGrid 1.10.3

- Captured: 2026-04-20 on macOS (Darwin aarch64)
- Command: `scripts/capture-uv-fixtures.sh` against `vendor/ultragrid/1.10.3/uv-qt.app/Contents/MacOS/uv`
- Build line: `UltraGrid 1.10.3 (tags/v1.10.3 rev 12e2705 built Feb 20 2026 15:07:39)`
- Notable: stderr starts with `MasterPortDestroyer is armed` / ends with `triggered` — a harmless lifecycle banner added in 1.10 series. Parsers ignore it.
- Notable: `portaudio` entries carry a terse single-number `(N; API)` parens — the number means *input channels* on `-s`, *output channels* on `-r`. In 1.9.x the same slot is verbose: `(output channels: X; input channels: Y; API)`.

### UltraGrid 1.9.12

- Captured: 2026-04-20 on macOS (Darwin aarch64)
- Command: `scripts/capture-uv-fixtures.sh` against `vendor/ultragrid/1.9.12/uv-qt.app/Contents/MacOS/uv`
- Build line: `UltraGrid 1.9.12 (tags/v1.9.12 rev 669a27d built Oct 21 2025 08:09:11)`
- Notable: no MasterPortDestroyer banner.
- Notable: `portaudio` parens show both channel directions per device — see above.

### UltraGrid 1.8.7 (NOT captured)

The 1.8.7 bundle at `vendor/ultragrid/1.8.7/` hangs without producing output when invoked from the command line — almost certainly macOS Gatekeeper blocking the un-notarized older build. Fixture capture skipped. If/when we need to support 1.8.x interop, re-sign or notarize the bundle and re-run `scripts/capture-uv-fixtures.sh`.

## Probe commands

| Fixture file            | Command                      | Purpose                                                 |
|-------------------------|------------------------------|---------------------------------------------------------|
| `texture-capture.txt`   | `uv -t help`                 | Video backend sanity check (not parsed into any topic)  |
| `ndi.txt`               | `uv -t ndi:help`             | NDI source discovery → `ndiRange`                       |
| `syphon.txt`            | `uv -t syphon:help`          | Syphon sender enum (mac) → `textureCaptureRange`        |
| `spout.txt`             | `uv -t spout:help`           | Spout sender enum (win) → `textureCaptureRange`         |
| `portaudio-cap.txt`     | `uv -s portaudio:help`       | Audio capture — portaudio                               |
| `coreaudio-cap.txt`     | `uv -s coreaudio:help`       | Audio capture — coreaudio (mac)                         |
| `wasapi-cap.txt`        | `uv -s wasapi:help`          | Audio capture — wasapi (Windows only)                   |
| `jack-cap.txt`          | `uv -s jack:help`            | Audio capture — jack                                    |
| `portaudio-recv.txt`    | `uv -r portaudio:help`       | Audio playback — portaudio                              |
| `coreaudio-recv.txt`    | `uv -r coreaudio:help`       | Audio playback — coreaudio (mac)                        |

**Texture-sender picker**: Max's `textureCaptureRange` is the per-platform texture-sender list — syphon servers on mac, spout senders on windows. The `uv -t help` backend list is *not* what goes into that topic; it's kept as a fixture for diagnostic purposes only (format drift across UV versions).

## Known parser-breakage signals on upgrade

- `Available (PortAudio|Core Audio|capture) devices` header text changed → texture/portaudio/coreaudio parsers miss the header, return empty/fallback.
- `portaudio:<id> - <name>` skeleton changed (e.g. different separator, different prefix capitalization) → portaudio parser silently returns 0 devices.
- `coreaudio:<id>:` → `coreaudio[<id>]` or similar format drift → coreaudio parser returns 0.
- `available sources (tentative, format: ...)` header line in NDI output renamed → ndi parser returns `-default-` even when sources exist.

When a parser test fails after capturing a new fixture: diff the new fixture against the previous version's fixture, then adjust the parser regex. Commit both the new fixture and the parser tweak together.
