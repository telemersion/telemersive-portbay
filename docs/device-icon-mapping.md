# Device Cell Icon Mapping

This document maps each device type and its connection modes to the SVG icon displayed in the matrix cell.

## Icon Inventory

All icons share `viewBox="0 0 200 200"` and are rendered as inline SVG paths. Ground truth is `src/renderer/assets/icons.js` — the icon inventory in `docs/design/design_reference.html` renders directly from that file.

**Composite icon design:** Device cell icons are composites of multiple SVG paths. Each path represents an independent data flow direction and can indicate whether data is currently flowing through it. When data flows, the corresponding arrow path highlights independently — e.g., an OSC device can show its `UpStream` arrow lit while `DownStream` is dim, or both lit simultaneously. This gives per-direction, per-source flow indication within a single icon.

**Indicator topics on the wire:**

- **OSC / StageControl:** Two separate topics — `inputIndicator` (`0`/`1`) and `outputIndicator` (`0`/`1`). These map directly to the two arrow paths (`UpStream` ↔ `outputIndicator`, `DownStream` ↔ `inputIndicator`).
- **UltraGrid:** Single `indicators` topic with space-separated values (6 values for v+a, fewer when video-only or audio-only). Mapping:

  | Position | Value | Arrow mapping |
  |---|---|---|
  | 1 | TX video active (`0`/`1`) | Lights up TX arrow |
  | 2 | RX video active (`0`/`1`) | Lights up RX arrow |
  | 3 | TX video FPS | Displayed as label/tooltip |
  | 4 | TX audio volume (dB) | Lights up TX arrow (audio) |
  | 5 | RX video FPS | Displayed as label/tooltip |
  | 6 | RX audio volume (dB) | Lights up RX arrow (audio) — explains values like `"-91.38"` in logs |
- **MoCap:** Single `indicators` topic with up to 4 space-separated values:

  | Position | Value | Arrow mapping |
  |---|---|---|
  | 1 | Major direction active (`0`/`1`) | Lights up main arrow (`DownStream` for TX, `DownStreamRight` for RX) |
  | 2 | Minor direction active (`0`/`1`) | Lights up feedback arrow (`UpStreamMinor` for TX, `DownStreamMinor` for RX) |
  | 3 | FPS | Displayed as label/tooltip |
  | 4 | Sink active (`0`/`1`) | Lights up `Sink` (ground platform) |

  Example: `indicators 1 0 116 1` = major active at 116 FPS, no minor feedback, sink active.

| Name              | In `icons.js`      | Visual Description                                          |
| ----------------- | ------------------ | ----------------------------------------------------------- |
| `Sink`            | yes                | Ground platform (no arrow)                                  |
| `UpStream`        | yes                | Single arrow **up** (shifted right)                         |
| `DownStream`      | yes                | Single arrow **down** (shifted left)                        |
| `DownStreamRight` | yes                | Single arrow **down** (shifted right — MoCap RX major)      |
| `UpStreamMinor`   | yes                | Small arrow **up** (MoCap TX feedback)                      |
| `DownStreamMinor` | yes                | Small arrow **down** (MoCap RX feedback)                    |
| `UpLocal`         | yes                | Arrow **right** (MoCap send-to-local TX)                    |
| `DownLocal`       | yes                | Arrow **left-down** (MoCap send-to-local RX)                |
| `FromLocal`       | yes                | Right-turn loopback (UG capture-to-local)                   |
| `ToServer`        | not yet            | Single arrow **up** (UG send to router — future)            |
| `FromServer`      | not yet            | Single arrow **down** (UG receive from router — future)     |
| `ToPeerTX`        | not yet            | Arrow right+up (UG p2p TX — future)                         |
| `ToPeerRX`        | not yet            | Arrow down+right (UG p2p RX — future)                       |
| `ToPeerRXTX`      | not yet            | Bidirectional peer arrows (UG p2p bidi — future)            |
| `ToLocal`         | not yet            | Arrow **right** (UG capture-to-local display — future)      |

---

## Device Type → Icon Mapping

### 1. OSC (`loaded=1`)

| Connection Mode                         | Icon                                                            | Color     | Fill    |
| --------------------------------------- | --------------------------------------------------------------- | --------- | ------- |
| Always bidirectional (no mode selector) | `UpStream` `DownStream` `Sink` | `#36ABFF` | `white` |

