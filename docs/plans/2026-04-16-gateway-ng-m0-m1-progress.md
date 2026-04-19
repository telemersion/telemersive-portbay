# Telemersive Gateway NG — M0 + M1 Progress Report

Companion to [2026-04-16-gateway-ng-m0-m1.md](2026-04-16-gateway-ng-m0-m1.md). The git history was lost when the repo was moved, so this document reconstructs task-by-task completion from a deep read of the current source tree on 2026-04-18.

**Convention:**
- ✅ Done — code exists and matches task intent.
- ⚠️ Done with deviation — functional behavior matches; implementation diverged in a way worth flagging.
- 🟡 Partial — some steps done, others missing.
- ❌ Not done — no code evidence.
- ⏭ Manual — step was a manual test/commit/observation; assume complete unless a blocker is noted.

UI divergences from the plan text are intentional (design work driven by [docs/mockups/color_scheme.html](../mockups/color_scheme.html)) and are functional-equivalent — noted per-task but not counted as incompleteness.

---

## M0 — Spike: Bus-in-Electron + Echo Proof

### Task 1 — Scaffold the Electron + Vue + TS project ✅
[package.json](../../package.json), [electron.vite.config.ts](../../electron.vite.config.ts), [tsconfig.json](../../tsconfig.json), [src/main/index.ts](../../src/main/index.ts), [src/renderer/main.ts](../../src/renderer/main.ts), [src/renderer/App.vue](../../src/renderer/App.vue) all present. `electron-vite` scaffold, Vue 3 + TS, `mqtt` and `telemersive-bus` installed (package.json shows `telemersive-bus ^0.6.13`, `mqtt ^5.10.4`, `vue ^3.5.13`, `electron ^33.2.1`).

### Task 2 — busClient.ts typed wrapper ✅
[src/main/busClient.ts](../../src/main/busClient.ts) (169 lines). `APPVERSION = 'TeGateway_v0612'` pinned. `TBusClient` extends `EventEmitter`, wraps `BusClient` from `telemersive-bus`, parses the full bus-event vocabulary (§7.2): `broker:connected`, `peer:joined/id/name/localIP/publicIP`, `peer:room:name/id/uuid`, `rooms:clear/append/listing/done`, `peers:remote:joined/left`, `peers:clear/append/done`, `ready`, `chat`. `mqtt:message` parsed from the `mqtt` callback.

**Deviation (non-functional):** `publish/subscribe/unsubscribe` are synchronous (no `await`). Plan wrote them `async`. The upstream `mqttClient.publish` is fire-and-forget either way, so no behavior difference.

**Deviation:** `peers:remote:left` emits a `{peerName, peerId}` object. Plan emitted just the `peerId` string. The renderer consumes the object shape — consistent internally.

### Task 3 — IPC bridge (preload + contextBridge) ✅
[src/preload/index.ts](../../src/preload/index.ts) (38 lines). Whitelisted channels: send (`bus:configure`), invoke (11 channels including `mqtt:publish/subscribe/unsubscribe`, `bus:init/connect/disconnect/join/leave/localPeer`, `settings:load/save`), receive (21 channels covering all bus events + `mqtt:message` + `chat`). `contextBridge.exposeInMainWorld('api', ...)` present.

### Task 4 — Spike renderer (connect + echo display) ✅
Absorbed into [ConnectView.vue](../../src/renderer/views/ConnectView.vue) in M1; spike-era shell is gone. Functional equivalent: the connect form publishes via IPC, bus echoes flow back through `window.api.on('mqtt:message', ...)` into the reactive state tree.

