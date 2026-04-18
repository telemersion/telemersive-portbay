# Device Cell Icon Mapping

This document maps each device type and its connection modes to the SVG icon displayed in the matrix cell.

## SVG Icon Inventory (from context.md §4.5)

All icons share the same `viewBox="0 0 200 200"` and include the **Ground** base path.

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
  | 1 | Major direction active (`0`/`1`) | Lights up main arrow (`ToServer` for TX, `FromServer` for RX) |
  | 2 | Minor direction active (`0`/`1`) | Lights up feedback arrow (`DownStreamMinor` for TX, `UpStreamMinor` for RX) |
  | 3 | FPS | Displayed as label/tooltip |
  | 4 | Sink active (`0`/`1`) | Lights up `Sink` (ground platform) |

  Example: `indicators 1 0 116 1` = major active at 116 FPS, no minor feedback, sink active.

| Icon                                          | Name              | Visual Description                                   |
| --------------------------------------------- | ----------------- | ---------------------------------------------------- |
| ![ToServer](icons/ToServer.svg)               | `ToServer`        | Single arrow **up** (to router/server)               |
| ![FromServer](icons/FromServer.svg)           | `FromServer`      | Single arrow **down** (from router/server)           |
| ![UpStream](icons/UpStream.svg)               | `UpStream`        | Single arrow **up** (shifted right)                  |
| ![DownStream](icons/DownStream.svg)           | `DownStream`      | Single arrow **down** (shifted left)                 |
| ![ToPeerTX](icons/ToPeerTX.svg)               | `ToPeerTX`        | Arrow **right** + arrow **up** (send to peer)        |
| ![ToPeerRX](icons/ToPeerRX.svg)               | `ToPeerRX`        | Arrow **down** + arrow **right** (receive from peer) |
| ![ToPeerRXTX](icons/ToPeerRXTX.svg)           | `ToPeerRXTX`      | Bidirectional peer arrows                            |
| ![ToLocal](icons/ToLocal.svg)                 | `ToLocal`         | Arrow **right** (to local app)                       |
| ![FromLocal](icons/FromLocal.svg)             | `FromLocal`       | Arrow **up** from below + arrow **right**            |
| ![UpLocal](icons/UpLocal.svg)                 | `UpLocal`         | Arrow **right** (capture to local, shifted)          |
| ![DownLocal](icons/DownLocal.svg)             | `DownLocal`       | Small arrow **down** + platform                      |
| ![UpStreamMinor](icons/UpStreamMinor.svg)     | `UpStreamMinor`   | Small arrow **up** (minor stream)                    |
| ![DownStreamMinor](icons/DownStreamMinor.svg) | `DownStreamMinor` | Small arrow **down** (minor stream)                  |
| ![Sink](icons/Sink.svg)                       | `Sink`            | Ground only (no arrow)                               |

---

## Device Type → Icon Mapping

### 1. OSC (`loaded=1`)

| Connection Mode                         | Icon                                                            | Color     | Fill    |
| --------------------------------------- | --------------------------------------------------------------- | --------- | ------- |
| Always bidirectional (no mode selector) | ![UpStream](icons/UpStream.svg) ![DownStream](icons/DownStream.svg) ![Sink](icons/Sink.svg)  `UpStream` `DownStream` `Sink` | `#36ABFF` | `white` |

OSC is always bidirectional: it receives from local apps and forwards to the room proxy, and receives from the room proxy and forwards to local apps. The icon is a composite of three paths: `UpStream` (arrow up, shifted right), `DownStream` (arrow down, shifted left), and `Sink` (ground platform).

**Stopped state:** `opacity: 0.28` on icon box, `opacity: 0.35` on label.

---

### 2. UltraGrid (`loaded=2`)

UltraGrid has three axes that determine the icon:

- `connection`: `0`=TX, `1`=RX, `2`=both
- `transmission`: `0`=video, `1`=audio, `2`=video+audio
- `network/mode`: `1`=send to router, `2`=receive from router, `4`=peer to peer (auto), `5`=peer to peer (manual), `7`=capture to local

**Color depends on `transmission`:**

| `transmission`    | Subtype  | Color (on) | Color (off) | Icon Fill |
| ----------------- | -------- | ---------- | ----------- | --------- |
| `0` (video)       | UG video | `#F0DE01`  | `#826B1A`   | `#665800` |
| `1` (audio)       | UG audio | `#00E411`  | `#006B0A`   | `#003308` |
| `2` (video+audio) | UG v+a   | `#1BFEE9`  | `#668700`   | `#006655` |

**Mode-locking rules:**

- `network/mode = 1` (send to router) **forces** `connection = 0` (TX). RX and both are grayed out.
- `network/mode = 2` (receive from router) **forces** `connection = 1` (RX). TX and both are grayed out.
- `network/mode = 4, 5` (peer to peer) allow all three `connection` values (TX, RX, both).
- `network/mode = 7` (capture to local) is TX-only (local loopback, no network).

