# M2b Task 27 — Max UG Reference Capture Notes

Captured: _(date TBD)_
Max host: Windows
NG observer host: macOS
Broker: `telemersion.zhdk.ch:3883`
Room ID: `11`
Max peer ID (this session): `nA2kFJJFPcFjHRCawxGX8R` — **ephemeral**, changes on every rejoin; re-grab if Max reconnects during capture.
Max version: _(fill in)_
UltraGrid version: _(fill in — `uv --version` output)_

Purpose: lock down the exact device-subtree schema, CLI-arg shape, monitor/log format,
and port pattern Max emits, so the M2b implementation (Tasks 29-32) can target
byte-for-byte parity. Fixtures pinned in [tests/fixtures/ultragrid/](../../tests/fixtures/ultragrid/).

---

## Prerequisites

- [ ] Max gateway running on Windows, UG available and spawnable.
- [ ] MQTT broker reachable from both Windows (Max) and macOS (capture side).
- [ ] `mosquitto_sub` installed on macOS (or another CLI able to dump retained topics).
- [ ] Clean broker state for the test peer: either retained topics cleared,
      or use a fresh peer/room.
- [ ] Both machines clock-synced if you care about timestamp correlation (optional).

---

## Capture procedure

Run each step in order. Copy raw output into the fixture files listed;
do not edit or reformat.

### Step 1 — Start the retained-topic dumper (macOS side)

In a dedicated terminal on mac:

```sh
mosquitto_sub \
  -h <BROKER_HOST> -p <BROKER_PORT> \
  -t '/peer/+/rack/#' \
  -v -R \
  | tee /tmp/max-retained-live.txt
```

- `-R` keeps retained messages visible.
- `-v` prints `topic value` lines.
- Leave it running for the duration of all capture steps.

Verify: once Max joins, you should see a flood of `/peer/<maxId>/rack/page_0/channel.*/loaded 0`
lines appear. If nothing appears, the broker / topic filter is wrong.

### Step 2 — Mode 1 (send-to-router / UDP) session

On Windows/Max:

1. Join the test room.
2. Add a UG device on **channel 0**.
3. Set `network/mode = 1`.
4. Configure a typical video+audio setup (pick a real texture/capture source
   and a real audio device — the captured subtree is only useful if values are
   real, not defaults).
5. Enable.
6. Let it run ~30 seconds so `monitor/log` accumulates real stderr lines.

On Windows, in **PowerShell (admin not required)**:

```powershell
Get-CimInstance Win32_Process -Filter "Name='uv.exe'" |
  Select-Object -ExpandProperty CommandLine |
  Out-File -Encoding utf8 C:\temp\max-cli-mode1.txt
```

Copy `C:\temp\max-cli-mode1.txt` → [tests/fixtures/ultragrid/max-cli-mode1.txt](../../tests/fixtures/ultragrid/).

On macOS, snapshot the currently-retained state for Max's peer under channel 0:

```sh
mosquitto_sub \
  -h <BROKER_HOST> -p <BROKER_PORT> \
  -t '/peer/<MAX_PEER_ID>/rack/page_0/channel.0/#' \
  -v -R -W 3 \
  > tests/fixtures/ultragrid/max-device-subtree-mode1.txt
```

- `-W 3` exits after 3 seconds of idle — long enough to drain all retained topics.
- Convert to JSON if preferred; a flat `topic value` dump is fine for golden
  fixtures (parser tests tokenize line-by-line).

Also capture `monitor/log`:

```sh
mosquitto_sub \
  -h <BROKER_HOST> -p <BROKER_PORT> \
  -t '/peer/<MAX_PEER_ID>/rack/page_0/channel.0/device/monitor/log' \
  -v -R -W 3 \
  > tests/fixtures/ultragrid/max-monitor-log-trace.txt
```

