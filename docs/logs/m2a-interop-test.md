# M2a Interop Test — Telemersive Gateway NG ↔ Max

**Goal:** Validate the M2a deliverables against the live Max peer: device-type picker (OSC + StageControl), subscription narrowing to spec §4.6, rack persistence exclusion, StageControl round-trip. This is the M2a acceptance gate (Task 26 of [2026-04-19-gateway-ng-m2.md](../plans/2026-04-19-gateway-ng-m2.md)).

**Setup:**
- Host A (NG) + Host B (Max), or two user accounts on one host.
- Production broker `telemersion.zhdk.ch:3883`.
- NG commit under test: `71d27a742a37e93e9b2b146b990b1564cb486aa8` (m2a T22+T25).
- Max version: `V8.1.3`.
- Test date: `2026-04-19`.
- Tester: `maybites`.

**Preconditions:**
- [x] NG built from current `master` (`npm run build` clean; confirmed at commit `71d27a7`).
- [x] Broker retained state cleared for the NG peer's own subtree (or use a fresh peer name if retained cleanup is awkward).
- [x] `rack.json` deleted on Host A to start from a clean state. Path: `~/Library/Application Support/telemersive-gateway-ng/rack.json` (macOS).
- [x] Max gateway running on Host B, same broker, ready to join the test room.
- [x] Activity Log open in NG.

**Legend:**
- ✅ pass
- ❌ fail
- ⚠️ partial
- ⏭ skipped / deferred

---

## Case 1 — Picker shows 4 tiles

**Why:** Spec §9.3 — `+` on an empty local cell opens a device-type picker, not a direct `loaded=1` publish.

**Steps:**
1. In NG: join the test room.
2. Hover an empty local channel cell (any index) until the `+` icon appears.
3. Click `+`.

**Expected:**
- Popup opens anchored below the cell.
- Four tiles visible in a 2×2 grid:
  - **OSC** — blue dot, bright/clickable.
  - **StageControl** — cyan dot, bright/clickable.
  - **UltraGrid** — yellow dot, **greyed** (cursor: not-allowed; click produces no effect).
  - **MoCap** — orange dot, **greyed** (same).
- Press `Esc` → popup closes.
- Reopen, click outside the popup → popup closes.

**Result:** ✅ pass

- Popup opens anchored below the cell.
- OSC (blue) and StageControl (cyan) tiles clickable.
- UltraGrid (yellow) and MoCap (orange) tiles greyed and non-interactive.
- Esc closes the popup; click outside closes it.

---

## Case 2 — StageControl load (NG creates, Max observes)

**Why:** Spec §5.4 — `loaded=4` is StageControl; device subtree uses the same OSC relay infrastructure. Max must see the channel populate with type-4 semantics.

**Steps:**
1. On NG: open the picker on channel N (pick an unused index).
2. Click **StageControl** tile.
3. Watch the Activity Log on NG and the corresponding view on Max.

**Expected on NG:**
- Activity Log shows `pub /peer/<ngId>/rack/page_0/channel.N/loaded 4` (retained=1).
- Subsequent `pub` lines for the device subtree defaults: `device/gui/description StageC`, `device/gui/enable 0`, `device/gui/localudp/inputPort <10xxx>`, etc. (14 topics per `publishDefaults`).
- Matrix cell at channel N fills; shows the StageControl icon color (`#1BFEE9`), label reads `StageC`.
- `SUB /peer/<ngId>/rack/page_0/channel.N/device/#` appears (per-channel subscribe added by DeviceRouter).

**Expected on Max:**
- Channel N populates in Max's matrix with the StageControl device type.
- Description field reads `StageC`.
- Max does **not** echo bogus IP defaults of `0` back into NG's subtree (M1 fix).

**Result:** ✅ pass (on clean channel 3)