### Task 5 — M0 interop test + roomID spike ⏭
Manual test; no code artifact expected. Downstream evidence that it succeeded: `peer:room:id` is consumed by [index.ts:118](../../src/main/index.ts#L118) and threaded into `OscDevice` via `roomId` (see Task 14). [docs/mockups/color_scheme.html](../mockups/color_scheme.html) was produced around this time and fed the matrix/panel styling in Tasks 16–17.

---

## M1 — OSC Device End-to-End

### Task 6 — Topic path builders ✅
[src/shared/topics.ts](../../src/shared/topics.ts) (68 lines) + [tests/shared/topics.test.ts](../../tests/shared/topics.test.ts) (all 10 cases present and passing-shape). Builders: `channelLoaded`, `deviceGui`, `localudp`, `monitor`, `settings`, `deviceSubscribe`, `loadedSubscribe`, `settingsSubscribe`. `parseTopic` returns a discriminated union (`loaded` | `device` | `settings`).

**Deviation (non-functional):** builders return plain `string`, not the template-literal types the plan suggested. Functionally equivalent; loses a sliver of compile-time topic-shape checking.

### Task 7 — Port allocator ✅
[src/main/portAllocator.ts](../../src/main/portAllocator.ts) (29 lines) + [tests/main/portAllocator.test.ts](../../tests/main/portAllocator.test.ts). Implements both `allocateLocalPorts(channelIndex)` (prefix 10) and `allocateRoomPorts(roomId, channelIndex)` per spec §8.7. Slot layout: `outputPortOne=base+8`, `outputPortTwo=base+7`, `inputPort=base+9`.

**Deviation from plan (aligns with project memory):** plan described a single `allocateOscPorts(roomId, channelIndex)`. Actual code splits into local (10xxx) + room ({roomId}xxx) per the OSC device port architecture memory — see [OscDevice.ts:43-44](../../src/main/devices/OscDevice.ts#L43-L44) where both are held. This is a correctness fix, not a regression.

### Task 8 — Reactive state tree ✅
[src/renderer/state/peerState.ts](../../src/renderer/state/peerState.ts) (38 lines) + [src/renderer/state/roster.ts](../../src/renderer/state/roster.ts) (37 lines) + [tests/renderer/state/peerState.test.ts](../../tests/renderer/state/peerState.test.ts) (6 cases). `createPeerState` returns `{ peers, applyTopic, removePeer }`; `createRoster` returns `{ entries, addPeer, removePeer, setLocalPeer }`. Topic path split on `/`, tree built via `ensurePath` helper.

**Deviation:** state not namespaced inside a `peerState.peer[id]` wrapper as the spec sketched — uses flat `peers[id]` instead. Equivalent access shape.

### Task 9 — useMqttBinding composable ✅
[src/renderer/composables/useMqttBinding.ts](../../src/renderer/composables/useMqttBinding.ts) (14 lines). `computed` getter + `set(newValue)` that invokes `mqtt:publish`. Matches the §9.5 one-way-bind pattern.

### Task 10 — Settings persistence ✅
[src/main/persistence/settings.ts](../../src/main/persistence/settings.ts) (49 lines) + [src/main/persistence/rack.ts](../../src/main/persistence/rack.ts) (26 lines). Both use `app.getPath('userData')`. `Settings` covers §6.3 fields with `settingsVersion: 1`. Defaults include the production broker URL `telemersion.zhdk.ch:3883`.

**Note:** `rack.ts` only exposes `loadRack`/`saveRack` — the rack snapshot is built in [index.ts](../../src/main/index.ts) via `trackedPublish` → `retainedTopics` Set. `saveRack` is imported in [shutdown.ts](../../src/main/shutdown.ts) but currently not called (see Task 18).

### Task 11 — ConnectView + RoomPickerView ✅
[ConnectView.vue](../../src/renderer/views/ConnectView.vue) (85 lines) + [RoomPickerView.vue](../../src/renderer/views/RoomPickerView.vue) (96 lines) + [router.ts](../../src/renderer/router.ts) with `createMemoryHistory`. Both views pre-fill from `settings:load`. Connect flow: `bus:configure` → `bus:connect` → on `broker:connected` route to `/rooms`. Join flow: save settings → `bus:join` → on `peer:joined` route to `/matrix`.

**Deviation (non-functional / UX):** no "(incompatible)" badge on APPVERSION-mismatched rooms (spec §6.5 step 3) — `bus rooms listing` doesn't currently surface compatibility per room.

### Task 12 — Initial publish sequence (§7.1) ✅
[index.ts:60-93](../../src/main/index.ts#L60-L93). Publishes in order: 20× `channel.N/loaded 0`, `settings/lock/enable 0`, `settings/background/color` (from saved settings or `generateDefaultColor`), all 10 `localMenus/*` placeholders, `localProps/ug_enable 0`, `localProps/natnet_enable 0`, then rack restore.

**Deviation (non-functional):** publish calls are sync (no `await`). Because `mqttClient.publish` is fire-and-forget, ordering is preserved by JS execution order — no observable drift.

### Task 13 — Device router ✅
[src/main/deviceRouter.ts](../../src/main/deviceRouter.ts) (79 lines) + [devices/types.ts](../../src/main/devices/types.ts). State machine per §5.2: `loaded` value > 0 → factory + `publishDefaults` + subscribe `device/#`; `loaded` changes to a different non-zero → unload + reload; `loaded=0` → `unloadChannel` → unsubscribe + empty-publish every tracked topic + `destroy`. Owner-check via `parsed.peerId !== this.ownPeerId`.

**Missing:** `tests/main/deviceRouter.test.ts` — plan listed it in the file structure but no test file exists.

### Task 14 — OscDevice handler with dgram relay ✅
[src/main/devices/OscDevice.ts](../../src/main/devices/OscDevice.ts) (191 lines) + [tests/main/devices/OscDevice.test.ts](../../tests/main/devices/OscDevice.test.ts) (5 cases passing). `publishDefaults` publishes the 14-topic device subtree (localudp/monitor/gui). `startRelay` uses **two dgram sockets** per the OSC port architecture memory: `sendSocket` binds local `inputPort` → forwards to room proxy; `recvSocket` binds room `outputPortOne` → forwards to local `outputPortOne` (and `outputPortTwo` if `enableTwo`).

**Deviation from plan (aligns with memory/correctness):** plan sketched a single socket. Actual impl is two-socket to relay across the local-ports↔room-ports boundary. Device-type dispatch (`loaded ∈ {1,4}`) shares the same class with `description` defaulting to `'OSC'` or `'StageC'` per §5.4.

**Partial:** `reset` topic handler is a no-op (commented "deferred"). `onTopicChanged` does not publish indicator updates (`inputIndicator`/`outputIndicator`) — indicators remain `'0'` once set. Fine for M1; spec doesn't require live indicators yet.

### Task 15 — Wire device router into main process ✅
[index.ts:121-157](../../src/main/index.ts#L121-L157). Inside `peer:joined`: subscribes `/peer/{id}/#` (wide — see note), constructs `DeviceRouter` with a factory that returns `OscDevice` for `type ∈ {1, 4}` or `null` otherwise, then calls `publishInitSequence()`. `mqtt:message` handler forwards to both renderer and `deviceRouter.onMqttMessage`.

**Deviation from spec §4.6 (behavioral):** subscription uses the **wide pattern** `/peer/{id}/#` rather than the narrow pattern (`/settings/#`, `/rack/+/+/loaded`, + per-channel `device/#` on demand). Spec §4.6 explicitly says "Never subscribe with a wide `/peer/{id}/#` pattern." Works for v1 against Max (Max ignores extra topic traffic from NG's side), but a Max peer may see NG subscribe to topics it wouldn't expect. **Worth revisiting before the M1 cross-client interop test (Task 19).**

Also: `DeviceRouter.handleLoaded` calls `bus.subscribe(topics.deviceSubscribe(...))` on load even though the wide pattern already covers it — redundant but harmless.

### Task 16 — Matrix view (peer rows + device cells) ⚠️
[MatrixView.vue](../../src/renderer/views/MatrixView.vue) (226 lines) + [PeerRow.vue](../../src/renderer/components/PeerRow.vue) (163 lines) + [DeviceCell.vue](../../src/renderer/components/DeviceCell.vue) (200 lines). Matrix renders 20 channel columns, peer rows sorted local-first, sticky peer-info column, horizontal scroll.

**UI divergences from plan (intentional, per [docs/mockups/color_scheme.html](../mockups/color_scheme.html)):**
- **Peer row styling:** tint-derived background + colored left border + colored dot + name tint, computed from the peer's `settings/background/color` floats. Plan showed simpler text-only rows.
- **Device cell iconography:** custom SVG data-flow icons — bidirectional OSC (up+down arrows + sink), TX-only (up arrow), RX-only (down arrow). Arrow stroke/fill responds to `enable`, `inputIndicator`, `outputIndicator`. Plan listed a generic colored square.
- **Device-type color palette** uses the color-scheme's values (`#36ABFF` OSC, `#FFA126` MoCap, `#F0DE01`/`#1BFEE9`/`#00E411` for ultragrid variants) rather than the 3-color palette in the plan text.
- **Cell `+` affordance** is a top-right micro-button (hover-revealed) on occupied cells, not a modal popup.

**Missing:** [AddDevicePopup.vue](../../src/renderer/components/) — file listed in the plan file-structure. Current implementation is a hardcoded "click `+` → publish `loaded=1` (OSC)" in [MatrixView.vue:100-103](../../src/renderer/views/MatrixView.vue#L100-L103) and [DeviceCell.vue:82-87](../../src/renderer/components/DeviceCell.vue#L82-L87). **Acceptable for M1 (OSC-only); required before M2 lands UltraGrid/MoCap.**

### Task 17 — OSC device panel (drawer) ⚠️
[DevicePanel.vue](../../src/renderer/components/DevicePanel.vue) (55 lines) + [OscPanel.vue](../../src/renderer/components/panels/OscPanel.vue) (156 lines). Drawer pinned right 380px, closes on X. Bindings: `enable`, `description`, `outputIPOne`/`PortOne`, `enableTwo`, `outputIPTwo`/`PortTwo`, `inputPort`. Lock rule: `isLocked = !isLocal || isEnabled` — correctly disables all config widgets when enabled (§5.3) or when viewing a remote peer.

**UI divergences from plan (intentional, per [docs/mockups/color_scheme.html](../mockups/color_scheme.html)):**
- Panel uses per-section headers ("Forward to" / "Receiving at"), pill-shaped ON/OFF enable button, description input centered, right-docked drawer with `matrix-view { margin-right: 380px }` push-resize of the matrix. Plan sketch was less refined.
- Breadcrumb renders `{roomName} > {peerName} > {description} > channel {N}` but `roomName=''` is passed from MatrixView (§9.4 says assemble from room state; roomName never threaded through).

**Partial — spec deviations to address:**
- **Esc-to-close:** handler is registered on the panel div with `tabindex="0"`, but the div isn't auto-focused → Esc may not fire. Not verified.
- **`reset` button** not rendered.
- **OscPanel `peerLocalIP`** read directly from `udp.peerLocalIP` (no binding) — read-only display, that's fine.

### Task 18 — Shutdown sequence (§3.6) 🟡
[src/main/shutdown.ts](../../src/main/shutdown.ts) (22 lines) + wiring in [index.ts:260-269](../../src/main/index.ts#L260-L269).

**Implemented:**
- `performShutdown` destroys device router (step 2), clears retained topics (step 3), calls `bus.leave()` then `bus.disconnect()` (step 4).
- `retainedTopics: Set<string>` tracked in `trackedPublish` wrapper ([index.ts:42-52](../../src/main/index.ts#L42-L52)).
- macOS window-close hides the window; quit triggers `before-quit` → `performShutdown` with a 500ms grace then `app.exit(0)`.

**Missing / partial:**
- **Step 1 (persist rack) not executed.** `saveRack` is imported in shutdown.ts but never called. No rack.json is written. `rack.json` restore in [index.ts:87-92](../../src/main/index.ts#L87-L92) will therefore always see an empty file → **§6.6 persistence is non-functional end-to-end**, even though both halves exist.
- **No debounced in-session save** (spec §6.6 says "written on every mutation ... debounced timer during the session as a crash-safety measure").
- **Windows / Linux close-to-quit** not gated — [index.ts:254-258](../../src/main/index.ts#L254-L258) handles `window-all-closed` (quits on non-darwin) which is correct by accident; no explicit cross-platform check.
- **No SIGTERM→SIGKILL grace for child processes** — moot for M1 (no CLIs yet), relevant for M2+.

### Task 19 — M1 interop test ❌
No `docs/logs/m1-interop-test.md` present. Manual test not performed (or not recorded). This is the M1 gate.

---

## Summary

**M0 (Tasks 1–5): complete.** Scaffold, bus wrapper, IPC bridge, connect+echo proof all in place. Task 5 interop evidence implicit (room ID flows correctly into the device handler).

**M1 (Tasks 6–19): mostly complete, with two gaps.**
- **Green:** topics (6), port allocator (7), state tree (8), binding (9), persistence files (10), connect+rooms views (11), init sequence (12), device router (13), OSC device with dgram relay (14), matrix view (16), panel (17). Task 15 wires everything.
- **Deviation worth revisiting:** Task 15 uses a wide subscription pattern that spec §4.6 explicitly warns against. Should be narrowed before Task 19.
- **Incomplete:** Task 18 — rack persistence is plumbed but `saveRack` is never called, so quit/restore doesn't actually round-trip. Easy fix (~5 lines).
- **Not started:** Task 19 — M1 cross-client interop test has not been run (or at least hasn't been logged).
- **Missing file:** [AddDevicePopup.vue](../../src/renderer/components/) — acceptable for M1 (only OSC supported), required for M2.
- **Missing test:** `tests/main/deviceRouter.test.ts`.

**UI divergences** from the plan text are driven by the [color_scheme.html](../mockups/color_scheme.html) design pass and are functional-equivalent refinements (data-flow arrows in cells, tinted peer rows, push-resizing drawer). They don't break spec compliance.

**Recommended next steps, in order:**
1. Call `saveRack(rackSnapshot)` in `performShutdown` — closes §6.6 round-trip.
2. Narrow the own-peer subscription to the §4.6 pattern (remove `/peer/{id}/#`, use the three narrower subscribes).
3. Run Task 19 manual interop test against a Max peer; log results to `docs/logs/m1-interop-test.md`.
4. When starting M2, add `AddDevicePopup.vue` before wiring UltraGrid/MoCap types.
