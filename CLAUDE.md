# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — electron-vite dev server (main + preload + renderer with HMR).
- `npm run build` — production build into `out/` (consumed by electron-builder via [electron-builder.yml](electron-builder.yml)).
- `npm run typecheck` — `vue-tsc --noEmit` across main + renderer (project uses `tsconfig.node.json` + `tsconfig.web.json` refs).
- `npm test` — full vitest suite.
- Single test: `npx vitest run tests/main/devices/OscDevice.test.ts` (or `-t "pattern"` to filter cases).
- Parser-only: `npx vitest run tests/main/enumeration/parsers`.
- `scripts/capture-uv-fixtures.sh` — re-capture UltraGrid CLI fixtures into `tests/fixtures/ultragrid/<version>/` when a new `uv` build is vendored. Must be run any time UV is upgraded — parsers are version-coupled (see "UltraGrid parsers" below).

## Architecture

Electron + Vue 3 + TypeScript app that is a drop-in replacement for the Max MSP "Telemersive Gateway". It is a **protocol-frozen** peer in a telemersive-bus room — the MQTT data-plane topics, values, retain flags, and `APPVERSION` (`TeGateway_v0612` in [busClient.ts](src/main/busClient.ts)) match the Max gateway bit-for-bit so mixed Max/NG rooms work. The authoritative design doc is [docs/spec.md](docs/spec.md).

### Process split and IPC

- **Main** ([src/main/](src/main/)) owns the single `mqtt.js` client (wrapped via `telemersive-bus`) and all child-process device handlers (UltraGrid `uv`, OSC relays, later NatNet).
- **Renderer** ([src/renderer/](src/renderer/)) reconstructs the full room state tree from the raw MQTT stream forwarded over IPC. Renderer never opens its own MQTT socket.
- **IPC bridge is intentionally thin** ([src/preload/index.ts](src/preload/index.ts)): `mqtt:message` (main→renderer for every received topic), `mqtt:publish` (renderer→main), plus bus control events (`bus:join`, `bus:leave`, `peers:remote:joined`, etc.). `peerName` arrives on the control channel only, never on MQTT — see §6.2 of the spec.

### Echo-driven execution

Every UI interaction publishes retained to the broker, then is re-received as an echo, and only *then* acted on by the device router. Local and remote publishes take the same code path — a remote peer editing your channel is structurally indistinguishable from you editing it. Consequences:

- No publish gate / `recentlySent` map.
- UI interactions have a broker RTT (50–200ms on the public broker).
- Broker outage = no local control. Running CLIs keep running (UDP media is broker-independent), but you can't toggle `enable`.

### Channel state machine

Per-peer, per-channel, in main. See [deviceRouter.ts](src/main/deviceRouter.ts).

- `loaded` is the **device-type discriminator**, not a boolean: `0`=empty, `1`=OSC, `2`=UltraGrid, `3`=MoCap (deferred), `4`=StageControl (reuses the OSC handler — see §5.4 of the spec).
- `description` is a user-editable label that defaults to the type name. Router dispatches on `loaded`, never `description`.
- On `loaded>0` for the **local** peer's subtree, the handler publishes the full device subtree (IPs, allocated ports, defaults, `enable 0`) then subscribes to `device/#`. Remote peers create devices on the local peer by publishing only `loaded=N` — the target fills the subtree itself (see §5.2.1).
- On `loaded=0`, the handler unsubscribes and publishes empty-payload retained clears for every topic it authored during its lifetime (tracked per-handler, not hard-coded). See `DeviceHandler.teardown()` in [devices/types.ts](src/main/devices/types.ts).
- Current milestone (**M2b**) ships OSC + UltraGrid only. NatNet/StageC handlers are not wired — the router returns `null` for those types.

### Port allocation — two port spaces

Device relays bridge **two distinct port spaces** (see [portAllocator.ts](src/main/portAllocator.ts)):

- **Local ports** always prefixed `10` (e.g. `10009`) — stable across rooms so external apps (Max patches, OSC tools) aren't broken when the user rejoins a different room. Only these are published via MQTT.
- **Room ports** prefixed by the numeric `roomId` from `bus peer room id` (e.g. `11009` for roomId=11). Used only for peer↔proxy UDP traffic. Never published — every peer derives them locally from `roomId + channelIndex + slot`.

