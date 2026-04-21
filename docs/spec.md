# Telemersive Gateway NG — v1 Specification (Draft)

Status: working draft, derived from inquisition session against `context.md`,
revised against primary sources in `docs/wiki/`, `docs/mockups/`, `docs/logs/`,
and `docs/javascript/`. Companion to `context.md` — that document captures
protocol/UI details from the prior design conversation; this document captures
the **decisions** made on top of it. Where the two conflict, this document wins.

Outstanding items are listed in §13 as TBDs with proposed defaults. Items
confirmed against primary sources are marked **[verified]** with citation.

---

## 1. Goals and Tiebreaker

NG addresses three goals, in priority order when they conflict:

1. **Stack migration (primary tiebreaker).** Replace Max MSP with Electron + Vue 3 + Node.js. Ship feature parity with the current Max gateway.
2. **UX improvements.** Where Max imposed artificial limits or ergonomic friction, NG removes them when cheap. Not a redesign.
3. **Ecosystem.** The MQTT protocol is the public contract. NG is the first NG client; future clients (web, headless) speak the same protocol.

**Tiebreaker rule:** when two goals conflict on a specific decision, **goal 1 wins by default.** Goal 1 has a concrete finish line (parity with Max); goals 2 and 3 are open-ended. Override only with explicit reason; document overrides where they occur.

---

## 2. Scope

### 2.1 In Scope for v1.0

**Milestone scope note [2026-04-21]:** v1.0 covers all four device types below, but
**M2b ships only OSC + UltraGrid**. NatNet/MoCap and StageControl handlers are
deferred to a later milestone — their absence is *expected scope*, not a spec
gap. Until those handlers land, `natnet_enable` and `stagec_enable` are
published as `0` unconditionally, and `loaded=3` (MoCap) / `loaded=4` (StageC)
values from remote peers are rendered read-only in the matrix without local
spawn behavior.

- All four device types: **OSC**, **UltraGrid**, **NatNet/MoCap**, **StageControl**.
- Full remote control of other peers' channels (matrix-wide editing, subject to lock state).
- Login flow against telemersive-router (mirroring telemersive-bus's `configure → connect → join` sequence).
- Cross-platform: **macOS and Windows** only.
- Single-room operation per app instance.
- Channel count uncapped; floor of 20 (see §6.4).

### 2.2 Out of Scope for v1.0

- **Linux.** No Linux binaries shipped; no testing.
- **Multi-room** (multiple rooms simultaneously per app instance). Switching rooms = leave + rejoin.
- **Chat.** Max has it; NG ignores incoming chat and never publishes it. Mixed-room users wanting chat must use a Max client. Deferred to v1.x.
- **NG-only protocol features.** No new topics that Max peers don't understand (see §3.4 for the one exception: NG can publish to `channel.N>=20` but Max won't render those).
- **Auto-rejoin on launch.** Pre-fill last credentials; user clicks Join.
- ~~**Persisting per-channel device configs.**~~ **[resolved 2026-04-16 — moved to in-scope]** NG persists the full local rack on quit and restores on launch, matching Max. See §6.6.
- **Capability-announcement layer (NG↔NG feature negotiation).** Sketched in §3.5; deferred to v1.x.

---

## 3. Protocol Posture

### 3.1 Bit-for-bit Parity with Max

The MQTT data plane (`/peer/{id}/rack/...` and `/peer/{id}/settings/...` subtrees) is **frozen against the Max gateway's behavior.** NG implements exactly what Max publishes: same topics, same value encodings, same retain flags, same enum values.

The eight "open questions" in `context.md` §7 are reframed as **archaeology tasks**, not design tasks. They are answered by reading Max patchers, telemersive-bus source, and capturing live MQTT traces — not by inventing.

### 3.2 Control Plane is Inherited

The telemersive-bus npm package owns the control plane (room creation/destruction, peer join/leave, room-access protobuf messages, manager last-will cleanup). NG depends on telemersive-bus and does not reimplement these.

### 3.3 APPVERSION