First attempted on channel 0, which had **stale retained state on the broker** from a prior Max test session (peerId `wLmWnGxxfSpLLs6eM8eRjM`). Max's `loaded 4` echo caused it to re-publish its cached junk (`peerLocalIP 0`, `outputIPOne 0`, `outputPortTwo 10027`, `reset 1`). NG's post-echo re-publishes then over-wrote back to correct values. The noise reflects broker retained state — not an NG regression, and not a Max bug either (Max is correctly reading retained topics it's subscribed to).

Re-ran on **channel 3** (fresh retained state). Clean cascade:

```
[22:11:54.198] RECV .../channel.3/loaded 4
[22:11:54.201] PUB r .../device/gui/localudp/peerLocalIP 192.168.1.101
[22:11:54.201] PUB r .../device/gui/localudp/enableTwo 0
[22:11:54.201] PUB r .../device/gui/localudp/inputPort 10039
[22:11:54.201] PUB r .../device/gui/localudp/outputIPOne 192.168.1.101
[22:11:54.201] PUB r .../device/gui/localudp/outputIPTwo 192.168.1.101
[22:11:54.201] PUB r .../device/gui/localudp/outputPortOne 10038
[22:11:54.202] PUB r .../device/gui/localudp/outputPortTwo 10037
[22:11:54.202] PUB r .../device/gui/localudp/reset 0
[22:11:54.202] PUB r .../device/gui/monitor/log 0
[22:11:54.202] PUB r .../device/gui/monitor/monitorGate 0
[22:11:54.202] PUB r .../device/gui/description StageC
[22:11:54.202] PUB r .../device/gui/enable 0
[22:11:54.202] PUB r .../device/gui/inputIndicator 0
[22:11:54.202] PUB r .../device/gui/outputIndicator 0
[22:11:54.202] SUB   .../channel.3/device/#
```

Max log confirms RX of all 14 topics with NG's real values (no stomp). Per-channel `SUB` confirmed.

**Follow-up / environment note:** the broker still holds dirty retained state on channel 0 for this peerId. Should be cleared before future interop tests, or tests should use fresh channels.

---

## Case 3 — StageControl config round-trip + relay

**Why:** StageControl must behave identically to OSC: config writes round-trip, and the UDP relay forwards traffic. Panel title should read "StageControl" (type label row above breadcrumb).

**Steps:**
1. On NG: click the StageControl cell from Case 2 → DevicePanel opens.
2. Verify the type label above the breadcrumb reads `STAGECONTROL`.
3. Set `outputIPOne` to `127.0.0.1`, set `outputPortOne` to some free port (e.g. `8001`).
4. Toggle Enable to `ON`.
5. Send OSC traffic into the device's `inputPort` (displayed in the panel's "Receiving at" section). Any OSC source works — `oscsend` CLI, Max test patch, etc.
6. On Max side: verify Max's matrix shows the device enabled and that its own relay receives the remote traffic per the OSC port architecture (local ports 10xxx ↔ room ports {roomId}xxx).

**Expected:**
- Panel type label: `STAGECONTROL`.
- Description input (editable while disabled) still reads `StageC` by default.
- Enable button turns green (`#1D9E75`); all config inputs grey out while enabled (spec §5.3).
- Max observes all device-subtree changes (IP, port, enable).
- OSC traffic sent to NG's local `inputPort` is received on NG's local `outputPortOne` (i.e. localhost round-trip via the room proxy works).

**Result:** ✅ pass (after fixing two structural bugs — see below)

- Panel type label reads `STAGECONTROL` (small grey label under breadcrumb); the large centered header shows `StageC` which is the editable `description` field, not the type label. Design intent confirmed.
- Enable toggle → green; config inputs grey out while enabled.
- TX/RX arrow indicators animate during real OSC traffic (150ms debounce, pulses on first packet, returns to idle after silence).
- Round-trip verified end-to-end through the real broker proxy: `oscsend localhost 10009 /t f 1.0` → proxy at `telemersion.zhdk.ch:11009` → reaches peers in room.

**Bugs found + fixed during this case:**