OSC/StageC use slots `7/8/9` (outputPortTwo/outputPortOne/inputPort). UltraGrid uses slots `2/4` (video/audio, Max formula `-P{p}:{p}:{p+2}:{p+2}`). OSC's two-socket relay topology is non-obvious — see the dedicated memory file if you need to modify it.

### Rack persistence

- Local rack state is persisted to `<userData>/rack.json` via [persistence/rack.ts](src/main/persistence/rack.ts), settings to `settings.json` via [persistence/settings.ts](src/main/persistence/settings.ts).
- Every `trackedPublish()` in [main/index.ts](src/main/index.ts) that touches a `/peer/{ownPeerId}/...` retained topic mutates an in-memory `retainedTopics` map and schedules a debounced save (500ms).
- **Leave sequence** (not the same as quit): flush save → **suppress further saves** → `deviceRouter.destroyAll()` (which publishes retained clears that would otherwise re-arm the save with an empty rack) → lift suppression → `bus.leave()`. See [main/index.ts](src/main/index.ts) `ipcMain.handle('bus:leave', ...)`.
- **Quit sequence** runs [shutdown.ts](src/main/shutdown.ts): flush save, kill all children, publish empty retained to every tracked topic to clear broker state, then bus disconnect.
- Ephemeral `peerId` is regenerated every session — the restore path rewrites saved topics under the new `peerId` before republishing.

### MQTT subscription pattern

From [main/index.ts](src/main/index.ts) on `peer:joined`:

1. Own peer narrow: `settings/#` + `rack/+/+/loaded`.
2. Per-channel `device/#` added when `loaded>0`, removed when `loaded=0` (driven by the router).
3. Remote peers: wide `/peer/{remoteId}/#` on `peers:remote:joined`, unsubscribed on `peers:remote:left`. NG-specific simplification vs Max — wire-compatible because NG only *receives* more, doesn't publish extra.

### UltraGrid parsers are version-coupled

UV's stdout format changes silently between versions; bad parses yield stale FPS/volume indicators with no visible error. Rule: when `vendor/ultragrid/active/` is swapped, run `scripts/capture-uv-fixtures.sh`, commit new fixtures under `tests/fixtures/ultragrid/<version>/`, and rerun parser tests. [src/main/enumeration/parsers/](src/main/enumeration/parsers/) are fixture-driven and must match the active UG version. Relevant fixtures are tracked even though `vendor/ultragrid/*/` itself is gitignored.

### Renderer state shape

Two reactive structures, joined by `peerId` at render time (see [renderer/state/](src/renderer/state/)):

- `peerState.peer[peerId]` — reconstructed from the MQTT stream; includes unknown-topic fallback records so unfamiliar Max or future topics don't break reconstruction.
- `roster[peerId]` — populated from bus control events; carries `peerName` and bus-only identity. A peer is "visible" only when it exists in `roster`; orphan `peerState` entries stay un-rendered briefly in case the roster event is in flight.

Topic strings are built exclusively through [src/shared/topics.ts](src/shared/topics.ts) helpers. Never concatenate topic strings inline.

## Conventions

- **TypeScript strict everywhere** (main and renderer). Wire values are strings; typed accessors parse at the read boundary, not the write boundary, so malformed values from a buggy peer remain faithfully representable.
- **Never `v-model` directly on a `useMqttBinding` value** — the binding is a `computed` (readonly). Use `:value="binding.value"` + `@change="binding.set(...)"`. Programmatic echoes re-render silently; only user interaction publishes.
- **Lock state is a gentleman's agreement** — UI-only; main-process handlers do not enforce it. A rogue peer can bypass. This is an accepted consequence of the "match Max protocol" stance (§5.5 of spec).
- **No auto-respawn on CLI crash** — publish `enable 0` retained, tail stderr to the monitor log, wait for the user to re-toggle. Silent respawn masks real problems.
- **Trust the protocol in handlers** — if a config topic arrives while `enable=1`, update state silently. The UI lock prevents this in practice; handlers don't need defensive enforcement.
