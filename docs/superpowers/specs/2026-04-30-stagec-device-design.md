# StageControl Device — Design Spec
_2026-04-30_

## Overview

Activate the StageControl device type (`loaded=4`) which has been implemented in the backend but gated off in the UI. Add a dedicated `StageControlPanel.vue` that mirrors `OscPanel` with one addition: an always-visible "Open in browser" button that opens the Open Stage Control web UI at `http://<brokerHost>:<roomId * 1000 + 900>`.

## Background

StageControl connects to a per-room many-to-many bidirectional port proxy running on the broker host:
- **Proxy port:** `roomId * 1000 + 902` — the UDP relay target (already implemented in `allocateStageControlPort`)
- **Web UI port:** `roomId * 1000 + 900` — opened in the browser

There is one Open Stage Control instance per room (not per peer), so the browser button is meaningful on both local and remote peer panels.

## What Is Already Done

- `OscDevice.ts` handles `deviceType=1` (OSC) and `deviceType=4` (StageControl) via a constructor parameter
- `allocateStageControlPort(roomId)` → `roomId * 1000 + 902` is wired into `OscDevice`
- `deviceRouter.ts` instantiates `OscDevice` for `type === 1 || type === 4`
- Matrix cell renders StageControl in `#FE5FF5` with the shared bidi icon
- `PanelSlotHeader` labels it `SC`
- `DevicePanel.vue` routes `loaded=4` to `OscPanel` (to be changed to `StageControlPanel`)
- `AddDevicePopup.vue` has the tile defined with `implemented: false` (to be flipped)

## Changes Required

### 1. Activate the tile — `AddDevicePopup.vue`

Change `implemented: false` to `implemented: true` for the StageControl tile (type 4).

The `stagec_enable` flag gates availability per-peer. Since StageControl has no binary dependency (unlike UltraGrid), it is always available → publish `'1'` unconditionally.

### 2. Publish `stagec_enable` — `src/main/index.ts`

In `publishInitSequence()`, alongside `ug_enable` and `natnet_enable`, add:

```
trackedPublish(1, topics.settings(peerId, 'localProps/stagec_enable'), '1')
```

### 3. Session info composable — `src/renderer/composables/useSessionInfo.ts`

A new singleton composable that holds broker host and room ID so panels can read them without prop drilling.

```ts
// returns { brokerHost: Ref<string>, roomId: Ref<number> }
export function useSessionInfo()
```

Populated by listening to:
- `window.api.on('peer:room:id', ...)` → `roomId`
- `window.api.invoke('bus:localPeer')` on mount (already used in MatrixView) → `brokerHost` from the `brokerUrl` stored in settings, or captured from `peer:joined`

**Implementation note:** `MatrixView` already holds `roomId` as a local ref updated from `peer:room:id`. The composable uses the same event. `brokerHost` is already in `loadSettings().brokerUrl` — expose it via `window.api.invoke('settings:load')` which is already an allowed invoke channel.

### 4. New `StageControlPanel.vue` — `src/renderer/components/panels/StageControlPanel.vue`

Identical structure to `OscPanel.vue` with one addition: an "Open in browser" button, always visible, placed between the description input and the "Forward to" section.

**Button spec:**
- Label: `Open Stage Control ↗`
- URL: `` `http://${brokerHost}:${roomId * 1000 + 900}` ``
- Action: `window.open(url, '_blank')` — intercepted by `setWindowOpenHandler` → `shell.openExternal`, no new IPC needed
- Disabled when: `roomId === 0` (not yet joined a room)
- Visible always: not gated by `isEnabled` or `isLocked`

**Props:** same as `OscPanel` (`peerId`, `channelIndex`, `deviceState`, `isLocal`, `targetLocked`). Session info comes from `useSessionInfo()` internally.

### 5. Wire `StageControlPanel` into `DevicePanel.vue`

Replace the existing `v-if="loaded === '1' || loaded === '4'"` OscPanel branch with two separate branches:

```
loaded=4 → StageControlPanel
loaded=1 → OscPanel
```

`StageControlPanel` receives the same props as `OscPanel`.

## Data Flow

```
peer:room:id (IPC) ──────────────────────┐
settings:load (IPC) ─────────────────────┤
                                         ▼
                                  useSessionInfo()
                                  { brokerHost, roomId }
                                         │
                                         ▼
                               StageControlPanel.vue
                               window.open(http://brokerHost:roomId*1000+900)
                                         │
                                         ▼
                               setWindowOpenHandler → shell.openExternal
```

## Out of Scope

- No changes to `OscDevice.ts`, `portAllocator.ts`, or any main-process handler
- No new MQTT topics
- No new IPC channels
- `OscPanel.vue` is not modified — StageControl gets its own panel file

## File Checklist

| File | Change |
|------|--------|
| `src/renderer/components/AddDevicePopup.vue` | `implemented: false` → `true` for type 4 |
| `src/main/index.ts` | add `stagec_enable '1'` to `publishInitSequence` |
| `src/renderer/composables/useSessionInfo.ts` | new — `{ brokerHost, roomId }` singleton |
| `src/renderer/components/panels/StageControlPanel.vue` | new — OscPanel + browser button |
| `src/renderer/components/DevicePanel.vue` | split OSC/StageC branches, import StageControlPanel |