1. **DeviceRouter.unloadChannel bypassed `trackedPublish`** (commit `2e28cbb`): directly called `bus.publish(1, t, '')` instead of routing through the wrapper that maintains `retainedTopics`. Result: the `retainedTopics` map was never cleaned on device removal, so the next device load saw `hasRetained==true` for all 14 topics and skipped publishing defaults. Fix: added a `publish` callback param to `DeviceRouter`, piped `trackedPublish` through. NG↔NG create→remove→create now republishes all 14 defaults with real values.

2. **OSC relay used wrong room port and wrong host** (commit `1e14fcc`): M1 bound the RX socket on `11<N>8` which is actually the UltraGrid-audio proxy; the OSC proxy is `many2manyBi` on single port `11<N>9`. And it bound/sent on `localIP` not the broker host, so packets never left the machine. Rewrote as single socket per device, bound on `localIP:<localInputPort>`, with source-IP-based dispatch (proxy→local, local→proxy), DNS-resolved broker host cached on enable. StageControl (type 4) targets shared room port `11902`; OSC (type 1) targets `11<N>9`.

3. **Indicator debouncing added** to `OscDevice` (commit `1e14fcc`): `inputIndicator`/`outputIndicator` now pulse `1` on first packet, return to `0` after 150ms of silence. Previously never published, so arrows never animated.

---

## Case 4 — Enumeration visibility ✅ pass

**Re-run date:** 2026-04-20. NG commit under test: `87a7286` (T24 wiring).

**Setup for re-run:**

- UltraGrid 1.10.3 vendored under `vendor/ultragrid/1.10.3/`, active symlink set.
- Test NDI source (`NX-41545 (Test Patterns)`) running on NG host.
- Syphon server (`Simple Server`) running on NG host.
- Max peer `nA2kFJJFPcFjHRCawxGX8R` present in the room (Windows, natnet_enable=1).

**Expected:** After `peer:joined`, NG runs `enumerate()` fire-and-forget. Within ~1-3s, every `localMenus/*Range` topic re-publishes with real device lists (retain=1). Topics for backends not applicable on macOS (jack, wasapi) keep their `0` placeholder.

**Observed (Activity Log excerpt, NG peer `9jiaphYcrKyqcKQ48DtB4L`):**

```text
14:25:44.193 join → publishInitSequence (all localMenus at -default-/0, ug_enable=0)
14:25:44.195 PUB r settings/localProps/ug_enable 1                                   ← UV present
14:25:44.592 PUB r settings/localMenus/textureCaptureRange name='Simple Server'
14:25:44.671 PUB r settings/localMenus/coreaudioCaptureRange 158 NDI Audio|100 BlackHole 16ch|…|61 Hauptgeraet
14:25:44.681 PUB r settings/localMenus/portaudioReceiveRange 0 NDI Audio (0; Core Audio)|4 MacBook Pro Microphone (0; Core Audio)
14:25:44.682 PUB r settings/localMenus/coreaudioReceiveRange 100 BlackHole 16ch|…|61 Hauptgeraet
14:25:44.689 PUB r settings/localMenus/portaudioCaptureRange 0 NDI Audio (2; Core Audio)|4 MacBook Pro Microphone (1; Core Audio)|5 MacBook Pro Speakers (0; Core Audio)|7 NDI Audio (0; Core Audio)
14:25:44.843 PUB r settings/localMenus/ndiRange NX-41545 (Test Patterns)
```

Platform gating held: `jackCaptureRange`, `jackReceiveRange`, `wasapiCaptureRange`, `wasapiReceiveRange` stayed at `0` (not re-published). `ug_enable` flipped `0` → `1` within ~2ms of init.

All retained publishes echoed back to NG's own subscription on `/peer/<ngId>/settings/#`, confirming the broker retained them. Max (subscribed to `/peer/<ngId>/#` via `peers:remote:joined`) receives the same retained values on its side by broker contract.