- v1.0 NG declares `TeGateway_v0612` **[verified 2026-04-16 — confirmed current]** ([maxBusClient.js:1](docs/javascript/maxBusClient.js#L1)). If a newer Max release ships before NG v1.0, NG must be re-pinned to match.
- Effect: NG and Max peers can join the same rooms; the manager accepts both.
- Pre-release blocker: cross-client compatibility test for every device type, both directions (Max publishes → NG consumes; NG publishes → Max consumes).
- Post-v1.0 evolution: NG peers may publish `/peer/{id}/meta/capabilities` (or similar) so NG-only features light up only when all visible peers are NG-capable. Designed when needed.

### 3.4 Channel Count

- `context.md` §4.1 says "20 channels." Max enforces this in its UI but the protocol does not.
- NG **publishes `channel.N/loaded 0` for N=0..19 on join** (parity with Max's startup behavior; observed in trace).
- NG renders columns dynamically: `max(20, highest_loaded_channel_number + 1, +2 trailing empty "add" columns)`. Union across all peers visible in the room. Horizontal scroll handles overflow.
- A peer may load `channel.42` and publish state under it. Max peers ignore high-numbered channels (no UI column for them); NG peers render them.
- **Pre-release blocker:** test in a mixed room that NG publishing `channel.20+` does not destabilize a Max peer (best case: silently ignored).

**Operational ceiling — switchboard port pre-allocation [verified 2026-04-16]:** the broker-side switchboard opens ports only for channels 00..19 per room (§8.7). CLI spawns on channel ≥20 will have no switchboard-opened ports available. For v1.0, NG may *display* channels ≥20 in the matrix (and other NG peers may publish state under them), but **enabling a device on channel ≥20 will not produce working media traffic** until the switchboard is extended (up to ~100 channels in theory; not planned for v1.0). NG does not block channel ≥20 creation in the UI — it's a silent operational limit, documented, not enforced. Add a warning in the matrix header if any peer has `loaded>0` on channel ≥20.

### 3.5 NG-only Features in Mixed Rooms

When NG publishes capabilities Max cannot render (e.g., channels above 19), the spec rule is:

- NG features that work cross-client publish to the canonical Max protocol.
- NG features that exceed Max's UI capacity may publish anyway; Max degrades gracefully (silent ignore).
- NG must never publish a *malformed* canonical topic that a Max peer would mis-parse. If NG cannot publish a value Max understands, it does not publish to the canonical topic.

### 3.6 App Lifecycle **[verified 2026-04-16]**

**Window-close vs quit:**

- **macOS:** closing the main window hides it; app stays in the dock. Cmd-Q / Quit menu triggers full shutdown. Matches platform convention and Max's behavior.
- **Windows / Linux:** closing the main window triggers full shutdown (no tray icon in v1 — keeps build/notarization simple; revisit if users request background running).
- **No "minimize to tray while in a room" escape hatch.** Any close/quit path while joined runs the full shutdown sequence below. Rationale: easy to forget an active session and leak broker state.

**Full shutdown sequence (triggered by Quit on any OS, or window-close on Windows/Linux):**

1. **Persist local rack** to `rack.json` (§6.6) and settings to `settings.json` (§6.3).
2. **Kill all child processes** (SIGTERM, then SIGKILL after short grace).
3. **Clear retained topics** for the local peer's entire subtree: publish empty payload, retain=1, to every topic the app has published this session (the handler-tracked list from §5.2.2 plus the settings topics from §7.1). This is the inverse of §6.6 restore — retained state is owned by the live session; on quit, the broker should hold nothing for a peerId that no longer exists.
4. **`Client.leave()`** then **`Client.disconnectServer()`** via telemersive-bus.
5. Exit process.

**Crash / force-quit.** If the process dies without running step 3 (OS kill, hardware fault), retained topics remain on the broker. The next launch gets a fresh peerId (§6.1), so stale retained topics under the dead peerId never collide with the new session. They age out via broker TTL / room-cleanup policy (broker-side; outside NG's concern). Local rack restore (§6.6) still works because `rack.json` is written on every mutation, not only on quit — confirm §6.6 reflects write-on-mutation at next pass.

### 3.7 Leaving a Room (without quitting)

`bus:leave` is distinct from app shutdown: the process keeps running and can
re-join another room afterward. Ordering matters because the rack save reflects
*retained topic state*, and device teardown publishes retained clears that
would otherwise corrupt the saved rack.

**Leave sequence (triggered by the renderer's leave action):**

1. **Flush pending rack save** to `rack.json` synchronously — captures the
   rack as the user sees it, before any teardown publishes land.
2. **Suppress further rack saves** for the duration of the teardown. Retained
   clears from `destroyAll()` must not re-arm the save scheduler; otherwise
   the debounced write that lands after suppression lifts would overwrite the
   flushed-good rack with an empty one.
3. **Tear down all device handlers** (`destroyAll()`) — kills child
   processes, publishes retained clears for each handler's tracked topics.
4. **Lift suppression.**
5. **`Client.leave()`** via telemersive-bus.

On the next `bus:join`, the rack restore path (§6.6) reads the persisted
`rack.json` and replays retained publishes — the same file written in step 1.

---

## 4. Architecture

### 4.1 Process Topology

One Electron app instance = one peer.

```
Electron app
├── Renderer (Vue 3 + Vite, TypeScript)
│   ├── peerState (typed reactive nested tree)
│   ├── PeerMatrix view + DeviceCell components
│   ├── Device panel components (drawer-presented)
│   ├── useMqttBinding<T>(topic) composable
│   └── Connection / room-picker / join screens
└── Main (Node.js, TypeScript)
    ├── busClient.js  — telemersive-bus wrapper; emits roster events
    ├── mqttBridge.js — single mqtt.js client; pub/sub for data plane
    ├── ipc.js        — thin bridge: forward raw MQTT to renderer; receive publish requests
    ├── topicParser.ts — topic ↔ path[] utilities
    ├── deviceRouter.ts — instantiate/teardown device handlers per channel
    ├── devices/
    │   ├── UltraGridDevice.ts
    │   ├── NatNetDevice.ts
    │   └── OscDevice.ts    — handles `loaded=1` (OSC) and `loaded=4` (StageC) (§5.4)
    ├── enumeration/
    │   ├── menuParsers/{portaudio,coreaudio,jack,wasapi}.ts
    │   └── enumerate.ts — spawns `uv -s/-r {backend}:help`
    └── system/
        ├── networkInfo.ts — local IPs (via telemersive-bus's gatherIPs)
        └── osInfo.ts      — platform → "osx"|"win"
```

### 4.2 Stack

- **Language:** TypeScript everywhere (main + renderer). The MQTT topic schema is a string-typed protocol with ~150 distinct paths; types are the cheapest insurance against silent divergence from Max.
- **Scaffold:** `electron-vite` (alex8088/electron-vite) Vue + TypeScript template. Decision in §13 TBD-1: which packaging tool (electron-builder vs electron-forge) is deferred to release milestone.
- **Renderer bundler:** Vite (via electron-vite).
- **Main bundler:** Vite (via electron-vite, ESM).
- **MQTT client library:** `mqtt.js`.

### 4.3 IPC Bridge — Thin

The IPC bridge between main and renderer carries **raw MQTT traffic only**:

- `ipc.send('mqtt:message', {topic, value})` — main forwards every received MQTT message to renderer.
- `ipc.invoke('mqtt:publish', {topic, value, retain})` — renderer requests publishes.
- `ipc.send('roster:add', {peerId, peerName, ...})` and `roster:remove` — main forwards bus-level peer events. **peerName arrives on this channel only**, never via MQTT (§6.2). On `roster:remove`, the renderer drops the peer from both `roster` and `peerState` in a single handler — no separate subtree-delete IPC is needed since the renderer owns the state tree and `roster:remove` fires at exactly the right moment (§4.6 step 5).

The renderer reconstructs the entire peer state tree from the raw MQTT stream. The main process owns no parsed view of the room state. Device handlers in main parse the subset of topics they need (see §4.5).

This shape preserves a future web client at zero cost: a web client would receive the same raw MQTT stream over WebSocket (or directly via `mqtt.js` browser support against the broker over WSS).

### 4.4 Renderer State

- Two reactive structures in the renderer:
  - `peerState: { peer: Record<PeerId, PeerSubtree> }` — reconstructed from the MQTT stream (settings, rack, device topics).
  - `roster: Record<PeerId, { peerName: string, joinedAt: number, ... }>` — populated from bus-level `roster:add`/`roster:remove` events (§4.3). Carries peerName and any other bus-only attributes.

  UI components join the two by peerId when rendering (e.g., matrix row header reads `roster[peerId].peerName` while device cells read from `peerState.peer[peerId].rack...`). A peer is "visible" when it exists in `roster`; `peerState` entries without a matching roster entry are treated as in-flight and not rendered until the roster entry arrives (or discarded after a short grace period if it never does).
- TypeScript types model the known protocol topics (Section 5 of `context.md` enumerates them; archaeology fills gaps).
- Unknown topics are stored under a `Record<string, string>` fallback at the appropriate node. Nothing breaks if a Max peer publishes an unfamiliar topic; nothing breaks if a future protocol addition arrives.
- Topic strings live in a central `src/renderer/topics.ts` as template-literal types and builder functions. Never concatenate topic strings inline.
- Enum values (e.g. `network/mode`, `connection`, `transmission`, device `type` fields) are named TS types backed by Q4=A archaeology.
- Values on the wire are strings. The state tree stores strings. Typed accessors (`useMqttBinding<T>(topic)`) parse at the read boundary, not the write boundary, so malformed values from a buggy peer remain faithfully representable.
- Reactivity: `reactive()` deep proxy. Tree is up to ~20 peers × ~20 channels × ~30 leaves ≈ 12k values; flag for benchmarking but expected fine.

### 4.5 Main-side Device Handlers

Device execution lives in main, in handler instances scoped per loaded channel. Each handler maintains its own small parsed view of its channel's topics (no shared state tree in main). Lifecycle in §5.

### 4.6 MQTT Client Topology

**Single mqtt.js client in main process.** Renderer never opens an MQTT socket. Rationale: simplifies echo semantics (one publish gate, one subscription set) and matches `context.md` §2.

Subscription pattern **[verified 2026-04-16]** from [creating_4_devices_locally.log](docs/logs/creating_4_devices_locally.log) and [logging_in_to_room_with.log](docs/logs/logging_in_to_room_with.log):

1. On `bus broker connected 1`: nothing yet.
2. On `bus peer joined 1`: subscribe to **own peer, narrow pattern**:
   - `/peer/{ownPeerId}/settings/#`
   - `/peer/{ownPeerId}/rack/+/+/loaded`
3. After receiving `/peer/{ownPeerId}/rack/page_0/channel.N/loaded` with value `> 0`, add per-channel subscription:
   - `/peer/{ownPeerId}/rack/page_0/channel.N/device/#`
   (Unsubscribe on `loaded 0`.)
4. On `bus peers remote joined {name} {peerId} {localIP} {publicIP}`: subscribe **wide** for that peerId:
   - `/peer/{remotePeerId}/#`

   Rationale: NG routes every incoming topic through the renderer's peer-state reconstruction (§4.5) and the main-process device router regardless of subscription shape, so narrowing the remote subscribe yields no functional benefit. Wide avoids per-channel subscribe/unsubscribe bookkeeping for remote peers. This is an **NG-specific simplification** — Max uses a narrow pattern for remote peers (verified 2026-04-16 log trace), but the broker accepts both; wire compatibility is preserved because NG only *receives* more than Max would, it does not publish anything extra.
5. On `roster:remove(remotePeerId)`: unsubscribe from the wide pattern. The `roster:remove` IPC (§4.3) already reaches the renderer, which clears both `roster[peerId]` and `peerState[peerId]` in a single handler — no dedicated subtree-delete IPC.

Own-peer subscriptions remain narrow (steps 2–3) so the per-channel `device/#` unsubscribe on `loaded=0` (§5.2.2) retains its meaning for channels NG owns.

---

## 5. Execution Model

### 5.1 Echo-Driven Execution

NG uses **echo-driven execution.** No publish gate, no `recentlySent` map.

Flow on UI interaction:
1. UI publishes via `ipc.invoke('mqtt:publish', ...)`.
2. Main publishes to broker (retained=true).
3. Broker echoes back (NG is subscribed to its own peer's topics).
4. Main receives the echo and routes it through the device router.
5. Device handler updates its state and, if a trigger fires, executes (spawns CLI / kills CLI / etc.).
6. Renderer also receives the echo via IPC and updates state, causing UI re-render.

Local and remote publishes take the **same code path** at the execution layer. A remote peer modifying your channel is indistinguishable, structurally, from you modifying it yourself.

**Trade-off accepted:** every UI interaction has a broker-RTT delay before local effect (typically 50–200ms on the public broker). Broker outage means you cannot control your own gear. Both are documented showtime risks (§12).

### 5.2 Channel State Machine

Per channel, per peer, in main:

**`loaded` is the device-type discriminator [verified 2026-04-16]** — not a boolean. Observed values:

- `0` = empty slot
- `1` = OSC
- `2` = ultragrid
- `3` = MoCap (NatNet)
- `4` = StageC (StageControl — shares OSC handler per §5.4)

`description` is a **user-editable label**, not the type. It defaults to the device-type name (`OSC`, `ultragrid`, `MoCap`, `StageC`) but users commonly override it with performer names or channel labels (e.g., `Olivia`, `Flowers`, `Roman` observed in the multi-peer trace). NG's device router **must dispatch on `loaded`, not `description`**. `description` feeds the matrix-cell label and breadcrumb only.

State machine:

1. **Idle.** `loaded=0`. No handler. Router buffers the channel's incoming topics until `loaded` arrives with a non-zero value.
2. **Loading.** `loaded ∈ {1,2,3,4}` arrived → router instantiates the handler for that type. Handler absorbs buffered topics into its state. No CLI action yet. **Device-subtree authorship is owner-driven** (see §5.2.1 below).
3. **Live.** Buffered topics drained. Handler listens for triggers:
   - `enable: 0 → 1` → spawn CLI with current state.
   - `enable: 1 → 0` → kill CLI.
   - `reset: 0 → 1` **[verified 2026-04-16]** — only fires while `enable=0`; the UI lock (§5.3) prevents reset mid-stream. Handler performs clear/reset logic **where reset semantics exist**. Reset is **device-type-specific**: OSC/StageControl restore local port allocations and clear IP overrides; UltraGrid has no analogous runtime state that outlives `enable=0` (port allocations are deterministic from `roomId + channelIndex`, config is already in retained topics), so UG has no reset topic or button. If a rogue peer publishes `reset 0→1` while `enable=1`, handlers that implement reset update state silently per §5.3's trust-the-protocol stance.
   - Any other topic: update handler state silently. Effect at next `enable 0→1`.
4. **Re-load.** `loaded` republished with a **different** non-zero value → kill CLI if running, tear down handler, instantiate new handler for the new type. (Republishing the same value is a no-op / state echo.)
5. **Unload.** `loaded` republished as `0` (from any peer). See §5.2.2.

Execution only runs for the local peer's topics. Remote peers' topic changes update UI state in the renderer but do not invoke any device handler.

#### 5.2.1 Device Creation Ownership **[verified 2026-04-16]**

When a peer places a device on **another peer's** channel, the publish is split between the two peers:

- **The creating peer** publishes only **one** topic: `/peer/{targetPeerId}/rack/page_0/channel.N/loaded {type}` (retained).
- **The target peer** (the subtree owner) receives the `loaded>0` echo and **publishes the entire device subtree itself** — every `device/gui/...` default (local IPs, allocated ports, `description`, `enable 0`, indicators). This is why the creating peer does not need to know the target peer's local IP, port allocation (§8.7), or default description.

Observed in [remote_creates_device_on_local.log](docs/logs/remote_creates_device_on_local.log):

1. `22:33:55.735` — remote MoCap peer publishes `rack/page_0/channel.0/loaded 1` into local peer's subtree. Arrives at local peer as `mqtt` echo (no preceding local `publish`).
2. `22:33:55.803` — local peer's handler immediately publishes the full device subtree (~25 topics: `localudp/*`, `monitor/*`, `description OSC`, `enable 0`, indicators) populated with **its own** IP (`192.168.1.101`) and **its own** allocated ports (`10008`/`10007`/`10009`).
3. `22:33:55.808` — local peer then subscribes to `/peer/{ownId}/rack/page_0/channel.0/device/#`. **Subscribe-after-publish ordering** — the local peer does not receive echoes of its own initial publishes (they predate the subscription), so no subscriber-loop concern.
4. `22:33:55.818` — subsequent MQTT arrivals for the device subtree are echoes of step 2, which the handler ignores as idempotent re-sets.

**NG implementation:**

- Router observes `loaded>0` for `/peer/{ownPeerId}/rack/page_0/channel.N/...`:
  1. Instantiate handler for the type.
  2. Handler publishes the device-subtree defaults (retained), including port allocation per §8.7 and local IP.
  3. Handler subscribes to `/peer/{ownPeerId}/rack/page_0/channel.N/device/#`.
- Router observes `loaded>0` for a **remote** peer's subtree: no publishes, no subscribes beyond §4.6 step 3 — UI displays the remote peer's device only after the remote peer echoes its own subtree.
- **Implication for the matrix `+` popup (§9.3):** clicking `+` on a remote peer's empty cell publishes exactly one topic — `/peer/{remoteId}/rack/page_0/channel.N/loaded {type}` — then lets the target fill in the rest.

#### 5.2.2 Device Unload / Teardown **[verified 2026-04-16]**

When `loaded=0` arrives (from any peer), the target peer's handler tears down:

1. Unsubscribe from `/peer/{ownPeerId}/rack/page_0/channel.N/device/#`.
2. **Publish every device-subtree topic with an empty payload, retained**, to clear the broker's retained state. Observed topics cleared per channel: `localudp/peerLocalIP`, `localudp/enableTwo`, `localudp/inputPort`, `localudp/outputIPOne`, `localudp/outputIPTwo`, `localudp/outputPortOne`, `localudp/outputPortTwo`, `localudp/reset`, `monitor/log`, `monitor/monitorGate`, `description`, `enable`, `inputIndicator`, `outputIndicator`.
3. Kill handler instance, release allocated ports back to the pool (§8.7).

Handler's saved topic list (for retention clearing) is the set of topics it itself published in step 2 of §5.2.1 — NG should track this list per handler lifetime rather than hard-coding the device-type schema.

**Cross-peer unload.** A remote peer triggering unload publishes only `loaded 0` to the target's subtree; the target-peer handler owns the retained-clear step as above.

### 5.3 Device Lifecycle (UI-enforced)

User-visible lifecycle for a device on a channel:

1. **Create** → device row appears for all peers (UI). `enable=0`. CLI not spawned.
2. **Configure** → user edits values freely. UI editable. CLI not spawned. `enable=0`.
3. **Enable** → user flips `enable 0→1`. CLI spawns with current state. UI **locks** (all value widgets render disabled/readonly).
4. **Running** → CLI live. Values cannot change because UI is locked.
5. **Disable** → user flips `enable 1→0`. CLI killed. UI unlocks. Returns to step 2.

The lock is a **UI-only affordance.** The main-process handler trusts the protocol — if a config topic change arrives while `enable=1`, the handler updates state silently. No defensive enforcement at the handler.

Consequence: there is no "restart on codec change" edge case. Codec cannot change while enabled.

**Cross-peer enable toggle [verified 2026-04-16]** via [remote_creates_device_on_local.log](docs/logs/remote_creates_device_on_local.log) 22:33:57 and 22:34:00: a remote peer flipped `enable 0→1→0` on the local peer's channel (arriving at local as `mqtt` echoes with no preceding local `publish`). The local handler would have spawned/killed the CLI in response. **Implication:** UI-side lock must also hide/disable the enable toggle on *remote* peers' rows for channels where the target is locked — otherwise any peer can start/stop any other peer's CLI. Enforcement of this ordering is still UI-only.

### 5.4 StageControl (`loaded=4`) — Shares OSC Implementation **[verified 2026-04-16]**

StageControl's device panel and topic shape are **identical to OSC**: `forward to` IP:port(s), `receiving at` local IP:port, enable toggle, reset buttons. NG uses a single shared device handler for both `loaded=1` (OSC) and `loaded=4` (StageC); the two differ only in:

- **Default `description`:** `OSC` vs `StageC` (the 6-char short-name). Both are user-editable per §5.2 — `description` is a label, not the type.
- **Matrix-cell presentation:** different color, identical icon. Per the canonical [color_scheme.html](mockups/color_scheme.html) mockup: OSC uses `#36ABFF`, StageC uses `#FE5FF5`; both render the shared bidi SVG (sink + up arrow + down arrow) unchanged. `context.md` §4.4 / §4.5 are superseded where they conflict.
- **Breadcrumb label:** `... > OSC > ...` vs `... > StageControl > ...` (panel may render the full name; the matrix cell uses the `description` value, which defaults to the short form).
- **Convention:** StageControl's `forward to` destination points at the Open Stage Control app running on the telemersive-broker host (i.e., the broker IP, not a peer IP). NG does not enforce this — the field is free IP:port input — but default/placeholder values in the panel should hint at it.

No separate `StageControlDevice.ts` handler. The OSC handler in `src/main/devices/OscDevice.ts` is instantiated when `loaded ∈ {1, 4}`, and the matrix/panel layer branches on `loaded` for presentation differences.

### 5.5 Lock State (per peer) **[verified 2026-04-16]**

`/peer/{id}/settings/lock/enable` (boolean 0/1, retained). Per-peer global lock.

**The lock is a gentleman's agreement, enforced entirely UI-side on remote peers.** It does not gate any publish at the broker, handler, or bus layer. A well-behaved remote peer observes `lock/enable=1` on a target peer and greys-out that peer's entire row in its own matrix (no `+` on empty cells; config widgets on existing cells rendered disabled; enable/reset toggles disabled). A misbehaving or patched remote peer can publish anything it wants to the locked peer's subtree — and the target peer's handler will obey, per §5.1 echo-driven execution and §5.3 trust-the-protocol.

Scope:

- **Remote peers:** when they observe `lock/enable=1` on a target peer, their UI must disable all widgets on that peer's row — including `+` (§9.3 popup), existing-device `enable` toggles (so remotes can't start/stop the owner's CLI, per §5.3 cross-peer note), and all config fields.
- **Local (owning) peer:** unaffected by its own lock. Can still edit its own rack freely. The lock exists to protect against other peers' fingers, not to lock oneself out.
- **Who can flip the lock:** only the owning peer's UI exposes the toggle. A remote peer *could* publish `/peer/{targetId}/settings/lock/enable 0` to force-unlock (nothing at the broker prevents it), but the remote UI does not expose this affordance — another gentleman's-agreement point.

NG implications:

- The matrix row component reads `peerState.peer[peerId].settings.lock.enable`. When `1` AND `peerId !== ownPeerId`, every interactive widget in that row renders disabled/non-interactive.
- The lock toggle button is rendered only on the local peer's row (`peerId === ownPeerId`).
- Main-process handlers do **no** lock enforcement. A `/peer/{ownId}/rack/.../enable 1` echo triggers CLI spawn regardless of the local lock state, because the local peer's own UI wouldn't have locked the local peer out in the first place.
- Pre-release consideration: a malicious or buggy Max/NG peer in the same room can trivially bypass another peer's lock by crafting publishes. This is an accepted limitation of the Q4=A protocol-frozen stance; escalating to handler-side enforcement would diverge from Max and break cross-client compatibility.

---

## 6. Identity, Persistence, and Settings

### 6.1 peerId

- Generated by telemersive-bus's `BusClient` constructor as a short-uuid (flickrBase58, e.g. `mhvXdrZT4jP5T8vBxuvm75`).
- **Ephemeral per app session.** Regenerated on every app launch.
- Matches Max behavior; avoids retained-state cleanup problems.

### 6.2 peerName

- Free string, user-chosen, passed as the first positional argument to `Client.join(peerName, roomName, roomPwd)`.
- **Transport: control plane only [verified 2026-04-16].** peerName is a bus-level join parameter, **not** a retained MQTT topic. No `/peer/{id}/settings/...` subtopic carries it. Other peers learn it via roster events (`bus peer joined ...`) surfaced by telemersive-bus.
- Implication for NG state: peerName lives in a separate per-peer map (populated from `roster:add`, cleared on `roster:remove`), not in the `peerState` MQTT tree. See §4.4 for how the renderer keeps the two sources joined.
- Persisted locally; pre-fills the join form (§6.5).
- **No uniqueness enforcement** by manager or protocol. NG renders collisions as `peerName (2)` based on join order. Local peer always marked "(you)" regardless of name; structural disambiguation handles the "which one am I" case.

### 6.3 Local Settings File

Stored as JSON in `app.getPath('userData')`:
- macOS: `~/Library/Application Support/telemersive-gateway-ng/settings.json`
- Windows: `%APPDATA%\telemersive-gateway-ng\settings.json`

Contents:
- `peerName: string`
- `peerColor: string` (hex; converted to RGBA floats on publish)
- `brokerUrl: string` — stored as a bare host (e.g. `telemersion.zhdk.ch`), *not* a URL. The main process prepends `mqtt://` when calling telemersive-bus `configureServer()`. The field keeps the legacy name for on-disk compatibility.
- `brokerPort: number`
- `brokerUser: string`
- `brokerPwd: string` *(plain text — see §12 security note)*
- `lastRoomName: string`
- `lastRoomPwd: string` *(plain text)*
- `settingsVersion: number` (for future migrations)

Read at app start. Written on change.

### 6.4 Default peerColor

On first launch, NG computes a default color from `hash(peerId) → HSL hue, fixed S/L`, then persists. User can override in settings. On every join, NG publishes the persisted color to `/peer/{ownPeerId}/settings/background/color` as four space-separated normalized floats `R G B A`, retain=true.

### 6.5 Connection / Join Flow

User-visible sequence:
1. App opens → **connect screen** (broker URL, port, user, password). Pre-filled from settings if present. User clicks Connect.
2. → BusClient `configureServer` then `connectServer`. On `bus broker connected 1`: proceed.
3. **Room picker screen.** Lists rooms received via `bus rooms listing`. Rooms with mismatched APPVERSION show as `(incompatible)` and are not joinable.
4. User selects a room (or types a new room name to create), provides peerName and roomPwd. Clicks Join.
5. → `Client.join(peerName, roomName, roomPwd)`. Wait for `bus peer joined 1`.
6. **Matrix view.** App publishes initial state per §7.1.

**No auto-rejoin on launch.** Always manual.

### 6.6 Local Rack Persistence

NG persists the **local peer's rack state** on quit and restores it on next launch, matching Max's behavior ([Quit.md](docs/wiki/Quit.md)).

**What is persisted:**

- Every `/peer/{ownPeerId}/rack/page_0/channel.N/...` topic the local peer has published during the session (all `loaded`, `description`, `gui/*`, `device/*`, `settings/*` subtopics under the local peer's subtree).
- `/peer/{ownPeerId}/settings/*` (lock, color — the persisted-settings items in §6.3 are superset-compatible).

**What is not persisted:**

- Remote peers' state. NG never writes another peer's subtree to disk. On next launch, remote peer state is reconstructed from the retained broker state as usual.
- Ephemeral peerId (§6.1 — regenerated per session). On restore, the saved topics are rewritten with the *new* peerId before publishing.

**Persistence file:** `app.getPath('userData')/rack.json`, sibling of `settings.json` (§6.3). Plain JSON — a map `{topicTailRelativeToPeer: value}`. Written on app quit (and on a debounced timer during the session as a crash-safety measure).

**Restore flow:**

1. App launches, reads `rack.json` into memory. Does not publish yet.
2. User completes the connect/join flow (§6.5). No auto-republish during connect.
3. On `bus peer joined 1`: NG publishes the §7.1 init sequence.
4. After init completes, NG republishes the restored rack topics under the current session's peerId, in the same order Max would (description → configs → loaded last, so remote peers only see the channel "appear" once all its state is in place). Retain=true.
5. If the user explicitly wants a clean start, a "start empty" option in the join screen skips step 4. (TBD: exact UI — see open questions.)

**Edge case — description/enum drift:** a restored `description` value that NG no longer recognizes (e.g., a future device type removed in a downgrade) is logged and skipped. Same applies to unknown device backend values in menu fields (handled by the §4.4 string-fidelity rule — stored as-is, rendered as "unknown").

---

## 7. Initial Publish Sequence (on join)

After `bus peer joined 1`, NG publishes (matching observed Max trace **[verified]** against [creating_4_devices_locally.log](docs/logs/creating_4_devices_locally.log)):

1. `/peer/{id}/rack/page_0/channel.{0..19}/loaded 0` (retain=1) — 20 channel slots initialized.
2. `/peer/{id}/settings/lock/enable 0` (retain=1).
3. `/peer/{id}/settings/background/color {R G B A}` (retain=1) — persisted color, four space-separated normalized floats.
4. `/peer/{id}/settings/localMenus/{rangeName}` — for each enumerated backend, see §8.
5. `/peer/{id}/settings/localProps/ug_enable {0|1}` (retain=1) — based on `externals/ultragrid/uv` presence.
6. `/peer/{id}/settings/localProps/natnet_enable {0|1}` (retain=1) — based on `externals/natnet/...` presence.

Peer-identity values observed in the trace (not published as separate topics but delivered via bus events — see §7.2).

### 7.2 Bus Events (Control Plane) **[verified 2026-04-16]**

telemersive-bus emits these events (`bubbledUp` in [maxBusClient.js](docs/javascript/maxBusClient.js)) that NG must consume — they never travel via MQTT:

- `bus broker connected {0|1}` — broker TCP state.
- `bus peer joined {0|1}` — local peer join state. `1` = subscription-ready.
- `bus peer id {peerId}` — own peerId (short-uuid).
- `bus peer name {peerName}` — own peerName (echoed after join succeeds).
- `bus peer localIP {ip}` — own local IP (selected by `configureServer`).
- `bus peer publicIP {ip}` — own public IP (discovered).
- `bus peer room name {roomName}` — confirmed room name after join.
- `bus peer room id {numericRoomID}` — room's numeric ID (the `xx` in port formula §8.7).
- `bus peer room uuid {roomUuid}` — room UUID.
- `bus rooms menu clear|append {name}` / `bus rooms listing [name]` / `bus rooms done` — room-list events for the picker.
- `bus peers menu clear|append ...` / `bus peers done` — peer-menu events for roster UI.
- `bus peers remote joined {peerName} {peerId} {localIP} {publicIP}` — remote peer joined. **This is the full roster payload for remote peers — peerName arrives here, never on MQTT (§6.2).**
- `bus peers remote left {peerName} {peerId}` — **verified**: leave sends both name and id. Trigger for subtree-delete.
- `bus ready` — post-init signal.

NG's `busClient.ts` wrapper normalizes these into typed events surfaced to main and forwarded to renderer via the IPC bridge (§4.3).

OSC and StageControl have no `_enable` capability flag in the observed trace; NG does not introduce one.

---

## 8. Device Enumeration

NG must enumerate audio/video devices and publish them as pipe-separated menu strings on `/peer/{id}/settings/localMenus/{rangeName}`. Mirrors the Max patcher's behavior using the same UltraGrid CLI invocations.

### 8.1 CLI Commands

Spawned on join, per backend:
- `uv -s portaudio:help` → `portaudioCaptureRange`
- `uv -s coreaudio:help` → `coreaudioCaptureRange` (macOS only)
- `uv -s wasapi:help` → `wasapiCaptureRange` (Windows only)
- `uv -s jack:help` → `jackCaptureRange`
- `uv -r portaudio:help` → `portaudioReceiveRange`
- `uv -r coreaudio:help` → `coreaudioReceiveRange` (macOS)
- `uv -r wasapi:help` → `wasapiReceiveRange` (Windows)
- `uv -r jack:help` → `jackReceiveRange`

Video sources (`textureCaptureRange`, `ndiRange`) **[resolved 2026-04-21]**:

- `uv -t syphon:help` → `textureCaptureRange` (macOS)
- `uv -t spout:help` → `textureCaptureRange` (Windows)
- `uv -t ndi:help` → `ndiRange`

Parsers are fixture-verified against UG 1.10.3 — see [parsers/textureSender.ts](../src/main/enumeration/parsers/textureSender.ts) and [parsers/ndi.ts](../src/main/enumeration/parsers/ndi.ts). Both backends feed `-default-` when the probe returns no servers or the backend plugin is absent.

### 8.2 Output Format on the Wire

Per-device entry: `{deviceId} {description}`. Multiple entries joined with `|`.

Example: `1 Scarlett 18i8 USB (out: 8 in: 18 Core Audio)|2 NDI Audio (out: 0 in: 2 Core Audio)|...`

Empty result → publish `0`. Pre-enumeration default → publish `-default-`.

### 8.3 Per-backend Parsers

Modular parsers in `src/main/enumeration/menuParsers/`:
- `portaudio.ts` — strips `portaudio:` prefix, removes `(*...*)` default markers, separates output/input channel info.
- `coreaudio.ts` — strips `coreaudio:` prefix, routes Audio block.
- `jack.ts` — strips `jack:` prefix, routes Audio block.
- `wasapi.ts` — strips backslash-escape sequences, captures `(ID:\s{...})` IDs.
- All terminate on `UltraGrid Exit` line in CLI output.

Each parser is fixture-driven testable. Fixtures in `tests/fixtures/uv-output/{platform}/{backend}-{capture|receive}.txt` captured from a real `uv` invocation per platform. Parser tests assert output matches the captured wire format.

### 8.4 `updateMenu` (Max-legacy, not implemented in NG) **[revised 2026-04-21]**

The `/channel.N/device/gui/updateMenu` topic is a Max-era mechanism for triggering a targeted backend re-probe (e.g. value `"audioCapture jack"` → re-spawn `uv -s jack:help` and republish only `jackCaptureRange`). It is a **local-to-peer** trigger — each client observes the topic under its own subtree and re-enumerates its own hardware; no other peer acts on it.

NG does not implement the targeted path:

- Incoming `updateMenu` values are treated as transient — accepted but not acted on. See [config.ts](../src/main/devices/ultragrid/config.ts) `TRANSIENT_SUBPATHS`.
- NG never publishes `updateMenu` itself.
- The UX equivalent is the "Refresh Devices" button in the UltraGrid panel, which calls the blanket `enumerate:refresh` IPC and re-probes all backends (~1–2s on modern hardware). See [UltraGridPanel.vue](../src/renderer/components/panels/UltraGridPanel.vue).

Rationale: the targeted optimization was a Max-era concern. NG's blanket re-probe is fast enough that per-backend routing adds code and UI surface for no measurable gain. If per-backend refresh becomes a user-visible UX need, it's a clean addition on top (parse the value, call a backend-filtered `enumerate()`).

### 8.5 UltraGrid Binary **[revised 2026-04-21]**

UltraGrid is vendored at `vendor/ultragrid/active/` as the CESNET-distributed `uv-qt.app` bundle (macOS; equivalent directory on Windows TBD when that platform is staged). CESNET ships UG as a single bundle containing both the CLI (`uv` wrapper → `uv-real`) and the Qt GUI (`uv-qt` wrapper → `uv-qt-real`) — the two entry points share libs/frameworks via the app bundle structure and are not separable without repackaging. NG spawns only the CLI wrapper — the `uv-qt` GUI is shipped inside the bundle as an inseparable part of the upstream distribution but is never invoked; NG is the GUI.

- **macOS path:** `vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv` — the upstream CLI wrapper (a shell script gating macOS version, which execs `uv-real`).
- **Windows path:** `vendor/ultragrid/active/uv.exe` (CLI) once Windows is vendored. Update this section when the Windows bundle layout is confirmed.
- **Binary version pinned in spec; parsers are version-coupled.** Upgrading UV requires recapturing fixtures and re-verifying parsers.

### 8.6 Child-Process Spawn and Kill **[revised 2026-04-21]**

**Historical context (Max).** On Windows, Max copied `uv.exe` to `uv_tb{index}.exe` for each active channel (observed in [shellHelper.js](docs/javascript/shellHelper.js) and FAQ). The rationale was kill-targeting: Max issued `taskkill /IM uv_tb{index}.exe /F` to terminate a single channel's UV process, and `taskkill /IM` matches by image name — without the per-channel rename, the kill would have terminated *all* UV processes in the room. This was a workaround for Max's toolchain, not a mechanical requirement of Windows.

**NG approach.** NG spawns the stock `externals/ultragrid/uv.exe` / `externals/ultragrid/uv` on both platforms and kills by PID via Node's `child_process` (`child.kill('SIGTERM')` → `SIGKILL` grace). On Windows, Node's `child.kill()` maps to `TerminateProcess` on the specific PID, so there is no need for per-channel renames or `taskkill /IM`. The per-channel copy is *not* carried forward.

- macOS: spawn `externals/ultragrid/uv`, kill by PID (SIGTERM → SIGKILL).
- Windows: spawn `externals/ultragrid/uv.exe`, kill by PID (same pipeline).
- Same applies to NatNetThree2OSC.

**Windows firewall note.** Users who previously approved `uv_tb{N}.exe` entries in Windows Firewall under Max may see a one-time prompt for `uv.exe` when NG first spawns UV. Acceptable — one prompt per install, not per channel.

**Argument quoting.** NG spawns children with `child_process.spawn(binary, args, …)` — no shell, no word-splitting. Each argv element is passed to the child verbatim, so values containing whitespace (e.g. `syphon:name=Simple Server`) work without wrapping. Retained topic values inherited from Max's schema sometimes arrive wrapped in single-quotes (e.g. `app='Simple Server'` in `*Range` menus); NG strips those at the CLI-build boundary in a single pass — see [cliBuilder.ts:22-34](../src/main/devices/ultragrid/cliBuilder.ts#L22-L34). Verified against live `uv` with a regression test — see [uvArgvParsing.integration.test.ts](../tests/main/devices/ultragrid/uvArgvParsing.integration.test.ts). Max's Windows single-→double-quote substitution (from [shellHelper.js](docs/javascript/shellHelper.js)) existed because Max built shell command strings for `cmd.exe`; NG does not, so no substitution is applied.

### 8.7 Port Allocation ("PortRanges V5") **[verified 2026-04-16]**

Port numbers for CLI spawns are derived from the 5-digit pattern `{roomID}{channelBase}{slot}`, where:

- `roomID` = 2-digit room number (e.g. `11`) — the `xx` prefix in the reference diagram.
- `channelBase` = 2 digits derived from the channel index (channel 00 → `00`, channel 01 → `01`, ..., channel 19 → `19`).
- `slot` = 1 digit (0..9) identifying the role within the channel.

**Per-channel slot layout** (channel N, shown with `xx` = roomID, `cc` = channel index zero-padded to 2 digits):

Slots 0..9 are all valid addresses. The grammar groups them by topology:

- `xxcc0 ↔ xxcc1` — paired bidirectional (e.g. MoCap / UG audio).
- `xxcc4 ↔ xxcc8` — paired bidirectional (second pair).
- `xxcc2` — single port (typical input/receive slot for paired-topology devices — e.g. MoCap `inputPort 10012` on channel 1 sits alongside the 0↔1 pair).
- `xxcc6` — single port (one-to-many outbound).
- `xxcc7`, `xxcc8`, `xxcc9` — OSC/StageC triple: `outputPortTwo`, `outputPortOne`, `inputPort` respectively (verified from [remote_creates_device_on_local.log](docs/logs/remote_creates_device_on_local.log) — channel.0 values 10007/10008/10009). On the control channel `cc` (non-user channels), slot 9 may instead carry reserved/control traffic; the context disambiguates.

The abstract grammar describes which slots *can* be paired; the per-device-type assignment below specifies which slots each device actually uses.

**Device-type allocation within a channel** (per the diagram's left column, plus verified log evidence):

- **OSC / StageC:** triple at slots `7, 8, 9` → `outputPortTwo`, `outputPortOne`, `inputPort`. Verified from trace; see "Ports on the wire" subsection below.
- **UltraGrid video/audio:** two ports at slots `xxcc2` (video) and `xxcc4` (audio). Verified from Max capture ([m2b-max-capture-notes.md §165-192](logs/m2b-max-capture-notes.md)): `-P11052:11052:11054:11054` for roomId=11, channel.5 → slots 2 and 4. The `-P{p}:{p}:{p+2}:{p+2}` formula in [tg.ultragrid.js:623](javascript/tg.ultragrid.js#L623) uses a single base port `p` with rx=tx and audio at `p+2`; Max sets `p = xxcc2`. Earlier speculation that UG used the `0↔1` and `4↔8` pairs was wrong — UG needs only two distinct ports.
- **NatNet2OSC / NatNetBridge (MoCap):** paired `xxcc0↔xxcc1` for outputs, single `xxcc2` for input. Verified: channel.1 MoCap → outputPortOne=10010, outputPortTwo=10011, inputPort=10012.

**Reserved channels** (not in the 00..19 matrix):

- **Channel `cc` (control channel):** single port `xx900` and reserved `xx902` slot. Used for room-level control traffic (not a user-visible channel).
- **OpenStageControl:** many-to-many bidirectional, uses the channel-cc slot.

**Worked examples** (roomID=11):

- `ch.0, slot=9` → `11009` (control/reserved).
- `ch.1, slot=2` → `11012` ✓ matches trace.
- `ch.1, slot=4` → `11014`, paired with `11018`.
- `ch.19, slot=9` → `11199`.

**Operational ceiling [verified 2026-04-16]:** the switchboard pre-allocates ports only for channels 00..19 per room. CLI spawns on channel ≥20 have no ports and will not produce media traffic. Extending to ~100 channels is a switchboard-side change, not a gateway change. See §3.4 for NG's UI posture on this limit. The `ch.50 → 11502` I flagged earlier was likely a misreading of the trace; any port I see outside the 0..19 matrix in a real log indicates a bug, not an extended range.

**Ports on the wire [verified 2026-04-16]:**

Per-channel port values are published under `gui/localudp/` as camelCase topics. Verified example:

```text
/peer/j69rXMtG27ANpd83VKhN2D/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
```

Decoding `10038`: roomID=`10`, channelIndex=`03`, slot=`8` (the paired half of `4↔8`). ✓ matches §8.7 scheme.

Known port topics under `/channel.N/device/gui/localudp/` **[verified 2026-04-16]** via [remote_creates_device_on_local.log](docs/logs/remote_creates_device_on_local.log) lines 22:33:55.803:

- `outputPortOne` — primary outbound port (slot 8 per examples below).
- `outputPortTwo` — secondary outbound port (slot 7), present when OSC's "output 2" toggle is enabled.
- `inputPort` — local receive port (slot 9 per example).

Plus non-port companions on the same device row: `peerLocalIP`, `outputIPOne`, `outputIPTwo`, `enableTwo`, `reset`.

Values are raw integer strings on the wire (no JSON wrapping), consistent with §4.4.

NG computes port allocations at channel-load time from `roomID` + channel index and publishes them to these topics. Max likely does the same; verify that Max-published port values round-trip correctly through NG's parser.

**Open: roomID-vs-observed-port discrepancy.** The per-device trace above reports `bus peer room id 11` but the newly-allocated channel-0 ports are `10008`/`10007`/`10009` (leading `10`, not `11`). The earlier [SCRIPT_RX observation](docs/logs/) decodes cleanly as roomID=`10`, channel=`03`, slot=`8` → `10038`. Two possible reconciliations: (a) roomID on the wire is 2-digit zero-padded from a different source than `bus peer room id` (which might be a 1-based room-list index, not the port-prefix roomID); (b) there's a separate lookup. A trace where the same peer reports both its `bus peer room id` and an allocated port at a known channel would pin this down — not a blocker for v1 since NG can replay what Max publishes rather than re-derive.

### 8.8 Child-Process Lifecycle **[verified 2026-04-16]**

Governs `uv.exe` / `uv_tb{N}.exe` (UltraGrid) and `NatNetThree2OSC` child processes spawned by the device handlers in §5.2–§5.3.

**Spawn failure (port conflict, missing binary, bad args).** Exit code ≠ 0 within a short window (~2s) of spawn:

- Publish `/peer/{ownId}/rack/page_0/channel.N/device/gui/enable 0` (retain=1) so the UI reflects reality across all peers.
- Surface the CLI's stderr/stdout tail to the channel's monitor log (`device/gui/monitor/log` — topic shape TBD-11; at minimum write to the renderer's log panel for that channel).
- Do not auto-retry. The user re-toggles `enable 1` to retry, typically after fixing the underlying issue (freeing the port, reconnecting the audio device, etc.).

**Mid-stream crash (CLI running, then dies).** Same policy — treated identically to spawn failure:

- Handler observes the child-process exit event while state has `enable=1`.
- Publish `enable 0` retained → UI shows the channel disabled, error indicator.
- Write exit code + last N lines of stderr to the channel's monitor log.
- No auto-respawn. Rationale: silent respawn masks real problems (bad config, missing hardware, network partition); the Max behavior also does not auto-respawn. If a user wants retry-on-crash they can automate via OSC / external tooling.

**Broker disconnect with running CLIs.** **Keep the CLIs alive.** The CLIs operate on UDP sockets independent of the MQTT control plane — they do not care about broker state. Design intent is resilience: a broker hiccup during a performance must not interrupt media flow.

- Handler retains its in-memory state (what's running, what ports, what config).
- When the broker returns (mqtt.js auto-reconnect fires), NG re-subscribes per §4.6. Retained topics re-sync state. If any `enable` or config topic comes back different from the currently-running CLI's state (unlikely, but possible if another peer edited during the outage), the handler reconciles: config change while `enable=1` is silently absorbed per §5.3; an `enable 1→0` kills the CLI; an `enable 0→1` for an already-running handler is a no-op echo.
- Renderer UI reflects broker disconnect with a banner (per TBD-12), but channel rows keep their last-known state — do not grey out running channels just because the broker went away.

**Port allocation at spawn.** Ports are allocated at §5.2.1 device-creation time (well before `enable 1`); by the time the CLI is spawned, the ports are already published on `gui/localudp/*` and any conflict is between that port and some other process on the host (not between two NG handlers — NG knows its own allocations). Conflict detection is the CLI's responsibility via its own bind error; NG just observes the exit code.

**App-quit shutdown sequence.** See §3.5.

---

## 9. UI

### 9.1 Two-View Structure

- **Matrix view** (always visible): header row + peer rows × channel columns.
- **Device panel** (drawer from right, ~60% width): opens on cell click; matrix remains visible as context on the left. Closes on Esc / explicit close. One panel open at a time.

### 9.2 Matrix Layout

Per `context.md` §4.1, with these clarifications:
- Header row: roomName (colored pill), localIP, publicIP, roomID, peerID.
- Local peer row first, with collapse / lock-toggle / locate buttons.
- Remote peer rows below.
- Column count: `max(20, highestLoadedChannel+1, +2 trailing add-columns)`.
- Locked peers: no `+` affordance on empty cells; `cursor: default`.
- Row colors per `context.md` §4.2; device colors per §4.4; SVG icons per §4.5.

### 9.3 Add-Device Popup

Per `context.md` §4.6. Available from any peer to any unlocked peer. The popup filters offered device types based on the target peer's `localProps/{device}_enable` flags — e.g., a peer with `ug_enable=0` does not appear as an UltraGrid target.

### 9.4 Device Panel Breadcrumb

Per `context.md` §4.7: `{roomName} > {peerName} > {deviceDescription} > channel {N}`. Assembled from separate state values, not from the topic path.

### 9.5 Vue Bindings

All widgets use one-way bind + explicit handler:

```vue
<input :value="binding.value" @change="binding.set($event.target.value)" />
```

Never `v-model` directly on a `useMqttBinding` value (it's a `computed` — readonly). Programmatic state updates (echoes from MQTT) re-render silently; only user interaction publishes. No callback-loop suppression needed at the widget layer.

### 9.6 UltraGrid Panel Conditional Rendering

Per `context.md` §4.8 — section visibility rules based on `connection` × `transmission` × `network/mode`.

Enum values **[verified]** against [tg.ultragrid.js](docs/javascript/tg.ultragrid.js):

- `connection`: `0=send (TX)`, `1=receive (RX)`, `2=both`.
- `transmission`: `0=video`, `1=audio`, `2=video+audio`.
- `network/mode` **[verified]** — wire values are Max dropdown-menu indices including grayed-out section separators:
  - `0` = `---- one to many via router ----` (separator, unselectable)
  - `1` = `send to router`
  - `2` = `receive from router`
  - `3` = `---- peer to peer ----` (separator, unselectable)
  - `4` = `peer to peer (automatic)`
  - `5` = `peer to peer (manual)`
  - `6` = `---- misc ----` (separator, unselectable)
  - `7` = `capture to local`

  Only indices `{1, 2, 4, 5, 7}` appear on the wire. NG's dropdown must preserve these indices for Max compatibility — even if NG's UI renders the menu differently (e.g., grouped sections without numeric separators), the published value must map to the Max index. The NG panel mockup in [ultragrid_panel.html](docs/mockups/ultragrid_panel.html) currently uses a 0–4 enum and must be re-keyed.

Conditional rendering driven by these three axes plus the audio codec / video codec selections. `-none-` and `-default-` are sentinel strings on the wire **[verified]** (sections omitted when all relevant values are sentinel).

---

## 10. Build Order

(Refines `context.md` §8.)

1. Scaffold with `electron-vite` (Vue + TS template).
2. `busClient.ts` wrapper around telemersive-bus; emit roster events.
3. `mqttBridge.ts` + thin IPC bridge.
4. Connection / room-picker / join screens (validates the bus integration end-to-end).
5. `peerState` typed tree + `useMqttBinding<T>`.
6. `PeerMatrix` + `DeviceCell` (display only, no panels).
7. Device enumeration (`enumerate.ts` + parsers + fixtures + tests).
8. OSC device panel — simplest, validates the full publish/echo loop end-to-end.
9. `OscDevice.ts` execution layer.
10. UltraGrid device panel — most complex UI.
11. `UltraGridDevice.ts` execution layer (`child_process` spawn, stdout → log topic).
12. NatNet device panel + `NatNetDevice.ts`.
13. Lock state, peer color publishing, settings persistence wiring.
14. StageControl: routing `description=StageC` through the OSC handler, matrix-cell color/icon, breadcrumb label. No new device handler (§5.4).
15. Cross-client compatibility test pass with a Max peer.
16. Packaging (electron-builder vs forge — TBD-1) and signing/notarization.

---

## 11. Pre-release Blockers

- **Cross-client compatibility test:** for each device type, verify Max ↔ NG works in both directions. Subtle data-plane divergence is the highest-risk class of bug because the APPVERSION match claims compatibility we must actually deliver.
- **Channel.20+ test:** verify NG publishing high-numbered channels does not destabilize a Max peer in the same room.
- **Device enumeration parsers verified against real CLI output** on both macOS and Windows.
- **UltraGrid + NatNet smoke launch** on both macOS and Windows (CLI spawns, stdout streams to log topic, kill on disable works).

---

## 12. Operational Risks (in spec, not buried)

- **Broker latency on every UI interaction.** Echo-driven execution means each click is a broker round-trip before local effect. On the public broker (telemersion.zhdk.ch:3883), 50–200ms is expected. Acceptable for config; sharp during live operation.
- **Broker outage = no local control.** With echo-driven execution, you cannot control your own gear if the broker is unreachable. Spec assumes broker uptime is part of the operational contract for showtime.
- **Plain-text passwords on disk.** `settings.json` contains `brokerPwd` and `lastRoomPwd` in clear. Threat model assumes single-user machines with normal filesystem permissions; **do not run NG on shared accounts or systems with untrusted filesystem access.** Backup/sync tools that include the user-data directory will see passwords; document this for users.
- **No name-uniqueness enforcement.** Two peers in a room may legitimately share `peerName`. Disambiguation is by short peerId on hover and by the "(you)" marker on the local row.
- **Mixed-room data-plane divergence.** APPVERSION match claims compatibility; cross-client testing is the only verification.

---

## 13. Open Items (with proposed defaults)

Resolved TBDs have been removed — their decisions are documented inline in the referenced spec sections, and the decision trail lives in §14 and git history. TBD numbering is preserved (non-contiguous) so prior references remain resolvable.

- **TBD-1:** Packaging tool. Default: defer to release milestone. `electron-vite` defaults to `electron-builder`; switch to `electron-forge` only if notarization/auto-update pain emerges.
- **TBD-11:** Log streaming UX — `monitor/log` volume, history retention in renderer, panel presentation. Inquisition continued.
- **TBD-12:** Error surfacing — broker disconnect, CLI crash, bad config. UI presentation TBD.
- **TBD-13:** Per-OS audio device enumeration on Linux — moot for v1 (Linux out of scope), revisit if Linux added.
- **TBD-14:** Switchboard/proxy interaction — `maxBusClient.js` has a `restartProxy` HTTP hack against `:3591/proxies/` **[verified]**. Whether NG needs this is unclear; defer until a UltraGrid network mode forces the question. Hack is described in [maxBusClient.js:132-163](docs/javascript/maxBusClient.js#L132-L163) as a workaround "until switchboard works fine again."
- **TBD-17:** Channel≥20 UI behaviour. Proposed default: implement dynamic column expansion (§3.4 `max(20, highest+1, +2 trailing)`) and the ≥20 warning badge when switchboard-side support for channel≥20 ports lands. Until then, v1.0 ships with fixed 20-column rendering — any peer publishing under `channel.20+` is **not** rendered by NG (and won't produce media traffic anyway per §8.7 ceiling). Revisit jointly with the switchboard extension.

---

## 14. Decision Provenance

Decisions are numbered by inquisition question (Q1–Q28). Re-litigating a decision should reference its number and the trade-offs originally weighed. The session log lives in conversation history; if needed, a per-decision summary can be extracted on request.

Key irreversible-feeling decisions:
- **Q4=A:** protocol bit-for-bit frozen. Reversing means designing a v2 protocol; not free.
- **Q6=B:** TypeScript everywhere. Reversing means type-stripping the codebase.
- **Q11=A:** single MQTT client in main. Reversing reshapes the bridge.
- **Q13=B:** echo-driven execution. Reversing reintroduces the publish gate.
- **Q18=E:** match Max APPVERSION for v1.0. Reversing splits user base.

All other decisions are reasonably reversible at moderate cost.

---

## 15. Open Questions for the User

Remaining gaps that cannot be closed by further reading — they need your decision, a trace capture, or domain knowledge. Resolved questions (Q-A through Q-H) have been removed; their decisions are documented in the referenced spec sections.

### Q-D'. Port topic shape for enabled devices

Sub-question carried from the original Q-D. Which exact MQTT topic(s) carry the allocated port value(s)? Best guess: `/channel.N/device/gui/port` (single-port) and `/channel.N/device/gui/portIn` + `/portOut` (paired). An OSC or StageC trace with an enabled device would confirm.