(Mode-1 monitor/log is representative; we don't need a separate mode-4 one.)

### Step 3 — Mode 4 (peer-to-peer-automatic / RTP) session

1. On Max: disable the mode-1 device.
2. Switch `network/mode = 4` on the same channel.
3. Reconfigure if the mode switch reset any fields.
4. Enable.
5. Wait ~15 seconds for steady state.

Windows PowerShell:

```powershell
Get-CimInstance Win32_Process -Filter "Name='uv.exe'" |
  Select-Object -ExpandProperty CommandLine |
  Out-File -Encoding utf8 C:\temp\max-cli-mode4.txt
```

Copy → [tests/fixtures/ultragrid/max-cli-mode4.txt](../../tests/fixtures/ultragrid/).

macOS retained snapshot:

```sh
mosquitto_sub \
  -h <BROKER_HOST> -p <BROKER_PORT> \
  -t '/peer/<MAX_PEER_ID>/rack/page_0/channel.0/#' \
  -v -R -W 3 \
  > tests/fixtures/ultragrid/max-device-subtree-mode4.txt
```

### Step 4 — Multi-device port pattern

1. On Max: disable the channel-0 device.
2. Load UG on **channel 0** AND **channel 5** simultaneously (mode 1 on both).
3. Enable both.
4. Wait 10 seconds.

From the live mosquitto_sub output (/tmp/max-retained-live.txt or a fresh dump),
grep out the port fields:

```sh
grep -E '/channel\.(0|5)/device/.*Port ' /tmp/max-retained-live.txt \
  | sort -u \
  > tests/fixtures/ultragrid/max-multi-device-ports.txt
```

Record in the table below the observed values for both channels so Task 29
can verify the `{roomId}{cc}{slot}` formula and the dual-pair
(`xxcc0↔xxcc1`, `xxcc4↔xxcc8`) pattern.

---

## Observed values

### Mode 1 / channel 0 / roomId 11 — CLI

```text
--param log-color=no -t spout:name='Spout Sender' -c libavcodec:codec=H.264:bitrate=10M -s portaudio:44 --audio-codec OPUS:bitrate=64000 --audio-capture-format channels=1 -P11002:11002:11004:11004 telemersion.zhdk.ch
```

- Ports: `11002:11002:11004:11004` (video_rx:video_tx:audio_rx:audio_tx).
- Destination host: `telemersion.zhdk.ch` (positional, last arg).
- No `-d` or `-r` flags — mode-1 is send-only (to router).
- See [max-cli-mode1.txt](../../tests/fixtures/ultragrid/max-cli-mode1.txt).

### Mode 1 / channel 5 / roomId 11 — CLI

```text
--param log-color=no -t spout:name='room_channel_0' -c libavcodec:codec=H.264:bitrate=10M -s portaudio:12 --audio-codec OPUS:bitrate=64000 --audio-capture-format channels=1 -P11052:11052:11054:11054 telemersion.zhdk.ch
```

- Ports: `11052:11052:11054:11054`. See [max-cli-mode1-ch5.txt](../../tests/fixtures/ultragrid/max-cli-mode1-ch5.txt).
- Confirms port formula `{roomId}{cc 2-digit}{slot ∈ {2,4}}`.

### Mode 4 / channel 0 / roomId 11 — CLI

```text
--param log-color=no -t spout:name='Spout Sender' -c libavcodec:codec=H.264:bitrate=10M -s portaudio:12 --audio-codec OPUS:bitrate=64000 --audio-capture-format channels=1 -d gl:spout='room_channel_0' -r portaudio:11
```

- No `-P` / no host arg — mode 4 (RTP peer-to-peer) handles networking itself.
- `-d gl:spout='room_channel_0'` — display-side texture sender, name matches `videoReciever/texture/name` topic.
- `-r portaudio:11` — audio playback device index.
- See [max-cli-mode4.txt](../../tests/fixtures/ultragrid/max-cli-mode4.txt).

### Port formula (confirmed)

```text
port = {roomId}{channelIndex (2-digit zero-padded)}{slot}
slots = { video: 2, audio: 4 }  // rx and tx use the same port in both cases
```

Spec §8.7 mentioned slots `{0, 1, 4, 8}` — **actual implementation uses only `{2, 4}`** with rx=tx (not dual-pair). Spec needs updating or note clarifying.

---

## Deviations / surprises

- [x] **Port slots are `{2, 4}`, not `{0, 1, 4, 8}` as speculated from spec §8.7.** Real pattern: two same-port pairs (video_rx=video_tx=slot2, audio_rx=audio_tx=slot4). M2b Task 29 allocator must match this, not the speculated pattern.
- [x] **Typo `videoReciever` (sic) is preserved throughout Max's topic schema.** Not `videoReceiver`. NG must match exactly or topic echo breaks.
- [x] **Mode-specific networking.** Mode 1 uses `-P ports host` positional style; mode 4 uses `-d` + `-r` per-device flags, no ports/host. Same `UltraGridConfig` feeds both but the CLI builders diverge heavily — keep them as separate `cliADD_mode1` / `cliADD_mode4` assemblers rather than a unified template.
- [x] **`-s portaudio:N` uses a raw integer index** (not a device name). Index comes from `settings/localMenus/portaudioCaptureRange` (the prefix of each `|`-separated entry). Topic `audioCapture/portaudio/menu/selection` holds the human-readable name; the CLI builder must look up the numeric prefix from the `*Range` topic at spawn time, or persist the numeric index somewhere.
- [x] **Texture source name in mode 4** (`-d gl:spout='room_channel_0'`) comes from `videoReciever/texture/name`, which itself is templated on the channel (e.g. `s_channel_0` initial, then Max rewrites to `room_channel_0`). So Max maintains two names — "s_" for stage-local, "room_" for room-shared. NG must replicate this naming flip.
- [x] **`description = ultragrid` (lowercase)** is the device-description string published on load. NG should match.
- [x] **`print_cli` topic** — Max publishes `print_cli 0` as part of the default set. Looks like a UI toggle that dumps the CLI to monitor/log; confirm semantics during M2b panel work.
- [x] **`monitor/log` is pull-only, gated by `monitor/monitorGate`.** Max does **not** stream stderr to the retained topic unconditionally. The monitor tab in the UI flips `monitorGate = 1`, which enables streaming; closing the tab flips back to `0`. Rationale: 20 channels × constant stderr would flood the broker with data nobody is watching. NG's UltraGridDevice must: (a) buffer stderr lines locally always (~50-line ring), (b) publish to `monitor/log` **only when `monitorGate = 1`**, (c) stop publishing when gate drops to 0. This revises M2b Task 32 Step 3 (onStderr handler).
- [x] **`updateMenu` is the on-demand enumeration trigger.** Values seen: `audioCapture jack`, `texture`, `audioCapture portaudio`, `audioReceive portaudio`. NG's existing `enumerate:refresh` IPC is the equivalent; no per-backend selector needed if we re-enumerate everything.
- [x] **Mode-switch flow** visible in both captures: `mode 0 → mode 5 → mode 1` (or 4). Mode 5 appears to be a transient "loading/reset" state, not a user-selectable final mode. NG can ignore mode 5 in the mapper (or treat as a transition-only value).
- [x] **`remoteValues/local_os windows`** — Max publishes its OS as a retained topic. NG should publish `mac` or `linux` analogously.

---

## Re-capture procedure (on UV / Max upgrade)

Per project memory (`UltraGrid CLI parsing`): UV stdout format is version-dependent.
If either Max or UV bumps a minor version, re-run Steps 2-4 and update this notes file.

---

## Fixture file index

| File | Source | Status |
|---|---|---|
| [max-device-subtree-mode1.txt](../../tests/fixtures/ultragrid/max-device-subtree-mode1.txt) | Step 2 | ☐ captured |
| [max-device-subtree-mode4.txt](../../tests/fixtures/ultragrid/max-device-subtree-mode4.txt) | Step 3 | ☐ captured |
| [max-cli-mode1.txt](../../tests/fixtures/ultragrid/max-cli-mode1.txt) | Step 2 (PowerShell) | ☐ captured |
| [max-cli-mode4.txt](../../tests/fixtures/ultragrid/max-cli-mode4.txt) | Step 3 (PowerShell) | ☐ captured |
| [max-monitor-log-trace.txt](../../tests/fixtures/ultragrid/max-monitor-log-trace.txt) | Step 2 | ☐ captured |
| [max-multi-device-ports.txt](../../tests/fixtures/ultragrid/max-multi-device-ports.txt) | Step 4 | ☐ captured |