OSC is always bidirectional: it receives from local apps and forwards to the room proxy, and receives from the room proxy and forwards to local apps. The icon is a composite of three paths: `UpStream` (arrow up, shifted right), `DownStream` (arrow down, shifted left), and `Sink` (ground platform).

**Stopped state:** `opacity: 0.28` on icon box, `opacity: 0.35` on label.

---

### 2. UltraGrid (`loaded=2`)

UltraGrid has three axes that determine the icon:

- `connection`: `0`=TX, `1`=RX, `2`=both
- `transmission`: `0`=video, `1`=audio, `2`=video+audio
- `network/mode`: `1`=send to router, `2`=receive from router, `4`=peer to peer (auto), `5`=peer to peer (manual), `7`=capture to local

**Color depends on `transmission`:**

| `transmission`    | Subtype  | Color (on) | Color (off / dim) |
| ----------------- | -------- | ---------- | ----------------- |
| `0` (video)       | UG video | `#F0DE01`  | `#787000`         |
| `1` (audio)       | UG audio | `#00E411`  | `#006B08`         |
| `2` (video+audio) | UG v+a   | `#1BFEE9`  | `#0D7F74`         |

**Mode-locking rules:**

- `network/mode = 1` (send to router) **forces** `connection = 0` (TX). RX and both are grayed out.
- `network/mode = 2` (receive from router) **forces** `connection = 1` (RX). TX and both are grayed out.
- `network/mode = 4, 5` (peer to peer) allow all three `connection` values (TX, RX, both).
- `network/mode = 7` (capture to local) is TX-only (local loopback, no network).

**Icon depends on `connection` × `network/mode`:**

| `connection` | `network/mode`            | Icon                                                                                                         | Description                            |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `0` (TX)     | `1` (send to router)      | `ToServer`                                                                   | Up arrow — sending to router           |
| `0` (TX)     | `4` (p2p auto)            | `ToPeerTX`                                                                  | Right+up — sending to peer             |
| `0` (TX)     | `5` (p2p manual)          | `ToPeerTX`                                                                  | Right+up — sending to peer             |
| `0` (TX)     | `7` (capture to local)    | `ToLocal`                                                                      | Right arrow — capture to local display |
| `1` (RX)     | `2` (receive from router) | `FromServer`                                                             | Down arrow — receiving from router     |
| `1` (RX)     | `4` (p2p auto)            | `ToPeerRX`                                                                  | Down+right — receiving from peer       |
| `1` (RX)     | `5` (p2p manual)          | `ToPeerRX`                                                                  | Down+right — receiving from peer       |
| `2` (both)   | `4` (p2p auto)            | `ToPeerRXTX`                                                            | Bidirectional peer arrows              |
| `2` (both)   | `5` (p2p manual)          | `ToPeerRXTX`                                                            | Bidirectional peer arrows              |

UltraGrid does **not** use `UpStreamMinor`/`DownStreamMinor` — those are MoCap-specific (see §3 below).

---

### 3. MoCap / NatNet (`loaded=3`)

MoCap has a `direction/select` field. Unlike UltraGrid, MoCap uses `UpStreamMinor`/`DownStreamMinor` to indicate a feedback channel — the protocol allows receivers to send control commands back to Motive (the MoCap server).

| `direction/select`              | Icon                                                                                                                                                         | Color     | Fill    | Description                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------- | ------------------------------------------------------------- |
| `1` (TX - send to router)       | `UpStream` + `DownStreamMinor` + `Sink`                | `#FFA126` | `white` | Major arrow up (sending), minor arrow down (feedback from RX) |
| `2` (RX - receive from router)  | `DownStream` + `UpStreamMinor` + `Sink`                | `#FFA126` | `white` | Major arrow down (receiving), minor arrow up (feedback to TX) |
| `0` (default / unset)           | same as TX (`1`)                                                                                                                                             | `#FFA126` | `white` | Falls through to TX in DeviceCell                             |

MoCap indicators (4 values: `major minor fps sink`) map to the composite paths: position 1 lights the major arrow, position 2 lights the minor arrow, position 3 is FPS, position 4 lights the sink/ground.

**Send-to-Local (`direction/select=4`)** — local loopback, MoCap data captured and displayed on the same machine. Uses `UpLocal + DownLocal` composite icon (no network arrows).

| `direction/select`        | Icon                          | Color     | Description                        |
| ------------------------- | ----------------------------- | --------- | ---------------------------------- |
| `4` (send to local)       | `UpLocal` + `DownLocal`       | `#FFA126` | Local loopback — no network arrows |