**Deviation — textureCaptureRange format cross-check:** Max's own `textureCaptureRange` was observed as `-default-|name='Spout Sender'` (sentinel prefixed to the list). NG emits the bare list (`name='Simple Server'`) without the `-default-` prefix. This matches spec §8 ("empty → `0`, pre-enum → `-default-`, else the list"). The `-default-|…` prefix appears to be a Max-side idiosyncrasy, not a contract requirement. Flagged for M2b parsing on the consumer side.

---

## Case 5 — Subscription narrowing (spec §4.6)

**Why:** M1 used the prohibited wide pattern `/peer/{id}/#`. M2a (Task 20) narrows to the three allowed patterns for own-peer, and keeps wide for remote peers.

**Steps:**
1. On NG: clean `rack.json` (delete) and restart so there are no retained device subscriptions from a prior session.
2. Connect + join the room.
3. Immediately after `peer:joined`, inspect the Activity Log for `SUB` lines.
4. Load an OSC device on channel 0.
5. Inspect Activity Log for the per-channel `SUB` that follows the `loaded 1` echo.

**Expected for own peer:**
- `SUB /peer/<ngId>/settings/#`
- `SUB /peer/<ngId>/rack/+/+/loaded`
- After loading a device on channel 0: `SUB /peer/<ngId>/rack/page_0/channel.0/device/#`
- **NO** `SUB /peer/<ngId>/#` line.

**Expected for remote (Max) peer:**
- `SUB /peer/<maxPeerId>/#` on `peers:remote:joined` (wide is still correct for remotes).

**Result:** ✅ pass

Fresh rack state (rack.json deleted), joined room as peer `kZaBmFyGQUf8qiCpUrfg75`. Max peer `nA2kFJJFPcFjHRCawxGX8R` present in room.

Own-peer SUBs (narrow, per spec §4.6):

```
SUB /peer/kZaBmFyGQUf8qiCpUrfg75/settings/#
SUB /peer/kZaBmFyGQUf8qiCpUrfg75/rack/+/+/loaded
SUB /peer/kZaBmFyGQUf8qiCpUrfg75/rack/page_0/channel.0/device/#   ← after OSC load on ch.0
```

No `SUB /peer/kZaBmFyGQUf8qiCpUrfg75/#` (wide pattern) emitted at any point.

Remote-peer SUB (wide is correct for remotes):

```
SUB /peer/nA2kFJJFPcFjHRCawxGX8R/#
```

---

## Case 6 — Rack restore, localMenus/localProps excluded

