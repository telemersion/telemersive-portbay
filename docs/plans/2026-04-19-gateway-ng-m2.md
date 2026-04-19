# Telemersive Gateway NG — M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (M2a):** Expose the full device-type picker — OSC and StageControl selectable, UltraGrid and MoCap visible but greyed — populate the local-device enumeration (texture/capture/audio/NDI) required by §8 so UltraGrid (M2b) has the data it needs, narrow subscriptions to the spec §4.6 pattern, and exclude volatile local menus/props from rack persistence.

**Goal (M2b, addendum — drafted after M2a ships):** Implement the UltraGrid device handler (§5.5, §8, §9.6) end-to-end: CLI spawn/kill lifecycle, full §9.6 panel with mode-gated rendering, enumeration-sourced dropdowns, rack persistence, interop gate against Max.

**Architecture note:** M2 does not touch the echo-driven core; it extends the device-type vocabulary, adds local-environment enumeration on the main side, and refines the renderer's picker UX. Enumeration runs once on `peer:joined` (not every rack load) and again on demand when the user opens an UltraGrid dropdown — see §8.1 / §8.4. Enumeration output lands in retained `settings/localMenus/*` and `settings/localProps/*` topics that all peers read.

**Tech stack:** no new dependencies. Adds Node's `child_process.spawn` (in M2b only). UV discovery uses env `UG_PATH` with sensible platform defaults.

**Spec reference:** `docs/spec.md` §4.6, §5.3, §5.5, §7.1, §8, §9.3, §9.6, §13.

**Milestone map:**
- M0 + M1 — done (see [2026-04-16-gateway-ng-m0-m1.md](2026-04-16-gateway-ng-m0-m1.md) and [2026-04-16-gateway-ng-m0-m1-progress.md](2026-04-16-gateway-ng-m0-m1-progress.md))
- **M2a** — enumeration + AddDevicePopup + StageControl + subscription narrowing + rack filter (this plan)
- **M2b** — UltraGrid device end-to-end (addendum section below, fleshed out before implementation starts)
- M3-M5 — separate plans after M2 ships

---

## Locked scope decisions (from inquisition 2026-04-19)

| # | Question | Answer |
|---|---|---|
| 1 | Milestone split | **B** — M2a (enumeration + picker + StageC + subscription/rack fixes) shipped first; M2b (UltraGrid) as separate sub-milestone |
| 2 | Enumeration trigger | **A** — run once on `peer:joined`, plus on-demand `updateMenu` when user opens an UG dropdown |
| 3 | UV binary discovery | **A** — `UG_PATH` env var, then platform defaults (`/Applications/UltraGrid.app/…` on mac, `%PROGRAMFILES%\UltraGrid\…` on win, `/usr/local/bin/uv` on linux); fail soft |
| 4 | Enumeration failure mode | **A** — publish `-default-` / `0` fixtures (same placeholder contract as init sequence §7.1), log warning, UI shows empty dropdown gracefully |
| 5 | Parser testing strategy | **A** — capture golden fixtures from a known UV version on macOS, unit-test parsers against them; re-capture on UV upgrades (memory: UltraGrid CLI parsing) |
| 6 | AddDevicePopup scope | **A** — 4 tiles: OSC (enabled), StageControl (enabled), UltraGrid (greyed in M2a, enabled in M2b), MoCap (greyed throughout M2) |
| 7 | StageControl integration | **A** — reuses OscPanel.vue; no new panel component |
| 8 | M2a interop gate | **A** — 6-case interop doc against Max (picker, StageC load, StageC config, enumeration visibility, subscription narrowing, rack restore) |
| 9 | Subscription narrowing | **A** — switch to the three narrow patterns from spec §4.6 (settings, loaded, per-channel device-on-demand), remove the wide `/peer/{id}/#` |
| 10 | CLI builder approach (M2b) | **C** — hybrid: transliterate CLI builder core from `tg.ultragrid.js`, clean-rewrite panel bindings |
| 11 | UV fixture timing | **A** — capture golden UV fixtures from Max/current UV install before M2b implementation begins |
| 12 | UG lifecycle (M2b) | **A** — full §8.8: crash → enable=0 + log; stderr → monitor/log; kill-on-quit in shutdown |
| 13 | UG interop gate (M2b) | **B** — 4 cases: audio+video × modes {1=UDP, 4=RTP} (2/5/7 deferred to a later plan) |
| 14 | UG panel conditional rendering | **A** — full §9.6 coverage (all 5 modes, connection × transmission × network branches) |
| 15 | UG rack persistence | **A** — identical to OSC (every retained device-subtree mutation hits rack.json via the existing `trackedPublish` path) |
| 16 | Enumeration timing on `peer:joined` | **A** — enumerate synchronously-after-join (blocks nothing but delays first-published `localMenus/*` by up to 1-2s); publish placeholders immediately, replace when enumeration completes |
| 17 | Scope boundaries — Windows/Linux enumeration | **B** — macOS paths first-class; Windows/Linux behind `spawnCli` abstraction with stubs; real Windows/Linux testing deferred |
| 18 | Plan document structure | **C** — one plan for M2a now, M2b added as an addendum section after M2a interop passes |

