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
  Tiles in grid: OSC (loaded=1), StageControl (loaded=4), UltraGrid (loaded=2; greyed in M2a — enabled in M2b), MoCap (loaded=3; greyed throughout M2). Each tile uses the same color palette as [DeviceCell.vue:23-29](../../src/renderer/components/DeviceCell.vue#L23-L29).

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

## M2b — UltraGrid Device End-to-End

**Goal:** Implement the UltraGrid device handler (§5.5, §8, §9.6) end-to-end for modes 1 (send-to-router/UDP) and 4 (peer-to-peer-automatic/RTP): CLI spawn/kill lifecycle, full §9.6 panel with mode-gated rendering, enumeration-sourced dropdowns, rack persistence, interop gate against Max. Modes 2/5/7 deferred to M2c.

### Locked scope decisions (from inquisition 2026-04-20)

| # | Question | Answer |
|---|---|---|
| 1 | `loaded` → handler mapping | **A** — `loaded=2` is the only UltraGrid value (single `UltraGridDevice` handler). `=3` MoCap (separate handler, still greyed). No `loaded=5`. The popup's UG tile sets `loaded=2` directly; no sub-picker. |
| 2 | CLI builder scope | **B** — scoped transliteration: only the `ugf_*` setters and `cliADD_*` assemblers that modes 1 + 4 actually touch. Other modes throw a typed error on enable. |
| 3 | Panel rendering scope | **B** — modes 1 + 4 fully rendered per §9.6. Modes 2/5/7 show a "Not yet supported (M2c)" placeholder when selected. |
| 4 | Device-subtree schema source | **C → A** — capture a full `monitor/log` trace from a working Max UG session **first** (as Task 27 prereq); then transliterate the full device-subtree schema to match Max byte-for-byte where mode 1/4 relevant. |
| 5 | Config representation | **A** — typed `UltraGridConfig` value object (one field per `ugf_*` input); `buildUvArgs(config): string[]` is a pure function. Topic-change reducer maintains the config between publishes. |
| 6 | Child-process lifecycle | **B** — extract a `ChildProcessLifecycle` helper class (generic over `{binary, args, onStdout, onStderr, onExit}`). UltraGridDevice composes it. NatNet will reuse it later. |
| 7 | stderr/monitor log schema | **D → B** — capture Max's `monitor/log` trace first; then implement a bounded ring buffer (~50 lines) published as a joined blob to `monitor/log`. Retained so late subscribers catch up. |
| 8 | Spawn-failure classification | **B** — 2-second post-spawn grace window. Exit inside the window → spawn-failure (log + leave `enable=1`, user retries). Exit after the window → mid-stream crash (log + publish `enable=0`). |
| 9 | Windows binary strategy | **B** — Windows uses single `uv.exe` with a warning logged that per-channel concurrent instances are unverified. Per-channel binary copies deferred to a later plan if needed. |
| 10 | Port allocation | **C → B** — capture a Max session with 2+ UG devices active first to confirm the dual-pair pattern; then implement a UG-specific allocator for the `xxcc0↔xxcc1` + `xxcc4↔xxcc8` pattern (§8.7). |
| 11 | Rack persistence semantics | **A** — full persistence including `enable`. Identical to OSC: every retained device-subtree mutation hits `rack.json` via `trackedPublish`. UG auto-starts on rack restore. |
| 12 | Shutdown triggers | **A (extended)** — SIGTERM → 500ms → SIGKILL on (a) app quit AND (b) `bus:leave`. Extends `performShutdown` and adds a symmetric teardown path to the leave handler. |
| 13 | Leave-room teardown | **A** — full teardown: empty-publish every device-subtree topic for all active channels (handler `teardown()` → empty publishes → `destroy()`), matching the unload flow. Clean-slate rejoin. |
| 14 | Rejoin reconciliation | **B** — rejoin runs the app-start flow: `publishInitSequence` + `enumerate` + rack.json replay. `enable` persists via rack, so UG auto-restarts on rejoin if it was running at leave. |
| 15 | Interop test strategy | **B** — golden fixtures (UltraGridConfig → CLI-args snapshots + device-subtree schema snapshot) + one live interop run against Max covering modes 1 + 4. |
| 16 | Task granularity | **A** — ~11 tasks at M2a granularity (Tasks 27-37). Each task has a clear file set and a testable gate. |

### File structure (M2b additions/changes)

```
src/
  main/
    devices/
      ultragrid/
        UltraGridDevice.ts        — handler: composes ChildProcessLifecycle + topic↔config reducer + port allocator
        cliBuilder.ts             — buildUvArgs(config, ports): string[] (pure; modes 1+4 only)
        config.ts                 — UltraGridConfig type + defaults + topic↔field mappers
        portAllocator.ts          — UG dual-pair slot allocator (§8.7)
        monitorLog.ts             — bounded ring buffer publisher for monitor/log
      ChildProcessLifecycle.ts    — generic spawn/kill helper (SIGTERM→500ms→SIGKILL, grace-window classifier)
    deviceRouter.ts               — (edited) route loaded=2 → UltraGridDevice factory
    index.ts                      — (edited) wire UG factory; extend bus:leave to trigger full teardown
    shutdown.ts                   — (edited) performShutdown already calls deviceRouter.destroyAll → no-op change; verify
  renderer/
    components/
      panels/
        UltraGridPanel.vue        — full §9.6 for modes 1+4; placeholder for 2/5/7
      AddDevicePopup.vue          — (edited) un-grey UG tile; clicking emits loaded=2
tests/
  main/
    devices/
      ChildProcessLifecycle.test.ts
      ultragrid/
        cliBuilder.test.ts         — golden CLI-args fixtures
        config.test.ts             — topic↔field round-trip
        portAllocator.test.ts
  fixtures/
    ultragrid/
      max-monitor-log-trace.txt    — captured from running Max UG session
      max-device-subtree-mode1.json — retained-topic snapshot from Max (mode 1)
      max-device-subtree-mode4.json — retained-topic snapshot from Max (mode 4)
      max-cli-mode1.txt            — captured Max-emitted UV command line (mode 1)
      max-cli-mode4.txt            — captured Max-emitted UV command line (mode 4)
docs/logs/
  m2b-max-capture-notes.md         — documents what was captured, Max version, UV version, procedure
  m2b-interop-test.md              — live interop case
```

---

### Task 27: Capture Max UG reference traces (blocking prereq) 📸

**Why first:** Tasks 29, 30, 31, 32, 34 all depend on knowing the exact device-subtree schema, CLI args, and port patterns Max emits. Capturing once up-front prevents guess-and-correct rework.

**Files:**
- Create: [tests/fixtures/ultragrid/max-monitor-log-trace.txt](../../tests/fixtures/ultragrid/)
- Create: [tests/fixtures/ultragrid/max-device-subtree-mode1.json](../../tests/fixtures/ultragrid/)
- Create: [tests/fixtures/ultragrid/max-device-subtree-mode4.json](../../tests/fixtures/ultragrid/)
- Create: [tests/fixtures/ultragrid/max-cli-mode1.txt](../../tests/fixtures/ultragrid/)
- Create: [tests/fixtures/ultragrid/max-cli-mode4.txt](../../tests/fixtures/ultragrid/)
- Create: [docs/logs/m2b-max-capture-notes.md](../logs/)

- [ ] **Step 1: Capture mode-1 session.** Run Max + an MQTT retained-topic dumper (e.g. `mosquitto_sub -t '/peer/+/rack/#' -v` piped to file). Load an UG device on channel 0 in mode 1 (send-to-router/UDP), configure video + audio with typical settings, enable. Wait 30s. Grab: (a) all retained topics under Max's `/peer/.../device/...`, (b) the `monitor/log` topic's accumulated value, (c) the actual UV command line Max spawned (via `ps aux | grep uv` or Max's own logs).

- [ ] **Step 2: Capture mode-4 session.** Same as step 1 but `network/mode=4` (peer-to-peer-automatic/RTP).

- [ ] **Step 3: Capture multi-device port pattern.** Load 2 UG devices simultaneously on different channels. Record the port numbers in all `device/gui/network/*Port` topics. Verify the dual-pair `xxcc0↔xxcc1` and `xxcc4↔xxcc8` pattern holds.

- [ ] **Step 4: Document in capture notes.** Max version, UV version, room ID used, procedure, any surprises. File-link each fixture.

- [ ] **Step 5: Commit.** `m2b(task27): capture Max UG reference traces (modes 1+4 + multi-device ports)`

**Gate:** All fixtures exist; capture notes document how to re-capture on upgrades.

---

### Task 28: `ChildProcessLifecycle` helper + tests 🔧

**Why early:** Task 32 composes this. Generic design means NatNet (M3) reuses it.

**Files:**
- Create: [src/main/devices/ChildProcessLifecycle.ts](../../src/main/devices/)
- Create: [tests/main/devices/ChildProcessLifecycle.test.ts](../../tests/main/devices/)

- [ ] **Step 1: API.**
  ```ts
  interface LifecycleOptions {
    binary: string
    args: string[]
    spawnGraceMs?: number  // default 2000
    terminationGraceMs?: number  // default 500
    onStdout: (line: string) => void
    onStderr: (line: string) => void
    onExit: (reason: 'spawn-failure' | 'crash' | 'killed', code: number | null) => void
  }
  class ChildProcessLifecycle {
    constructor(opts: LifecycleOptions)
    start(): void
    stop(): void  // SIGTERM, then SIGKILL after terminationGraceMs
    isRunning(): boolean
  }
  ```

- [ ] **Step 2: Grace-window classifier.** On exit, if `Date.now() - spawnedAt < spawnGraceMs` → `spawn-failure`, else `crash`. If exit was triggered by our `stop()` call → `killed`.

- [ ] **Step 3: Line buffering.** Split stdout/stderr into lines (CRLF + LF tolerant). Emit each line via `onStdout`/`onStderr`.

- [ ] **Step 4: Unit tests.** Mock `child_process.spawn` (vitest-friendly approach: inject a fake spawner via constructor overload for testing). Cover: clean exit classified as crash or spawn-failure by timing; explicit stop classified as killed; SIGKILL fires after termination grace if process doesn't exit; stdout/stderr line splitting.

- [ ] **Step 5: Commit.** `m2b(task28): add ChildProcessLifecycle helper with spawn-failure vs crash classification`

**Gate:** All lifecycle tests green. No UltraGrid-specific logic in this file.

---

### Task 29: UG port allocator + tests 🔧 short

**Why:** §8.7 specifies `{roomID}{channelBase}{slot}` with UG using dual pairs `xxcc0↔xxcc1` (video) and `xxcc4↔xxcc8` (audio). Cross-referenced against Task 27 capture.

**Files:**
- Create: [src/main/devices/ultragrid/portAllocator.ts](../../src/main/devices/ultragrid/)
- Create: [tests/main/devices/ultragrid/portAllocator.test.ts](../../tests/main/devices/ultragrid/)

- [ ] **Step 1: API.**
  ```ts
  interface UgPorts {
    videoLocal: number; videoRemote: number
    audioLocal: number; audioRemote: number
  }
  function allocateUgPorts(roomId: number, channelIndex: number): UgPorts
  ```

- [ ] **Step 2: Formula.** `{roomId}{cc}{slot}` where `cc` is 2-digit zero-padded channel, `slot ∈ {0,1,4,8}`. Verify formula against Task 27 mode-1 + mode-4 captures.

- [ ] **Step 3: Unit tests.** Round-trip for channels 0, 9, 10, 19; assert no collisions across (room, channel) space; assert fixture-matching output for captured (roomId, channelIndex) pairs from Task 27.

- [ ] **Step 4: Commit.** `m2b(task29): add UG dual-pair port allocator`

**Gate:** Allocator output matches Task 27 capture for at least 2 (roomId, channel) pairs.

---

### Task 30: `UltraGridConfig` type + topic↔field mapper + tests

**Why:** Separates state (config object) from formatting (CLI args). Testable independently.

**Files:**
- Create: [src/main/devices/ultragrid/config.ts](../../src/main/devices/ultragrid/)
- Create: [tests/main/devices/ultragrid/config.test.ts](../../tests/main/devices/ultragrid/)

- [ ] **Step 1: `UltraGridConfig` type.** Transliterate only the `ugf_*` fields mode 1 + mode 4 actually touch (per [docs/javascript/tg.ultragrid.js](../javascript/tg.ultragrid.js)). Fields cover: video capture source + compression + resolution + fps, audio capture + codec, network/mode, connection settings, transmission settings. Mode-2/5/7-only fields omitted.

- [ ] **Step 2: Defaults.** `defaultUltraGridConfig(): UltraGridConfig` — matches the default values published by Max (cross-reference Task 27 device-subtree capture).

- [ ] **Step 3: Topic↔field mapper.**
  ```ts
  function applyTopicChange(config: UltraGridConfig, subpath: string, value: string): UltraGridConfig
  function snapshotTopics(config: UltraGridConfig): Array<{ subpath: string; value: string }>
  ```
  `applyTopicChange` is a pure reducer (returns new config). `snapshotTopics` produces the full publish set for `publishDefaults`.

- [ ] **Step 4: Unit tests.** Round-trip: `snapshotTopics(defaults)` → `applyTopicChange` fold → `deepEqual(defaults)`. Every topic under `tests/fixtures/ultragrid/max-device-subtree-mode1.json` and `...-mode4.json` is recognized by `applyTopicChange` (no silent drops). Unknown topics log a warning but don't throw.

- [ ] **Step 5: Commit.** `m2b(task30): add UltraGridConfig type with topic↔field mapper`

**Gate:** `config.test.ts` covers every topic Max emits in the Task 27 mode-1 + mode-4 captures.

---

### Task 31: `cliBuilder.ts` — modes 1+4 args + golden tests

**Files:**
- Create: [src/main/devices/ultragrid/cliBuilder.ts](../../src/main/devices/ultragrid/)
- Create: [tests/main/devices/ultragrid/cliBuilder.test.ts](../../tests/main/devices/ultragrid/)

- [ ] **Step 1: API.**
  ```ts
  function buildUvArgs(config: UltraGridConfig, ports: UgPorts, roomId: number): string[]
  ```
  Pure. No side effects. Throws `new Error('M2c: mode N not yet supported')` for modes 2/5/7.

- [ ] **Step 2: Mode-1 assembler.** Transliterate `cliADD_sendToRouter` branch from tg.ultragrid.js. Use only the `ugf_*` setters mode 1 touches.

- [ ] **Step 3: Mode-4 assembler.** Transliterate `cliADD_peerToPeerAutomatic` branch. RTP-specific flags.

- [ ] **Step 4: Golden tests.** For each captured Max CLI in Task 27, run `buildUvArgs` on the matching config snapshot, assert the output array matches the captured Max command line (tokenize both, compare). Differences become commit-worthy follow-ups, not silent drift.

- [ ] **Step 5: Commit.** `m2b(task31): add UV CLI builder for modes 1+4 with golden tests against Max`

**Gate:** `buildUvArgs(mode1Config, ports, roomId)` matches the Task 27 `max-cli-mode1.txt`; same for mode 4. Modes 2/5/7 throw.

---

### Task 32: `UltraGridDevice.ts` handler

**Files:**
- Create: [src/main/devices/ultragrid/UltraGridDevice.ts](../../src/main/devices/ultragrid/)
- Create: [src/main/devices/ultragrid/monitorLog.ts](../../src/main/devices/ultragrid/)

- [ ] **Step 1: Implement `DeviceHandler` interface.** Maintain an `UltraGridConfig` instance. `onTopicChanged(subpath, value)` → `applyTopicChange` → if subpath is `gui/enable` and value flips, start/stop the lifecycle.

- [ ] **Step 2: Compose `ChildProcessLifecycle`.** On enable-flip-to-1: resolve UG path (reuse `resolveUgPath` from M2a spawnCli), allocate ports, `buildUvArgs`, start. On enable-flip-to-0: `lifecycle.stop()`.

- [ ] **Step 3: Lifecycle callbacks.**
  - `onStdout` → passed to `monitorLog` for bounded ring-buffer publish to `monitor/log`.
  - `onStderr` → same; stderr lines are the interesting ones.
  - `onExit('spawn-failure', code)` → log warning; leave enable=1 (user decides whether to retry).
  - `onExit('crash', code)` → log warning; publish empty to `gui/enable` (sets enable=0 via echo).
  - `onExit('killed', code)` → silent (we caused it).

- [ ] **Step 4: `publishDefaults()`** — `snapshotTopics(defaultUltraGridConfig())` → publish all retained. Matches Task 27 captured Max defaults.

- [ ] **Step 5: `teardown()`** — return the list of every subpath this handler ever wrote (tracked in a local Set); caller empty-publishes them. Stop the lifecycle if running.

- [ ] **Step 6: `destroy()`** — final cleanup; ensure lifecycle is stopped (SIGKILL path).

- [ ] **Step 7: Unit test.** Mock the lifecycle (inject a fake constructor). Cover: enable-flip starts lifecycle with correct args; disable stops it; crash republishes enable=0; teardown returns all touched topics.

- [ ] **Step 8: Commit.** `m2b(task32): add UltraGridDevice handler composing lifecycle + config + CLI builder`

**Gate:** Unit tests green. No wiring yet.

---

### Task 33: DeviceRouter glue + bus:leave teardown

**Files:**
- Edit: [src/main/index.ts](../../src/main/index.ts) — extend the factory to handle `loaded=2`.
- Edit: [src/main/index.ts](../../src/main/index.ts) — `bus:leave` IPC handler calls `deviceRouter.destroyAll()` before `bus.leave()`.
- Edit: [src/main/shutdown.ts](../../src/main/shutdown.ts) — verify `performShutdown` already calls `destroyAll`; if so, leave as-is.

- [ ] **Step 1: Factory extension.** In `peer:joined`, extend the factory passed to `DeviceRouter`:
  ```ts
  if (type === 2) return new UltraGridDevice(channel, localPeerId, localIP, roomId,
    publish, retainedTopics.has.bind(retainedTopics), loadSettings().brokerUrl)
  ```

- [ ] **Step 2: Leave-room teardown.** Current `ipcMain.handle('bus:leave', ...)` at [index.ts:256-258](../../src/main/index.ts#L256-L258) just calls `bus!.leave()`. Prefix with: `deviceRouter?.destroyAll(); flushRackSave()`. This empty-publishes every device topic and stops any running UG processes before disconnecting.

- [ ] **Step 3: Verify `performShutdown`.** Confirm it already invokes `destroyAll` on the router; if not, add. The quit path is symmetric with leave after this change.

- [ ] **Step 4: Manual smoke.** Load an OSC device, hit Leave Room in the UI, observe: Activity Log shows empty-publishes for the device subtree, then disconnect. Rejoin the room, observe: `publishInitSequence` runs, rack.json restores the OSC device.

- [ ] **Step 5: Commit.** `m2b(task33): route loaded=2 to UltraGridDevice; full device teardown on bus:leave`

**Gate:** Leave → rejoin with an OSC device loaded cleanly tears down and restores. (UG end-to-end verified in Task 37.)

---

### Task 34: `UltraGridPanel.vue` — modes 1+4 full, others placeholder

**Files:**
- Create: [src/renderer/components/panels/UltraGridPanel.vue](../../src/renderer/components/panels/)

Panel is large (~400 lines). Structure it the same way as [OscPanel.vue](../../src/renderer/components/panels/OscPanel.vue) — `useMqttBinding` per control, sections collapse/expand based on mode.

- [ ] **Step 1: Skeleton + mode picker.** Dropdown bound to `gui/network/mode`. Values 1 + 4 render full content. Values 2/5/7 render: "Not yet supported (M2c). Switch back to mode 1 or 4 to continue."

- [ ] **Step 2: Connection section (§9.6).** Capture source (texture/ndi), compression, resolution, fps — all dropdowns sourced from `settings/localMenus/*` via `useMqttBinding`.

- [ ] **Step 3: Transmission section.** Audio codec, bitrate, FEC — wired to `gui/transmission/*` topics.

- [ ] **Step 4: Network section (mode-dependent).** Mode 1: router-specific fields (host, ports read-only from allocator). Mode 4: RTP-specific fields.

- [ ] **Step 5: Enable toggle.** Same pattern as OscPanel — toggle → publish `gui/enable`; panel disables controls while `enable=1` (live process).

- [ ] **Step 6: Monitor log readout.** Subscribe to `monitor/log`, display last N lines in a scrollable pane. Read-only.

- [ ] **Step 7: Commit.** `m2b(task34): add UltraGridPanel with modes 1+4 fully rendered`

**Gate:** Panel renders without runtime errors; all controls reflect the retained topic values on load; mode-switch to 2/5/7 shows placeholder.

---

### Task 35: `AddDevicePopup.vue` — un-grey UG tile

**Files:**
- Edit: [src/renderer/components/AddDevicePopup.vue](../../src/renderer/components/)

- [ ] **Step 1: Remove greyed class from UG tile.** Tile now emits `select(2)`.

- [ ] **Step 2: Update Vitest component test.** UG tile is clickable, emits `select(2)`. MoCap still greyed.

- [ ] **Step 3: Commit.** `m2b(task35): enable UltraGrid tile in AddDevicePopup`

**Gate:** Click `+` → popup → click UG tile → channel fills with `loaded=2` → UltraGridPanel opens.

---

### Task 36: Panel route + MatrixView panel switching

**Files:**
- Edit: [src/renderer/views/MatrixView.vue](../../src/renderer/views/MatrixView.vue) — route `loaded=2` to UltraGridPanel.

- [ ] **Step 1: Extend panel-choice logic.** Current logic picks OscPanel for `loaded ∈ {1,4}`. Add `loaded=2` → UltraGridPanel.

- [ ] **Step 2: Manual smoke.** Load OSC on ch0, UG on ch1, click each cell, correct panel opens.

- [ ] **Step 3: Commit.** `m2b(task36): route loaded=2 to UltraGridPanel in MatrixView`

**Gate:** Both panels open for their respective devices; no console errors when switching.

---

### Task 37: M2b cross-client interop test

**Files:**
- Create: [docs/logs/m2b-interop-test.md](../logs/)

**Preconditions:**
- M2b merged and built.
- `rack.json` deleted.
- Broker retained state cleared for test peer.
- Max gateway running (same broker, same room).
- UV binary discoverable on both sides.

**Cases:**

- [ ] **Case 1: Mode 1 (UDP send-to-router) — NG creates, Max observes.** NG picks UG from popup → channel fills → panel opens → select mode 1 → configure video (texture capture) + audio (coreaudio) → enable. Expected: Max sees `loaded=2`, device subtree populated; NG spawns UV; Max's matrix shows the channel; live video/audio flows.

- [ ] **Case 2: Mode 4 (RTP peer-to-peer) — same flow, mode 4.** Verify RTP-specific network fields populate; live flow works.

- [ ] **Case 3: Crash recovery.** On NG: kill the UV child process manually (`kill -9 <pid>`). Expected: NG logs crash, publishes `gui/enable=0`, panel reflects disabled state. User can re-enable.

- [ ] **Case 4: Leave-room teardown.** Load UG on NG, enable. Click Leave Room. Expected: UV child exits cleanly (SIGTERM within 500ms), device subtree empty-published, Max observes channel clearing. Rejoin → rack restore → UG auto-restarts with same config.

- [ ] **Case 5: Rack persistence round-trip.** Load + configure + enable UG on NG. Close app. Reopen. Expected: UG auto-restarts on `peer:joined` with same config; Max observes the rejoin flow as a new device load.

- [ ] **Log observed results, call out deviations, commit.**

**Gate for M2b-complete:** Cases 1-5 pass (or deviations accepted). Update `gateway-ng-m2-progress.md` with M2b completion entry.

---

### M2b prerequisites (must be true before Task 27 starts)

1. M2a merged, interop passing, logged (done — `m2a-interop-test.md` Cases 1-6 ✅ on 2026-04-20).
2. Max session available to capture from (running UG on working broker + room).
3. UV version on Max documented (for fixture re-capture on upgrade — per project memory: UG CLI format is version-dependent).

### M2b file-by-file summary

| File | Action | Size |
|---|---|---|
| [src/main/devices/ChildProcessLifecycle.ts](../../src/main/devices/) | new | ~120 lines |
| [src/main/devices/ultragrid/UltraGridDevice.ts](../../src/main/devices/ultragrid/) | new | ~200 lines |
| [src/main/devices/ultragrid/cliBuilder.ts](../../src/main/devices/ultragrid/) | new | ~150 lines |
| [src/main/devices/ultragrid/config.ts](../../src/main/devices/ultragrid/) | new | ~180 lines |
| [src/main/devices/ultragrid/portAllocator.ts](../../src/main/devices/ultragrid/) | new | ~30 lines |
| [src/main/devices/ultragrid/monitorLog.ts](../../src/main/devices/ultragrid/) | new | ~40 lines |
| [src/main/index.ts](../../src/main/index.ts) | edit (factory + bus:leave) | ~+15 lines |
| [src/renderer/components/panels/UltraGridPanel.vue](../../src/renderer/components/panels/) | new | ~400 lines |
| [src/renderer/components/AddDevicePopup.vue](../../src/renderer/components/) | edit (un-grey) | ~-3 lines |
| [src/renderer/views/MatrixView.vue](../../src/renderer/views/MatrixView.vue) | edit (panel route) | ~+5 lines |
| tests/main/devices/**/*.test.ts | new | ~500 lines |
| tests/fixtures/ultragrid/max-*.{txt,json} | new (5 captured fixtures) | N/A |
| [docs/logs/m2b-max-capture-notes.md](../logs/) | new | ~40 lines |
| [docs/logs/m2b-interop-test.md](../logs/) | new | ~120 lines |

Total new/edited: ~1650 lines of code + ~160 lines of docs.

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