---

### 4. StageControl (`loaded=4`)

| Connection Mode                         | Icon                                                                                                                         | Color     | Fill    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| Always bidirectional (no mode selector) | `UpStream` + `DownStream` + `Sink` | `#FE5FF5` | `white` |

StageControl is a glorified OSC device — it shares the OSC handler and uses the same bidirectional icon. The difference is that instead of connecting to a channel's UDP proxy, it connects to OpenStageControl. It is channel-independent (doesn't matter which channel slot it occupies).

---

## UltraGrid CLI Output Parsing

The Max patcher parses UltraGrid's stdout to produce the 6 indicator values and monitor log. This is the reference for NG's UltraGrid device handler.

**UG stdout line format (inferred):**

```
[1664558496.525] [Syphon] sender] FPS 30/1 peak. 30/1
[1664558497.525] [Syphon] display] Volume: -91.38
```

**Parsing pipeline (from Max patcher screenshot + `tg.ultragrid.js`):**

1. **Strip timestamp:** `regexp (\[\d+.\d+\]) @substitute %0` — extracts and removes the leading `[timestamp]` from each line. Unmatched lines (no timestamp, e.g., logout/holepunching messages) are dropped via the dumpout outlet.

2. **Route by source type prefix:** `route [Spout] [SPOUT] [Syphon] [SYPHON] [Decklink] [DeckLink] [syphon] [Syphon] [SYPHON] [spout] [Spout] [SPOUT] [screen] [AVfoundation] [NDI] [ndi] [Audio] [dshow] [GL] [testcard]` — these are UG's subsystem prefixes. Each matched prefix routes to its outlet; unmatched lines are dropped.

3. **Route by direction:** `route sender] capture] cap.] display] decoder] disp.]` — the next token after the source prefix indicates the data direction:
   - **TX tokens:** `sender]`, `capture]`, `cap.]`
   - **RX tokens:** `display]`, `decoder]`, `disp.]`

4. **Extract values (two parallel branches — TX and RX):**

   After direction routing, each branch extracts:

   | Branch | What to extract | How |
   |---|---|---|
   | TX | Video FPS | `route FPS peak.` → FPS is a fraction `N/D` (e.g. `30/1`), parsed via `fromsymbol @separator /` → `unpack f f` |
   | TX | Audio volume | `route Volume:` → dB float (e.g. `-18.0`) |
   | TX | Active flag | `onebang` — fires `1` on first FPS line, stays `1` until reset |
   | RX | Video FPS | Same fraction parsing |
   | RX | Audio volume | Same `Volume:` parsing |
   | RX | Active flag | Same `onebang` pattern |

5. **Combine into 6 values:** `join 6` → `[TX active, RX active, TX FPS, TX volume, RX FPS, RX volume]`

6. **Rate limit:** `@triggers 0 1` (only fires on rightmost input change) → `zl.change` (suppress duplicates) → `qlim 2000` (throttle to every 2 seconds)

7. **Output to two topics:**
   - `prepend stream` → published to `indicators` topic
   - `prepend monitor` → published to `monitor/log` topic

**CLI generation** is handled by `tg.ultragrid.js` which assembles UG CLI args based on `networkMode × connection × transmission`. Key patterns:
- Port formula: `-P{port}` for video/audio-only, `-P{port}:{port}:{port+2}:{port+2}` for video+audio
- `send to router` / `receive from router`: uses router URL as destination
- `peer to peer (manual)`: uses LAN IP as destination
- `peer to peer (automatic)`: uses holepunching with STUN server
- `capture to local`: capture + display on same machine, no network
- RX always uses testcard as sender (to open the proxy/port), then adds display/receive flags

---

## Resolved Questions

1. **UltraGrid `connection=2` (both) via router:** Uses `UpStream` + `DownStream` + `Sink` — same composite as OSC.
2. **UltraGrid peer-to-peer bidirectional:** `ToPeerRXTX` renders at the same size as other icons (the `scale` transform in the raw path data is just an SVG artifact).
3. **MoCap direction/select:** TX (`0`) = major arrow up + minor arrow down. RX (`1`) = major arrow down + minor arrow up. Both (`2`) = same as OSC (`UpStream` + `DownStream` + `Sink`).
4. **"Off" colors:** Implementation choice — use whatever is easy but distinguishable from the active state. Opacity reduction (`0.28`) is the current approach and is sufficient.