---

## File structure (M2a additions/changes)

```
src/
  main/
    enumeration/
      index.ts                — orchestrator: enumerate() runs all backends, publishes results
      spawnCli.ts             — thin wrapper around child_process.spawn; macOS/Linux/Windows branches (Win stubbed)
      parsers/
        textureCapture.ts     — parses `uv -t help` / v4l/avfoundation output
        ndi.ts                — parses `uv -t ndi:help`
        portaudioCapture.ts   — parses `uv -s portaudio:help` (capture side)
        portaudioReceive.ts   — parses `uv -r portaudio:help` (playback side)
        coreaudioCapture.ts   — macOS only; `uv -s coreaudio:help`
        coreaudioReceive.ts   — macOS only
        wasapiCapture.ts      — Windows only; stubbed in M2a, real in M2b if needed
        wasapiReceive.ts      — Windows only; stubbed in M2a
        jackCapture.ts        — parses `uv -s jack:help` (linux primary)
        jackReceive.ts        — parses `uv -r jack:help`
      topics.ts               — maps parser output → settings/localMenus/* and settings/localProps/* topics
    index.ts                  — (edited) narrow subscriptions, exclude localMenus/* + localProps/* from rack, kick enumeration on peer:joined
    persistence/
      rack.ts                 — (edited) exclusion filter in buildRackSnapshot
  renderer/
    components/
      AddDevicePopup.vue      — new — 4-tile device picker (§9.3)
      DeviceCell.vue          — (edited) emit 'open-popup' on +-click instead of hardcoded loaded=1
      panels/
        OscPanel.vue          — (edited) title switches "OSC"/"StageControl" based on deviceType (loaded value)
tests/
  main/
    enumeration/
      parsers/
        textureCapture.test.ts   — golden-fixture-based
        ndi.test.ts
        portaudio.test.ts
        coreaudio.test.ts
        jack.test.ts
      spawnCli.test.ts           — mocks child_process
  renderer/
    components/
      AddDevicePopup.test.ts     — render + emit tests
tests/fixtures/
  ultragrid/
    uv-1.9-macos-texturecapture.txt
    uv-1.9-macos-ndi.txt
    uv-1.9-macos-portaudio-capture.txt
    uv-1.9-macos-portaudio-receive.txt
    uv-1.9-macos-coreaudio-capture.txt
    uv-1.9-macos-coreaudio-receive.txt
    uv-1.9-linux-jack-capture.txt
    uv-1.9-linux-jack-receive.txt
docs/logs/
  m2a-interop-test.md            — new; 6 cases
  m2-uv-fixture-notes.md         — new; UV version captured, date, command lines, known-diffs log
```

---