**Why:** Task 21 — `settings/localMenus/*` and `settings/localProps/*` must not round-trip through `rack.json` (they're local-machine state). Device state must survive close/reopen.

**Steps:**
1. Starting from a clean state (rack.json deleted), load a StageControl device on channel N.
2. Configure: set `outputIPOne`, `outputPortOne`, toggle `enableTwo=1`, set `outputIPTwo`, `outputPortTwo`.
3. Quit NG cleanly (Cmd+Q → broker leaves → app exits).
4. Locate `rack.json` at `~/Library/Application Support/telemersive-gateway-ng/rack.json` and open it in a text editor.
5. Verify keys present and absent:
   - **Present:** `rack/page_0/channel.N/loaded`, `rack/page_0/channel.N/device/gui/localudp/outputIPOne`, `.../enableTwo`, `.../outputIPTwo`, `.../outputPortTwo`, `.../outputPortOne`, `.../inputPort`.
   - **Absent:** any key starting with `settings/localMenus/` or `settings/localProps/`.
6. Relaunch NG, rejoin the same room.
7. Verify within ~1s of `peer:joined`: channel N populates with the StageControl device, all configured values restored, `enableTwo=1` restored, `outputIPTwo` restored.

**Expected:**
- `rack.json` contains device-subtree keys only.
- On restart, the StageControl channel reappears with all configured fields.
- Enumeration fallback publishes happen independently and are visible as `pub` lines for `settings/localMenus/*` (with `-default-` / `0` values), but those never reach `rack.json`.

**Result:** ✅ pass

Configured OSC device on ch.0 with `enableTwo=1` and custom `outputIPOne=10.0.0.1`, `outputIPTwo=10.0.0.1` (ports left at defaults). Quit NG cleanly. `rack.json` contents:

```json
{
  "rack/page_0/channel.0/loaded": "1",
  "rack/page_0/channel.1/loaded": "0",
  "... (channels 2-19 all 0)": "",
  "settings/lock/enable": "0",
  "settings/background/color": "0.7660 0.8200 0.2800 1",
  "rack/page_0/channel.0/device/gui/localudp/peerLocalIP": "10.21.6.128",
  "rack/page_0/channel.0/device/gui/localudp/enableTwo": "1",
  "rack/page_0/channel.0/device/gui/localudp/inputPort": "10009",
  "rack/page_0/channel.0/device/gui/localudp/outputIPOne": "10.0.0.1",
  "rack/page_0/channel.0/device/gui/localudp/outputIPTwo": "10.0.0.1",
  "rack/page_0/channel.0/device/gui/localudp/outputPortOne": "10008",
  "rack/page_0/channel.0/device/gui/localudp/outputPortTwo": "10007",
  "rack/page_0/channel.0/device/gui/localudp/reset": "0",
  "rack/page_0/channel.0/device/gui/monitor/log": "0",
  "rack/page_0/channel.0/device/gui/monitor/monitorGate": "0",
  "rack/page_0/channel.0/device/gui/description": "OSC",
  "rack/page_0/channel.0/device/gui/enable": "0",
  "rack/page_0/channel.0/device/gui/inputIndicator": "0",
  "rack/page_0/channel.0/device/gui/outputIndicator": "0"
}
```

Verified:

- **Present:** all 14 device-subtree keys for ch.0 with user edits intact (`enableTwo=1`, `outputIPOne=10.0.0.1`, `outputIPTwo=10.0.0.1`). Global peer settings (`settings/lock/enable`, `settings/background/color`) also persisted — correct per spec.
- **Absent:** NO keys starting with `settings/localMenus/` or `settings/localProps/`. Task 21's exclusion filter in `isRackEligibleTail` works as intended.
- **Restore:** relaunched NG, rejoined room, opened ch.0 panel — all configured values restored within ~1s of `peer:joined`.

---

## Summary

| Case | Subject | Result |
|------|---------|--------|
| 1 | Picker shows 4 tiles (OSC+StageC bright, UG+MoCap greyed) | ✅ |
| 2 | StageControl load — NG creates, Max observes | ✅ |
| 3 | StageControl config round-trip + relay | ✅ (after fixing 2 bugs + adding indicators) |
| 4 | Enumeration visibility | ✅ (re-run 2026-04-20 post-T24) |
| 5 | Subscription narrowing to spec §4.6 | ✅ |
| 6 | Rack restore, localMenus/localProps excluded | ✅ |

**M2a full acceptance:** all six cases green.

**Observations / bugs found (fixed during this test session):**

1. `DeviceRouter.unloadChannel` bypassed `trackedPublish` — stale `retainedTopics` caused subsequent loads to skip `publishDefaults`. Fixed in `2e28cbb`.
2. OSC relay used wrong room RX port (`11<N>8` instead of `11<N>9`) and bound on local IP instead of broker host — RX never worked. Rewrote as single-socket per device with DNS-resolved broker host + source-IP dispatch. Fixed in `1e14fcc`.
3. `inputIndicator`/`outputIndicator` were never pulsed during traffic — arrows never animated. Added 150ms-debounced pulses in `1e14fcc`.

**Post-test actions:**

- [x] Record final commit SHA tested: `1e14fcc` (OSC relay + indicators on top of `2e28cbb` router fix on top of `71d27a7` m2a T22+T25).
- [ ] When UV is installed: install → set `UG_PATH` if needed → run Tasks 23 + 24 → re-run Case 4 → mark M2a complete in the plan doc.