**Icon depends on `connection` × `network/mode`:**

| `connection` | `network/mode`            | Icon                                                                                                         | Description                            |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `0` (TX)     | `1` (send to router)      | ![ToServer](icons/ToServer.svg) `ToServer`                                                                   | Up arrow — sending to router           |
| `0` (TX)     | `4` (p2p auto)            | ![ToPeerTX](icons/ToPeerTX.svg) `ToPeerTX`                                                                  | Right+up — sending to peer             |
| `0` (TX)     | `5` (p2p manual)          | ![ToPeerTX](icons/ToPeerTX.svg) `ToPeerTX`                                                                  | Right+up — sending to peer             |
| `0` (TX)     | `7` (capture to local)    | ![ToLocal](icons/ToLocal.svg) `ToLocal`                                                                      | Right arrow — capture to local display |
| `1` (RX)     | `2` (receive from router) | ![FromServer](icons/FromServer.svg) `FromServer`                                                             | Down arrow — receiving from router     |
| `1` (RX)     | `4` (p2p auto)            | ![ToPeerRX](icons/ToPeerRX.svg) `ToPeerRX`                                                                  | Down+right — receiving from peer       |
| `1` (RX)     | `5` (p2p manual)          | ![ToPeerRX](icons/ToPeerRX.svg) `ToPeerRX`                                                                  | Down+right — receiving from peer       |
| `2` (both)   | `4` (p2p auto)            | ![ToPeerRXTX](icons/ToPeerRXTX.svg) `ToPeerRXTX`                                                            | Bidirectional peer arrows              |
| `2` (both)   | `5` (p2p manual)          | ![ToPeerRXTX](icons/ToPeerRXTX.svg) `ToPeerRXTX`                                                            | Bidirectional peer arrows              |

UltraGrid does **not** use `UpStreamMinor`/`DownStreamMinor` — those are MoCap-specific (see §3 below).

---

### 3. MoCap / NatNet (`loaded=3`)

MoCap has a `direction/select` field. Unlike UltraGrid, MoCap uses `UpStreamMinor`/`DownStreamMinor` to indicate a feedback channel — the protocol allows receivers to send control commands back to Motive (the MoCap server).

| `direction/select`           | Icon                                                                                                                                                          | Color     | Fill    | Description                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- | ---------------------------------------------------------------- |
| `0` (TX — send to room)      | ![UpStream](icons/UpStream.svg) ![DownStreamMinor](icons/DownStreamMinor.svg) ![Sink](icons/Sink.svg) `UpStream` + `DownStreamMinor` + `Sink`                | `#FFA126` | `white` | Major arrow up (sending), minor arrow down (feedback from RX)    |
| `1` (RX — receive from room) | ![DownStream](icons/DownStream.svg) ![UpStreamMinor](icons/UpStreamMinor.svg) ![Sink](icons/Sink.svg) `DownStream` + `UpStreamMinor` + `Sink`                | `#FFA126` | `white` | Major arrow down (receiving), minor arrow up (feedback to TX)    |
| `2` (both)                   | ![UpStream](icons/UpStream.svg) ![DownStream](icons/DownStream.svg) ![Sink](icons/Sink.svg) `UpStream` + `DownStream` + `Sink`                               | `#FFA126` | `white` | Bidirectional — same composite as OSC                            |

MoCap indicators (4 values: `major minor fps sink`) map to the composite paths: position 1 lights the major arrow, position 2 lights the minor arrow, position 3 is FPS, position 4 lights the sink/ground.

---

### 4. StageControl (`loaded=4`)

| Connection Mode                         | Icon                                                                                                                         | Color     | Fill    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| Always bidirectional (no mode selector) | ![UpStream](icons/UpStream.svg) ![DownStream](icons/DownStream.svg) ![Sink](icons/Sink.svg) `UpStream` + `DownStream` + `Sink` | `#FE5FF5` | `white` |

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

---

## Current Implementation Status

The current `DeviceCell.vue` needs updating to match this mapping:

- OSC/StageControl icon should be composite `UpStream` + `DownStream` + `Sink` (currently uses `ToPeerRX`)
- StageControl color should be `#FE5FF5` (currently uses UG v+a color `#1BFEE9`)
- UltraGrid needs `connection`, `transmission`, `network/mode` fields to select icon and color
- MoCap needs `direction/select` field to select icon, plus minor arrow composites
- Stopped state with correct opacity values (already implemented)

To complete the implementation, `DeviceCell` needs access to additional MQTT fields beyond `loaded`, `description`, and `enable` — specifically `connection`, `transmission`, `network/mode` for UG and `direction/select` for MoCap.