## M2a — Enumeration + Picker + StageControl + Subscription Narrowing

### Task 20: Subscription narrowing (§4.6) 🔧 short

**Files:**
- Edit: [src/main/index.ts](../../src/main/index.ts) — replace the wide subscribe on `peer:joined`

**Why first:** independent of the rest of M2a, closes a spec-deviation flagged in the M1 progress report, and makes the interop test in Task 26 meaningful.

- [ ] **Step 1: Replace the wide own-peer subscribe.**
  In [index.ts:180](../../src/main/index.ts#L180) currently `bus!.subscribe(\`/peer/${localPeerId}/#\`)` — replace with:
  ```ts
  bus!.subscribe(topics.settingsSubscribe(localPeerId))
  bus!.subscribe(topics.loadedSubscribe(localPeerId))
  ```
  `deviceSubscribe` is already added per-channel by DeviceRouter on `loaded > 0`, so no additional own-peer subscribe is needed.

- [ ] **Step 2: Verify remote-peer subscribes still use wide.**
  `peers:remote:joined` handler in [index.ts:201-203](../../src/main/index.ts#L201-L203) stays wide — that's correct (§4.6 allows wide reads of remote peers; the prohibition is only against wide reads of *own* peer).

- [ ] **Step 3: Manual smoke test.**
  Build, connect to room with a Max peer, create an OSC device, verify channel topics (`device/gui/*`) still flow into the UI and device router (they arrive via the per-channel `deviceSubscribe`, triggered by DeviceRouter.handleLoaded).

- [ ] **Step 4: Commit.** `m2a(task20): narrow own-peer subscription to spec §4.6`

**Gate:** UI must still update for own-peer device state changes after the narrowing.

---

### Task 21: Rack-persistence exclusion filter 🔧 short

**Why:** rack.json must hold device state only. `settings/localMenus/*` and `settings/localProps/*` are enumeration output — they come from the local machine on every boot, so persisting them causes stale-on-move issues (peer on different hardware restores the wrong menu contents). Spec §6.6 specifies rack persistence covers device subtree, not local-environment settings.

**Files:**
- Edit: [src/main/index.ts](../../src/main/index.ts) — `buildRackSnapshot` must exclude the two subtrees.

- [ ] **Step 1: Add exclusion filter in `buildRackSnapshot`.**
  Current implementation at [index.ts:27-37](../../src/main/index.ts#L27-L37) slices `/peer/{id}/` and snapshots everything. Add:
  ```ts
  if (tail.startsWith('settings/localMenus/')) continue
  if (tail.startsWith('settings/localProps/')) continue
  ```
  (`tail` is the post-prefix string; apply after the `slice`.)

- [ ] **Step 2: Also filter out at restore.**
  In `publishInitSequence` the rack restore at [index.ts:132-137](../../src/main/index.ts#L132-L137) replays what was saved; since filter runs on save, nothing to do at restore — but add a safety-skip for forward-compat if a user imports an old rack.json.

- [ ] **Step 3: Unit test.**
  Add a `buildRackSnapshot` unit test case that asserts `localMenus/*` and `localProps/*` values never appear in the snapshot (requires light refactor — either export the helper or round-trip via `scheduleRackSave`/`loadRack`).

- [ ] **Step 4: Commit.** `m2a(task21): exclude localMenus and localProps from rack persistence`

**Gate:** `rack.json` after close/reopen contains only device-subtree keys; `settings/localMenus/portaudioCaptureRange` etc. are re-published by init sequence and enumeration, not restored from disk.

---

### Task 22: spawnCli helper + thin enumeration scaffolding

**Files:**
- Create: [src/main/enumeration/spawnCli.ts](../../src/main/enumeration/) — runs a CLI, collects stdout/stderr, resolves on exit.
- Create: [src/main/enumeration/index.ts](../../src/main/enumeration/) — `enumerate(peerId, publish)` orchestrator.
- Create: [src/main/enumeration/topics.ts](../../src/main/enumeration/) — maps parser output → topic names/values.
- Create: [tests/main/enumeration/spawnCli.test.ts](../../tests/main/enumeration/).

- [ ] **Step 1: `spawnCli(binary, args, options)` API.**
  Returns `Promise<{ stdout: string; stderr: string; exitCode: number | null }>`. Hard timeout (default 5s). Never throws on non-zero exit — resolves with the code and captured output so parsers can decide. Platform dispatch:
  ```ts
  function resolveUgPath(): string | null {
    if (process.env.UG_PATH) return process.env.UG_PATH
    if (process.platform === 'darwin') return '/Applications/UltraGrid.app/Contents/MacOS/uv'
    if (process.platform === 'linux') return '/usr/local/bin/uv'
    if (process.platform === 'win32') return null  // stubbed M2a; filled in M2b if needed
    return null
  }
  ```
  If resolution returns `null` or the binary doesn't exist, `spawnCli` rejects with a typed error so `enumerate` can publish fallback fixtures.

- [ ] **Step 2: `enumerate()` orchestrator.**
  Signature: `enumerate(peerId: string, publish: (retained: 0|1, topic: string, value: string) => void): Promise<void>`.
  Runs all platform-applicable backends in parallel via `Promise.allSettled`. Each backend:
  1. Calls `spawnCli` with its `-t <backend>:help` (or `-s <backend>:help` / `-r <backend>:help`) args.
  2. Passes stdout to its parser.
  3. Publishes the parser output to `settings/localMenus/<backendRange>` or `settings/localProps/<prop>` via `publish`.
  4. On parse/spawn failure: publishes the fallback placeholder (`-default-` or `0`) and logs a `logEvent({kind: 'warn', ...})`.

- [ ] **Step 3: `topics.ts` mapping.**
  Centralise topic names so parsers just emit `{range: '...comma-separated...', count: N}` structures and `topics.ts` formats them. Mirror the existing placeholder init set from [index.ts:118-130](../../src/main/index.ts#L118-L130).

- [ ] **Step 4: Unit test spawnCli.**
  Mock `child_process.spawn`, verify: timeout rejects, missing binary rejects, non-zero exit resolves with code, stdout/stderr captured correctly.

- [ ] **Step 5: Commit.** `m2a(task22): add spawnCli + enumeration orchestrator scaffolding`

**Gate:** `enumerate()` can be called with a no-op publish stub; does not throw even if UV is missing.

---

### Task 23: Per-backend parsers (macOS first-class, golden fixtures)

**Files:**
- Create: all files under [src/main/enumeration/parsers/](../../src/main/enumeration/parsers/).
- Create: all fixtures under [tests/fixtures/ultragrid/](../../tests/fixtures/ultragrid/).
- Create: parser test files under [tests/main/enumeration/parsers/](../../tests/main/enumeration/parsers/).
- Create: [docs/logs/m2-uv-fixture-notes.md](../logs/) — record UV version, date, commands.

**Per project memory (UltraGrid CLI parsing):** UV stdout format is version-dependent; fixtures must be re-captured on UV upgrades. Lock the fixture set to a single known UV build for M2a.

- [ ] **Step 1: Capture golden fixtures.**
  On macOS dev machine, with the same UV build Max currently uses, run each probe command by hand and save stdout to [tests/fixtures/ultragrid/](../../tests/fixtures/ultragrid/). Record the exact UV version in [docs/logs/m2-uv-fixture-notes.md](../logs/m2-uv-fixture-notes.md). Probe commands (verify against §8 of spec and `docs/javascript/tg.ultragrid.js` during implementation):
  - `uv -t help` → textureCapture (the catch-all capture-device list)
  - `uv -t ndi:help` → NDI
  - `uv -s portaudio:help` → portaudioCapture
  - `uv -r portaudio:help` → portaudioReceive
  - `uv -s coreaudio:help` → coreaudioCapture (macOS)
  - `uv -r coreaudio:help` → coreaudioReceive (macOS)
  - `uv -s jack:help` → jackCapture (linux)
  - `uv -r jack:help` → jackReceive (linux)

- [ ] **Step 2: Write one parser per backend.**
  Each parser is a pure `function parse(stdout: string): { range: string; count: number }` that extracts the list of device names from the block of CLI help output. Keep parsers narrow — they handle exactly one backend's output format.

- [ ] **Step 3: Golden-fixture unit tests.**
  For each parser, load the fixture, assert the expected `range` string matches. Fixture files and test files live side-by-side so a UV upgrade that breaks parsing fails loudly.

- [ ] **Step 4: Wasapi + Windows stubs.**
  `wasapiCapture.ts` / `wasapiReceive.ts` implemented but return `{ range: '0', count: 0 }` when called; real implementation deferred until Windows testing begins. The orchestrator skips them on non-Windows platforms.

- [ ] **Step 5: Commit.** `m2a(task23): add per-backend UltraGrid enumeration parsers with golden fixtures`

**Gate:** Running `npm run test tests/main/enumeration/parsers` passes against captured fixtures. A manual `node -e "import('./out/main/enumeration').then(...)"` after a build shows parser output matches raw CLI output.

---

### Task 24: Wire enumeration into `peer:joined` + on-demand refresh

**Files:**
- Edit: [src/main/index.ts](../../src/main/index.ts) — call `enumerate()` from the `peer:joined` handler after `publishInitSequence`.
- Edit: [src/preload/index.ts](../../src/preload/index.ts) — expose `enumerate:refresh` IPC.
- Edit: [src/main/index.ts](../../src/main/index.ts) — add `enumerate:refresh` ipcMain handler.

**Approach (Q2=A, Q16=A):** publishInitSequence already emits `-default-` / `0` placeholders for every `localMenus/*` topic — that's the immediate pre-enumeration state the UI sees. Enumeration runs async after join, replaces each topic with the real value as soon as its parser returns.

- [ ] **Step 1: Fire enumeration from `peer:joined`.**
  After `publishInitSequence()` call, invoke:
  ```ts
  enumerate(localPeerId, (retained, topic, value) => trackedPublish(retained, topic, value))
    .catch((err) => logEvent({ kind: 'error', message: `enumerate failed: ${err.message}` }))
  ```
  Fire-and-forget (don't block the join flow).

- [ ] **Step 2: Add `enumerate:refresh` IPC.**
  `ipcMain.handle('enumerate:refresh', async () => { if (localPeerId) await enumerate(...) })`. Used by the UltraGrid panel (M2b) when the user opens a capture/audio dropdown.

- [ ] **Step 3: Preload whitelist.**
  Add `enumerate:refresh` to the invoke whitelist in [src/preload/index.ts](../../src/preload/index.ts).

- [ ] **Step 4: Smoke test.**
  Connect to a room, wait ~2s, check the Activity log shows `pub settings/localMenus/portaudioCaptureRange <non-default>`. Verify `settings/localMenus/jackCaptureRange` still stays `0` on macOS (platform-gated).

- [ ] **Step 5: Commit.** `m2a(task24): run device enumeration on peer:joined + enumerate:refresh IPC`

**Gate:** `docs/logs/m2a-interop-test.md` Case 4 (enumeration visibility) passes — Max can read NG's `settings/localMenus/*` and sees real device lists.

---

### Task 25: AddDevicePopup.vue — device-type picker (§9.3)

**Files:**
- Create: [src/renderer/components/AddDevicePopup.vue](../../src/renderer/components/).
- Edit: [src/renderer/components/DeviceCell.vue](../../src/renderer/components/DeviceCell.vue) — emit `open-popup` with the cell coordinates on `+` click (both empty-cell `empty-plus` and occupied-cell `cell-plus`), instead of today's hardcoded `emit('add', 1)`.
- Edit: [src/renderer/views/MatrixView.vue](../../src/renderer/views/MatrixView.vue) — host the popup, manage its open state, publish `loaded` on selection.
- Edit: [src/renderer/components/panels/OscPanel.vue](../../src/renderer/components/panels/OscPanel.vue) — title switches between "OSC" and "StageControl" based on the `loaded` value.
- Create: [tests/renderer/components/AddDevicePopup.test.ts](../../tests/renderer/components/).

- [ ] **Step 1: Popup layout — 4 tiles.**
  Tiles in grid: OSC (loaded=1), StageControl (loaded=4), UltraGrid (loaded ∈ {2,3,5}; greyed in M2a — M2b will wire up a sub-picker for the three UG variants), MoCap (loaded=6; greyed throughout M2). Each tile uses the same color palette as [DeviceCell.vue:23-29](../../src/renderer/components/DeviceCell.vue#L23-L29).

- [ ] **Step 2: Positioning.**
  Popup anchors to the clicked cell (absolute-position by `getBoundingClientRect` on click). Closes on: click outside, Esc, selection.

- [ ] **Step 3: Emit selection.**
  `defineEmits<{ select: [deviceType: number] }>()`. Parent (MatrixView) receives → calls `onAddDevice(peerId, channel, deviceType)` → publishes `loaded` with the chosen value.

- [ ] **Step 4: Lock + remote enforcement.**
  If target peer is not local OR is locked, don't open the popup at all. The existing cell logic already hides `+` in those cases; add a guard in MatrixView anyway.

- [ ] **Step 5: OscPanel title.**
  Add a `deviceType` prop (or read `loaded` from `deviceState`) and swap the panel header between "OSC" / "StageControl". All other fields stay identical — OSC and StageControl share the same UDP-relay config surface (per M1 §5.4 + M1 progress Task 14).

- [ ] **Step 6: Vitest component tests.**
  Render popup, assert 4 tiles present, assert OSC tile clickable → emits `select(1)`, assert UG/MoCap tiles have the greyed class and don't emit on click.

- [ ] **Step 7: Commit.** `m2a(task25): add AddDevicePopup with OSC/StageControl selectable`

**Gate:** Visually: click `+` on an empty local cell → popup shows 4 tiles → click StageControl → cell fills, panel opens titled "StageControl", device relay works identically to OSC.

---

### Task 26: M2a cross-client interop test

**Files:**
- Create: [docs/logs/m2a-interop-test.md](../logs/).

**Format:** same structure as [m1-interop-test.md](../logs/m1-interop-test.md) — preconditions, case-by-case procedure with expected/observed, summary table.

**Preconditions:**
- M2a merged to current branch and built (`npm run build`).
- `rack.json` deleted to start clean.
- Broker retained state cleared for test peer.
- Max gateway running (same broker, same room).
- Activity Log open in NG.

**6 cases:**

- [ ] **Case 1: Picker shows 4 tiles.**
  On NG: click `+` on empty local cell. Assert OSC and StageControl are bright/clickable; UltraGrid and MoCap are visible but greyed.

- [ ] **Case 2: StageControl load — NG creates, Max observes.**
  On NG: pick StageControl from popup. Expected: NG publishes `loaded=4`, Max sees the channel populate in its matrix view, device description reads "StageC" on both sides.

- [ ] **Case 3: StageControl config round-trip.**
  On NG: open the panel, set `outputIPOne` to `127.0.0.1`, set `inputPort`, enable. Expected: Max sees the same values; NG's relay forwards traffic as in the M1 OSC tests.

- [ ] **Case 4: Enumeration visibility.**
  On NG: wait for enumeration to complete (~1-3s after join). On Max: inspect NG's retained `settings/localMenus/portaudioCaptureRange` (via broker introspection tool or Max's retained-topic viewer). Expected: the value is a comma-separated list matching macOS's portaudio devices (not `0` or `-default-`).

- [ ] **Case 5: Subscription narrowing — no own-peer wide sub.**
  On NG: open broker-side subscription log (MQTT broker admin). Verify NG's client subscribes to `/peer/{ngId}/settings/#`, `/peer/{ngId}/rack/+/+/loaded`, and per-channel `/peer/{ngId}/.../device/#`, but NOT `/peer/{ngId}/#`.

- [ ] **Case 6: Rack restore after close.**
  With a StageC device loaded and configured, close NG cleanly. Reopen. Expected: channel populates with the StageC device, same config, within ~1s of `peer:joined`. Verify `rack.json` does NOT contain `settings/localMenus/*` keys.

- [ ] **Log observed results, call out any deviations, commit the log.**

**Gate for M2a-complete:** all 6 cases pass (or deviations are documented and accepted).

---

## M2a file-by-file summary

| File | Action | Size |
|---|---|---|
| [src/main/index.ts](../../src/main/index.ts) | edit (3 spots: narrow subs, rack filter, kick enumeration) | ~+20 lines |
| [src/main/enumeration/index.ts](../../src/main/enumeration/) | new | ~80 lines |
| [src/main/enumeration/spawnCli.ts](../../src/main/enumeration/) | new | ~50 lines |
| [src/main/enumeration/topics.ts](../../src/main/enumeration/) | new | ~30 lines |
| [src/main/enumeration/parsers/*.ts](../../src/main/enumeration/parsers/) | new (8 files) | ~25 lines each |
| [src/preload/index.ts](../../src/preload/index.ts) | edit (add `enumerate:refresh`) | ~+1 line |
| [src/renderer/components/AddDevicePopup.vue](../../src/renderer/components/) | new | ~120 lines |
| [src/renderer/components/DeviceCell.vue](../../src/renderer/components/DeviceCell.vue) | edit (emit `open-popup`) | ~+5 lines |
| [src/renderer/views/MatrixView.vue](../../src/renderer/views/MatrixView.vue) | edit (host popup) | ~+20 lines |
| [src/renderer/components/panels/OscPanel.vue](../../src/renderer/components/panels/OscPanel.vue) | edit (title switch) | ~+5 lines |
| tests/ | new (parser tests + popup test + spawnCli test) | ~400 lines |
| tests/fixtures/ultragrid/ | new (8 captured CLI outputs) | N/A |
| [docs/logs/m2a-interop-test.md](../logs/) | new | ~100 lines |
| [docs/logs/m2-uv-fixture-notes.md](../logs/) | new | ~30 lines |

Total new/edited: ~1100 lines of code + ~130 lines of docs.

---

## M2b — UltraGrid Device End-to-End (addendum — drafted before M2b starts)

**Scope (summary — detailed breakdown to follow in addendum):**
- **CLI builder:** transliterate the core `ugCommandLine` construction from [docs/javascript/tg.ultragrid.js](../javascript/tg.ultragrid.js) into TypeScript; clean-rewrite the panel-to-state bindings (not a literal port) (Q10=C).
- **Panel:** full §9.6 rendering — all 5 `network/mode` values {1=UDP, 2=UDP_KA, 4=RTP, 5=RTP_KA, 7=RTP+SRT}; conditional connection × transmission × network sections; all enumeration-sourced dropdowns wired via `useMqttBinding` to `settings/localMenus/*` (Q14=A).
- **Lifecycle:** full §8.8 — crash → `enable=0` + log event; stderr streamed to `monitor/log` topic; kill-on-quit added to `performShutdown`; SIGTERM → SIGKILL grace ~500ms (Q12=A).
- **Rack persistence:** identical to OSC — every retained device-subtree topic mutation goes through `trackedPublish` and hits `rack.json` via the debounce already in place (Q15=A).
- **Interop gate:** 4 cases against Max — {audio, video} × {mode=1 UDP, mode=4 RTP}. Modes 2/5/7 deferred to M2c or a later plan (Q13=B).
- **Device types:** `loaded ∈ {2, 3, 5}` all route to the UltraGrid handler; the popup's UG tile opens a sub-picker for the three UG variants.
- **Fixtures:** golden UV stdout captured before M2b starts and pinned in [docs/logs/m2-uv-fixture-notes.md](../logs/) (Q11=A).

**M2b will add roughly:**
- `src/main/devices/UltraGridDevice.ts` (~250 lines)
- `src/main/devices/ultragrid/cliBuilder.ts` (~150 lines)
- `src/renderer/components/panels/UltraGridPanel.vue` (~400 lines for full §9.6)
- `src/renderer/components/panels/UltraGridSubPicker.vue` (small — choose between the 3 UG variants from the popup)
- Tests for cliBuilder (golden expected-command strings keyed to input state)
- `docs/logs/m2b-interop-test.md` (4 cases)
- Edit: `AddDevicePopup.vue` to un-grey UG tile and open the sub-picker.
- Edit: `shutdown.ts` for child-process kill-on-quit.

**M2b prerequisites (must be true before starting):**
1. M2a merged, interop passing, logged.
2. UV fixtures captured and pinned.
3. Max-source UG command lines documented for 4 interop cases (audio × video × mode {1,4}) — grab these from a running Max session.
4. Addendum section of this plan fleshed out into a task-level breakdown (similar granularity to M2a Tasks 20-26).

---

## Appendix A — Enumeration topic map

Topics published by `enumerate()`. All retained. Values are `-default-` / `0` before first enumeration completes, real device lists afterward.

| Topic tail (after `/peer/{id}/settings/`) | Source | Fallback |
|---|---|---|
| `localMenus/textureCaptureRange` | `uv -t help` | `-default-` |
| `localMenus/ndiRange` | `uv -t ndi:help` | `-default-` |
| `localMenus/portaudioCaptureRange` | `uv -s portaudio:help` | `0` |
| `localMenus/coreaudioCaptureRange` | `uv -s coreaudio:help` (macOS) | `0` |
| `localMenus/wasapiCaptureRange` | `uv -s wasapi:help` (Windows) | `0` |
| `localMenus/jackCaptureRange` | `uv -s jack:help` (Linux) | `0` |
| `localMenus/portaudioReceiveRange` | `uv -r portaudio:help` | `0` |
| `localMenus/coreaudioReceiveRange` | `uv -r coreaudio:help` (macOS) | `0` |
| `localMenus/wasapiReceiveRange` | `uv -r wasapi:help` (Windows) | `0` |
| `localMenus/jackReceiveRange` | `uv -r jack:help` (Linux) | `0` |
| `localProps/ug_enable` | UV binary discoverable? | `0` |
| `localProps/natnet_enable` | natnet library discoverable? | `0` |

Off-platform topics keep the fallback value published by `publishInitSequence` — enumeration simply skips them.

---

## Appendix B — Notes for M2b drafting

When drafting the M2b addendum, re-read:
- spec §5.5 (UltraGrid device semantics)
- spec §8 in full (enumeration contract + CLI conventions)
- spec §8.8 (child-process lifecycle)
- spec §9.6 (panel rendering rules — mode-gated sections)
- [docs/javascript/tg.ultragrid.js](../javascript/tg.ultragrid.js) (~828 lines; the ~80 `ugf_*` setters are the single source of truth for command-line construction)
- [docs/mockups/color_scheme.html](../mockups/color_scheme.html) for UG panel styling consistency with OSC panel

Key open questions to resolve in the addendum:
- Exact `loaded` value → UG variant mapping (2/3/5 semantics — settle from spec §5.5 + tg.ultragrid.js).
- Which of the ~80 ugf_* setters are mode-1/mode-4 relevant (rest can be no-ops in M2b and filled in later milestones).
- Whether `kill-on-quit` needs a separate graceful-stop message sent to UV before SIGTERM.
- Monitor topic schema: is `monitor/log` append-stream or latest-line-only? (Check §5.5 + M1 impl.)
