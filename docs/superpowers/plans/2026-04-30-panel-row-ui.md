# Panel Row UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed right-side DevicePanel with a resizable bottom panel row that shows device detail panels as horizontal slots — one floating (current selection) and any number of pinned (persisted until closed), with drag-to-reorder among pinned panels.

**Architecture:** `MatrixView` is refactored into a vertically split layout (matrix top, panel row bottom) managed by a new `usePanelRow` composable that owns all panel slot state. `DevicePanel` is repurposed as a self-contained slot component rendered inside the row. A new `PanelRowHeader` component handles the slot header (icon, peer name, channel, live metrics). The drag-handle height is persisted to `settings.json` via the existing IPC settings channel.

**Tech Stack:** Vue 3 Composition API, TypeScript strict, Electron IPC (existing `window.api`), HTML5 Drag-and-Drop API, existing `useMqttBinding` composable, existing device panel components (OscPanel, UltraGridPanel, NatNetPanel).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/renderer/composables/usePanelRow.ts` | All panel slot state: floating panel, pinned panels list, selection sync, pin/unpin/close/reorder |
| Create | `src/renderer/components/PanelRow.vue` | Bottom panel row container: horizontal scroll, drag-drop reorder, renders slots |
| Create | `src/renderer/components/PanelSlotHeader.vue` | Per-slot header: device icon, peer name, channel, live metrics (FPS/dB/activity), pin button, close button |
| Modify | `src/renderer/views/MatrixView.vue` | Replace fixed right-panel layout with vertical split + drag handle; wire `usePanelRow` |
| Modify | `src/renderer/components/DevicePanel.vue` | Remove fixed positioning; accept `pinned` prop; emit `pin`/`close`; remove internal header (header moves to PanelSlotHeader) |
| Modify | `src/main/persistence/settings.ts` | Add `panelRowHeight: number` to `Settings` interface and defaults |
| Modify | `src/preload/index.ts` | Verify (or add) `settings:get` / `settings:save` IPC channels if not already present |
| Modify | `src/main/index.ts` | Verify (or add) IPC handlers for `settings:get` / `settings:save` |

---

## Task 1: Add `panelRowHeight` to settings persistence

**Files:**
- Modify: `src/main/persistence/settings.ts`

- [ ] **Step 1: Read the current Settings interface**

Open `src/main/persistence/settings.ts`. The interface currently ends with `settingsVersion: number`.

- [ ] **Step 2: Add `panelRowHeight` to the interface and defaults**

```typescript
export interface Settings {
  peerName: string
  peerColor: string
  brokerUrl: string
  brokerPort: number
  brokerUser: string
  brokerPwd: string
  lastRoomName: string
  lastRoomPwd: string
  settingsVersion: number
  panelRowHeight: number   // add this line
}

const DEFAULTS: Settings = {
  peerName: '',
  peerColor: '',
  brokerUrl: 'telemersion.zhdk.ch',
  brokerPort: 3883,
  brokerUser: 'peer',
  brokerPwd: 'telemersion2021',
  lastRoomName: '',
  lastRoomPwd: '',
  settingsVersion: 1,
  panelRowHeight: 320      // add this line — comfortable height for UltraGrid
}
```

- [ ] **Step 3: Verify IPC handlers exist for settings in main process**

Search `src/main/index.ts` for `settings:get` and `settings:save`. If both exist, skip to Step 5.

```bash
grep -n "settings:get\|settings:save\|settings:load" src/main/index.ts
```

- [ ] **Step 4: If missing, add IPC handlers to `src/main/index.ts`**

Find the section where other `ipcMain.handle` calls are grouped and add:

```typescript
ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:save', (_e, patch: Partial<Settings>) => {
  const current = loadSettings()
  saveSettings({ ...current, ...patch })
})
```

Also add the import at top of file if not present:
```typescript
import { loadSettings, saveSettings } from './persistence/settings'
```

- [ ] **Step 5: Verify `settings:get` and `settings:save` are exposed in preload**

```bash
grep -n "settings" src/preload/index.ts
```

If not present, add to the `exposeInMainWorld` channels list following the existing pattern. The exact addition depends on how `window.api` is structured — add `settings:get` to `invoke` channels and `settings:save` to `invoke` channels.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/persistence/settings.ts src/main/index.ts src/preload/index.ts
git commit -m "feat: add panelRowHeight to persisted settings"
```

---

## Task 2: Create `usePanelRow` composable

**Files:**
- Create: `src/renderer/composables/usePanelRow.ts`

This composable owns all panel slot state. It is the single source of truth for what is open, what is pinned, and what is selected.

- [ ] **Step 1: Create the file**

```typescript
// src/renderer/composables/usePanelRow.ts
import { ref, computed } from 'vue'

export interface PanelSlot {
  id: string          // unique: `${peerId}-${channelIndex}`
  peerId: string
  channelIndex: number
  pinned: boolean
}

function makeId(peerId: string, channelIndex: number): string {
  return `${peerId}-${channelIndex}`
}

export function usePanelRow() {
  // Ordered list of pinned slots (left side of row)
  const pinnedSlots = ref<PanelSlot[]>([])

  // The single floating slot (rightmost, null when nothing selected)
  const floatingSlot = ref<PanelSlot | null>(null)

  // The active selection (drives cell highlight in matrix)
  const selectedId = computed<string | null>(() => {
    return floatingSlot.value?.id ?? null
  })

  // All slots in display order: pinned left → floating right
  const allSlots = computed<PanelSlot[]>(() => {
    return floatingSlot.value
      ? [...pinnedSlots.value, floatingSlot.value]
      : [...pinnedSlots.value]
  })

  const panelRowVisible = computed(() => allSlots.value.length > 0)

  function selectCell(peerId: string, channelIndex: number) {
    const id = makeId(peerId, channelIndex)

    // If already pinned, just highlight it (no duplicate floating slot)
    const alreadyPinned = pinnedSlots.value.find(s => s.id === id)
    if (alreadyPinned) {
      // Clear floating slot — the pinned panel gets highlighted via selectedId
      floatingSlot.value = null
      return
    }

    floatingSlot.value = { id, peerId, channelIndex, pinned: false }
  }

  function clearSelection() {
    floatingSlot.value = null
  }

  function pinFloating() {
    if (!floatingSlot.value) return
    const slot: PanelSlot = { ...floatingSlot.value, pinned: true }
    pinnedSlots.value = [...pinnedSlots.value, slot]
    floatingSlot.value = null
  }

  function closePinned(id: string) {
    pinnedSlots.value = pinnedSlots.value.filter(s => s.id !== id)
  }

  function reorderPinned(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const list = [...pinnedSlots.value]
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    pinnedSlots.value = list
  }

  // Called when a panel slot header is clicked — syncs selection back to matrix
  function selectSlot(id: string) {
    const pinned = pinnedSlots.value.find(s => s.id === id)
    if (pinned) {
      // Highlight the pinned slot; clear floating
      floatingSlot.value = null
      // selectedId won't reflect pinned — add a separate activeId for highlights
    }
    // If it's the floating slot, it's already selected
  }

  // Separate active highlight id that covers both pinned and floating
  const activeId = ref<string | null>(null)

  function activateSlot(id: string) {
    activeId.value = id
  }

  function activateCell(peerId: string, channelIndex: number) {
    const id = makeId(peerId, channelIndex)
    activeId.value = id
    selectCell(peerId, channelIndex)
  }

  return {
    pinnedSlots,
    floatingSlot,
    allSlots,
    panelRowVisible,
    activeId,
    activateCell,
    activateSlot,
    clearSelection,
    pinFloating,
    closePinned,
    reorderPinned,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/composables/usePanelRow.ts
git commit -m "feat: add usePanelRow composable for panel slot state"
```

---

## Task 3: Create `PanelSlotHeader` component

**Files:**
- Create: `src/renderer/components/PanelSlotHeader.vue`

This component renders the header strip at the top of each panel slot. It shows: device type icon (colored), peer name, channel number, live metrics, and action buttons (pin or close).

- [ ] **Step 1: Understand the indicators data shape**

UltraGrid indicators topic value: `"{txActive} {rxActive} {txFps} {txVol} {rxFps} {rxVol}"` (6 space-separated values).
OSC: separate `inputIndicator` and `outputIndicator` topics (numeric, 0 or >0).
MoCap: `"{major} {minor} {direction} {running}"` (4 values, only `minor` is meaningful as RX activity).

The `deviceState` prop passed down from MatrixView already contains all of this via `peerState.peers[peerId].rack.page_0[channel.N]`.

- [ ] **Step 2: Create the component**

```vue
<!-- src/renderer/components/PanelSlotHeader.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  peerName: string
  deviceState: any
  pinned: boolean
  active: boolean
}>()

const emit = defineEmits<{
  pin: []
  close: []
  activate: []
}>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')

// Device type color and label matching DeviceCell conventions
const deviceColor = computed(() => {
  switch (loaded.value) {
    case '1': return '#36ABFF'  // OSC blue
    case '2': return '#1BFEE9'  // UltraGrid (both audio+video)
    case '3': return '#FFA126'  // MoCap orange
    case '4': return '#FE5FF5'  // StageControl magenta
    default:  return '#555'
  }
})

const deviceLabel = computed(() => {
  switch (loaded.value) {
    case '1': return 'OSC'
    case '2': return 'UG'
    case '3': return 'MC'
    case '4': return 'SC'
    default:  return '?'
  }
})

// Parse indicators for UltraGrid: "{txActive} {rxActive} {txFps} {txVol} {rxFps} {rxVol}"
const ugIndicators = computed(() => {
  if (loaded.value !== '2') return null
  const raw = props.deviceState?.device?.gui?.indicators ?? ''
  const parts = raw.split(' ')
  return {
    txFps:  parseFloat(parts[2]) || 0,
    txVol:  parseFloat(parts[3]) || 0,
    rxFps:  parseFloat(parts[4]) || 0,
    rxVol:  parseFloat(parts[5]) || 0,
    txActive: parts[0] === '1',
    rxActive: parts[1] === '1',
  }
})

// OSC activity
const oscTxActive = computed(() => {
  if (loaded.value !== '1' && loaded.value !== '4') return false
  return Number(props.deviceState?.device?.gui?.outputIndicator ?? 0) > 0
})
const oscRxActive = computed(() => {
  if (loaded.value !== '1' && loaded.value !== '4') return false
  return Number(props.deviceState?.device?.gui?.inputIndicator ?? 0) > 0
})

// MoCap activity
const mocapRxActive = computed(() => {
  if (loaded.value !== '3') return false
  const raw = props.deviceState?.device?.gui?.indicators ?? ''
  return raw.split(' ')[1] === '1'
})
</script>

<template>
  <div
    class="slot-header"
    :class="{ active }"
    @click="emit('activate')"
  >
    <!-- Device type badge -->
    <span class="device-badge" :style="{ color: deviceColor, borderColor: deviceColor }">
      {{ deviceLabel }}
    </span>

    <!-- Identity -->
    <span class="peer-name">{{ peerName }}</span>
    <span class="ch-label">ch.{{ channelIndex }}</span>

    <!-- UltraGrid live metrics -->
    <template v-if="loaded === '2' && ugIndicators">
      <span class="metric" :class="{ active: ugIndicators.txActive }">
        TX {{ ugIndicators.txFps.toFixed(1) }}fps {{ ugIndicators.txVol.toFixed(1) }}dB
      </span>
      <span class="metric" :class="{ active: ugIndicators.rxActive }">
        RX {{ ugIndicators.rxFps.toFixed(1) }}fps {{ ugIndicators.rxVol.toFixed(1) }}dB
      </span>
    </template>

    <!-- OSC activity pulses -->
    <template v-else-if="loaded === '1' || loaded === '4'">
      <span class="pulse" :class="{ active: oscTxActive }" title="TX">▲</span>
      <span class="pulse" :class="{ active: oscRxActive }" title="RX">▼</span>
    </template>

    <!-- MoCap activity -->
    <template v-else-if="loaded === '3'">
      <span class="pulse" :class="{ active: mocapRxActive }" title="RX">▼</span>
    </template>

    <!-- Actions -->
    <div class="slot-actions">
      <!-- Floating slot: pin only -->
      <button v-if="!pinned" class="action-btn pin-btn" title="Pin panel" @click.stop="emit('pin')">
        📌
      </button>
      <!-- Pinned slot: close only -->
      <button v-else class="action-btn close-btn" title="Close panel" @click.stop="emit('close')">
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.slot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #222;
  border-bottom: 1px solid #333;
  cursor: pointer;
  user-select: none;
  min-height: 28px;
  flex-shrink: 0;
}

.slot-header.active {
  border-bottom-color: #1BFEE9;
}

.device-badge {
  font-size: 9px;
  font-weight: bold;
  border: 1px solid;
  border-radius: 3px;
  padding: 1px 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.peer-name {
  font-size: 11px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.ch-label {
  font-size: 10px;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

.metric {
  font-size: 9px;
  color: #555;
  white-space: nowrap;
  font-family: monospace;
  flex-shrink: 0;
  transition: color 0.15s;
}

.metric.active {
  color: #1BFEE9;
}

.pulse {
  font-size: 9px;
  color: #444;
  flex-shrink: 0;
  transition: color 0.15s;
}

.pulse.active {
  color: #1BFEE9;
}

.slot-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  line-height: 1;
}

.action-btn:hover {
  color: #ccc;
}
</style>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/PanelSlotHeader.vue
git commit -m "feat: add PanelSlotHeader with live metrics and pin/close actions"
```

---

## Task 4: Refactor `DevicePanel` into a slot-style component

**Files:**
- Modify: `src/renderer/components/DevicePanel.vue`

Remove the fixed-position styling and the internal breadcrumb/header. The header is now `PanelSlotHeader`. DevicePanel becomes a plain column container that fills its slot.

- [ ] **Step 1: Replace the full content of `DevicePanel.vue`**

```vue
<!-- src/renderer/components/DevicePanel.vue -->
<script setup lang="ts">
import OscPanel from './panels/OscPanel.vue'
import UltraGridPanel from './panels/UltraGridPanel.vue'
import NatNetPanel from './panels/NatNetPanel.vue'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  peerSettings?: any
  isLocal: boolean
  targetLocked: boolean
}>()

const emit = defineEmits<{ remove: [] }>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')
</script>

<template>
  <div class="device-panel-body">
    <OscPanel
      v-if="loaded === '1' || loaded === '4'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <UltraGridPanel
      v-else-if="loaded === '2'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :peer-settings="peerSettings"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <NatNetPanel
      v-else-if="loaded === '3'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :peer-settings="peerSettings"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <div v-else class="unsupported">
      Device type {{ loaded }} is not yet supported in this milestone.
    </div>
  </div>
</template>

<style scoped>
.device-panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.unsupported {
  padding: 24px;
  color: #666;
  text-align: center;
}
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/DevicePanel.vue
git commit -m "refactor: DevicePanel becomes a slot body, removes fixed positioning and header"
```

---

## Task 5: Create `PanelRow` component

**Files:**
- Create: `src/renderer/components/PanelRow.vue`

This is the horizontal row of panel slots. It renders each slot as a 380px-wide column containing a `PanelSlotHeader` on top and a `DevicePanel` body below. Pinned slots support HTML5 drag-and-drop reordering.

- [ ] **Step 1: Create the component**

```vue
<!-- src/renderer/components/PanelRow.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import type { PanelSlot } from '../composables/usePanelRow'
import PanelSlotHeader from './PanelSlotHeader.vue'
import DevicePanel from './DevicePanel.vue'

const props = defineProps<{
  slots: PanelSlot[]
  activeId: string | null
  // Lookup function: (peerId, channelIndex) => deviceState
  getDeviceState: (peerId: string, channelIndex: number) => any
  getDeviceSettings: (peerId: string) => any
  getPeerName: (peerId: string) => string
  isLocal: (peerId: string) => boolean
  isLocked: (peerId: string) => boolean
}>()

const emit = defineEmits<{
  pin: [id: string]
  close: [id: string]
  activate: [id: string]
  reorder: [fromIndex: number, toIndex: number]
  remove: [peerId: string, channelIndex: number]
}>()

const SLOT_WIDTH = 380

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, slot: PanelSlot) {
  if (!slot.pinned) return   // floating slot cannot be dragged
  dragFromIndex.value = index
}

function onDragOver(e: DragEvent, index: number, slot: PanelSlot) {
  if (!slot.pinned) return   // can only drop on pinned slots
  if (dragFromIndex.value === null) return
  e.preventDefault()
  dragOverIndex.value = index
}

function onDrop(index: number, slot: PanelSlot) {
  if (!slot.pinned) return
  if (dragFromIndex.value === null || dragFromIndex.value === index) {
    dragFromIndex.value = null
    dragOverIndex.value = null
    return
  }
  emit('reorder', dragFromIndex.value, index)
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <div class="panel-row">
    <div
      v-for="(slot, index) in slots"
      :key="slot.id"
      class="panel-slot"
      :class="{
        'drag-over': dragOverIndex === index && slot.pinned,
        'is-floating': !slot.pinned
      }"
      :style="{ width: SLOT_WIDTH + 'px' }"
      :draggable="slot.pinned"
      @dragstart="onDragStart(index, slot)"
      @dragover="onDragOver($event, index, slot)"
      @drop="onDrop(index, slot)"
      @dragend="onDragEnd"
    >
      <PanelSlotHeader
        :peer-id="slot.peerId"
        :channel-index="slot.channelIndex"
        :peer-name="getPeerName(slot.peerId)"
        :device-state="getDeviceState(slot.peerId, slot.channelIndex)"
        :pinned="slot.pinned"
        :active="activeId === slot.id"
        @pin="emit('pin', slot.id)"
        @close="emit('close', slot.id)"
        @activate="emit('activate', slot.id)"
      />
      <DevicePanel
        :peer-id="slot.peerId"
        :channel-index="slot.channelIndex"
        :device-state="getDeviceState(slot.peerId, slot.channelIndex)"
        :peer-settings="getDeviceSettings(slot.peerId)"
        :is-local="isLocal(slot.peerId)"
        :target-locked="isLocked(slot.peerId)"
        @remove="emit('remove', slot.peerId, slot.channelIndex)"
      />
    </div>
  </div>
</template>

<style scoped>
.panel-row {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  background: #1a1a1a;
  border-top: 1px solid #333;
  scrollbar-color: #555 transparent;
  scrollbar-width: thin;
}

.panel-row::-webkit-scrollbar {
  height: 8px;
}
.panel-row::-webkit-scrollbar-track {
  background: transparent;
}
.panel-row::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.panel-slot {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid #2a2a2a;
  height: 100%;
  overflow: hidden;
}

.panel-slot.drag-over {
  border-left: 2px solid #1BFEE9;
}

.panel-slot.is-floating {
  border-left: 1px solid #333;
}
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PanelRow.vue
git commit -m "feat: add PanelRow component with horizontal slots and drag-to-reorder"
```

---

## Task 6: Refactor `MatrixView` — vertical split layout

**Files:**
- Modify: `src/renderer/views/MatrixView.vue`

This is the main integration task. Replace the `marginRight` right-panel layout with a vertical split. Wire `usePanelRow`. Add a drag handle between matrix and panel row. Load/save `panelRowHeight` from settings.

- [ ] **Step 1: Replace the full script section**

Replace the entire `<script setup>` block in `MatrixView.vue`:

```typescript
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { createPeerState } from '../state/peerState'
import { createRoster } from '../state/roster'
import { usePanelRow } from '../composables/usePanelRow'
import PeerRow from '../components/PeerRow.vue'
import PanelRow from '../components/PanelRow.vue'
import AddDevicePopup from '../components/AddDevicePopup.vue'
import RoomHeader from '../components/RoomHeader.vue'

const peerState = createPeerState()
const roster = createRoster()

const ownPeerId = ref('')
const ownPeerName = ref('')
const ownLocalIP = ref('')
const ownPublicIP = ref('')
const roomName = ref('')
const roomId = ref<number | string>('')

const CHANNEL_COUNT = 20

// Panel row split
const panelRowHeight = ref(320)
const MIN_PANEL_HEIGHT = 160
const MIN_MATRIX_HEIGHT = 120
let dragging = false
let dragStartY = 0
let dragStartHeight = 0

onMounted(async () => {
  const settings = await window.api.invoke('settings:get')
  if (typeof settings?.panelRowHeight === 'number') {
    panelRowHeight.value = settings.panelRowHeight
  }
})

function onDragHandleMousedown(e: MouseEvent) {
  dragging = true
  dragStartY = e.clientY
  dragStartHeight = panelRowHeight.value
  window.addEventListener('mousemove', onDragMousemove)
  window.addEventListener('mouseup', onDragMouseup)
  e.preventDefault()
}

function onDragMousemove(e: MouseEvent) {
  if (!dragging) return
  const delta = dragStartY - e.clientY   // drag up = increase panel height
  const newHeight = Math.max(MIN_PANEL_HEIGHT, dragStartHeight + delta)
  panelRowHeight.value = newHeight
}

function onDragMouseup() {
  dragging = false
  window.removeEventListener('mousemove', onDragMousemove)
  window.removeEventListener('mouseup', onDragMouseup)
  window.api.invoke('settings:save', { panelRowHeight: panelRowHeight.value })
}

// Panel row state
const panelRow = usePanelRow()

// Matrix cell highlight: a cell is highlighted if its id is the activeId
function cellIsActive(peerId: string, channelIndex: number): boolean {
  return panelRow.activeId.value === `${peerId}-${channelIndex}`
}

// IPC event wiring (unchanged from before)
window.api.invoke('bus:localPeer').then((info: any) => {
  if (info?.peerId) {
    ownPeerId.value = info.peerId
    ownPeerName.value = info.peerName || ''
    ownLocalIP.value = info.localIP || ''
    if (typeof info.roomId === 'number') roomId.value = info.roomId
    roster.setLocalPeer(info.peerId, info.peerName || '', info.localIP || '', '')
  }
})

window.api.invoke('bus:state').then((s: any) => {
  if (s?.roomName) roomName.value = s.roomName
  if (typeof s?.roomId === 'number') roomId.value = s.roomId
})

window.api.on('peer:id', (id: string) => { ownPeerId.value = id })
window.api.on('peer:localIP', (ip: string) => {
  ownLocalIP.value = ip
  if (ownPeerId.value) roster.setLocalPeer(ownPeerId.value, ownPeerName.value, ip, '')
})
window.api.on('peer:publicIP', (ip: string) => { ownPublicIP.value = ip })
window.api.on('peer:room:name', (name: string) => { roomName.value = name })
window.api.on('peer:room:id', (id: number) => { roomId.value = id })
window.api.on('peers:remote:joined', (info: any) => { roster.addPeer(info) })
window.api.on('peers:remote:left', (info: { peerName: string; peerId: string }) => {
  roster.removePeer(info.peerId)
  peerState.removePeer(info.peerId)
})
window.api.on('peers:clear', () => {
  const local = ownPeerId.value
  for (const id of Object.keys(roster.entries)) {
    if (id !== local) roster.removePeer(id)
  }
})
window.api.on('peers:append', (info: any) => { roster.addPeer(info) })
window.api.on('mqtt:message', (msg: { topic: string; payload: string }) => {
  peerState.applyTopic(msg.topic, msg.payload)
})

const sortedPeerIds = computed(() => {
  const ids = Object.keys(roster.entries)
  return [
    ...ids.filter(id => id === ownPeerId.value),
    ...ids.filter(id => id !== ownPeerId.value)
  ]
})

function peerChannels(peerId: string) {
  return peerState.peers[peerId]?.rack?.page_0 ?? {}
}

function peerSettings(peerId: string) {
  return peerState.peers[peerId]?.settings ?? {}
}

function peerColor(peerId: string) {
  return peerState.peers[peerId]?.settings?.background?.color ?? ''
}

function peerIP(peerId: string) {
  return roster.entries[peerId]?.localIP ?? ''
}

function isLocked(peerId: string) {
  return peerState.peers[peerId]?.settings?.lock?.enable === '1'
}

function getDeviceState(peerId: string, channelIndex: number) {
  return peerChannels(peerId)[`channel.${channelIndex}`]
}

function getPeerName(peerId: string) {
  return roster.entries[peerId]?.peerName ?? peerId.slice(0, 6)
}

function onCellClick(peerId: string, channelIndex: number) {
  const ch = peerState.peers[peerId]?.rack?.page_0?.[`channel.${channelIndex}`]
  if (ch?.loaded && ch.loaded !== '0') {
    panelRow.activateCell(peerId, channelIndex)
  } else {
    panelRow.clearSelection()
  }
}

// Panel row event handlers
function onPanelPin(id: string) {
  panelRow.pinFloating()
}

function onPanelClose(id: string) {
  panelRow.closePinned(id)
}

function onPanelActivate(id: string) {
  panelRow.activateSlot(id)
}

function onPanelReorder(fromIndex: number, toIndex: number) {
  panelRow.reorderPinned(fromIndex, toIndex)
}

function onPanelRemove(peerId: string, channelIndex: number) {
  panelRow.closePinned(`${peerId}-${channelIndex}`)
  panelRow.clearSelection()
  onRemoveDevice(peerId, channelIndex)
}

// Add device popup (unchanged)
const popupOpen = ref(false)
const popupPeerId = ref('')
const popupChannel = ref(0)
const popupRect = ref<DOMRect | null>(null)

function onOpenPopup(peerId: string, channelIndex: number, rect: DOMRect) {
  popupPeerId.value = peerId
  popupChannel.value = channelIndex
  popupRect.value = rect
  popupOpen.value = true
}

function onPopupSelect(deviceType: number) {
  const peerId = popupPeerId.value
  const channel = popupChannel.value
  popupOpen.value = false
  onAddDevice(peerId, channel, deviceType)
}

function closePopup() {
  popupOpen.value = false
}

async function onAddDevice(peerId: string, channelIndex: number, deviceType: number) {
  const topic = `/peer/${peerId}/rack/page_0/channel.${channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: String(deviceType), retain: true })
  // Auto-select the new device once MQTT echo arrives; watch for loaded>0
  // The echo-driven architecture will update peerState and re-render the cell.
  // We optimistically open the panel now — deviceState may be partial until echo.
  panelRow.activateCell(peerId, channelIndex)
}

async function onRemoveDevice(peerId: string, channelIndex: number) {
  const confirmed = window.confirm('Remove this device? The device will be stopped and all its settings cleared.')
  if (!confirmed) return
  const base = `/peer/${peerId}/rack/page_0/channel.${channelIndex}`
  await window.api.invoke('mqtt:publish', { topic: `${base}/device/gui/enable`, value: '0', retain: true })
  await window.api.invoke('mqtt:publish', { topic: `${base}/loaded`, value: '0', retain: true })
}
</script>
```

- [ ] **Step 2: Replace the template section**

```vue
<template>
  <div class="matrix-view">
    <!-- Top: matrix area, shrinks as panel row grows -->
    <div
      class="matrix-area"
      :style="{ bottom: panelRow.panelRowVisible.value ? panelRowHeight + 'px' : '0' }"
    >
      <RoomHeader
        :room-name="roomName"
        :room-id="roomId"
        :peer-id="ownPeerId"
        :local-ip="ownLocalIP"
        :public-ip="ownPublicIP"
      />
      <div class="matrix-scroll">
        <div class="matrix-grid">
          <div class="header-label">Peer</div>
          <div class="header-cells">
            <span v-for="i in CHANNEL_COUNT" :key="i - 1" class="ch-num">{{ i - 1 }}</span>
          </div>
          <PeerRow
            v-for="peerId in sortedPeerIds"
            :key="peerId"
            :peer-id="peerId"
            :peer-name="getPeerName(peerId)"
            :peer-color="peerColor(peerId)"
            :peer-ip="peerIP(peerId)"
            :is-local="peerId === ownPeerId"
            :is-locked="isLocked(peerId)"
            :channels="peerChannels(peerId)"
            :channel-count="CHANNEL_COUNT"
            :selected-channel="cellIsActive(peerId, panelRow.activeId.value?.split('-')[1] ? Number(panelRow.activeId.value?.split('-')[1]) : -1) ? Number(panelRow.activeId.value?.split('-')[1]) : null"
            @cell-click="(ch) => onCellClick(peerId, ch)"
            @open-popup="(ch, rect) => onOpenPopup(peerId, ch, rect)"
            @remove-device="(ch) => onRemoveDevice(peerId, ch)"
          />
        </div>
      </div>
      <p v-if="sortedPeerIds.length === 0" class="muted">Waiting for peer data...</p>
    </div>

    <!-- Drag handle (only visible when panel row is open) -->
    <div
      v-if="panelRow.panelRowVisible.value"
      class="drag-handle"
      :style="{ bottom: panelRowHeight + 'px' }"
      @mousedown="onDragHandleMousedown"
    />

    <!-- Bottom: panel row -->
    <div
      v-if="panelRow.panelRowVisible.value"
      class="panel-row-area"
      :style="{ height: panelRowHeight + 'px' }"
    >
      <PanelRow
        :slots="panelRow.allSlots.value"
        :active-id="panelRow.activeId.value"
        :get-device-state="getDeviceState"
        :get-device-settings="peerSettings"
        :get-peer-name="getPeerName"
        :is-local="(peerId) => peerId === ownPeerId"
        :is-locked="isLocked"
        @pin="onPanelPin"
        @close="onPanelClose"
        @activate="onPanelActivate"
        @reorder="onPanelReorder"
        @remove="onPanelRemove"
      />
    </div>

    <AddDevicePopup
      v-if="popupOpen && popupRect"
      :anchor-rect="popupRect"
      :target-local-props="peerSettings(popupPeerId)?.localProps"
      @select="onPopupSelect"
      @close="closePopup"
    />
  </div>
</template>
```

- [ ] **Step 3: Replace the style section**

```vue
<style scoped>
.matrix-view {
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.matrix-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  overflow: hidden;
  transition: bottom 0.15s;
  display: flex;
  flex-direction: column;
}

.matrix-scroll {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-color: #555 transparent;
  scrollbar-width: thin;
  padding: 12px;
  padding-bottom: 4px;
}

.matrix-scroll::-webkit-scrollbar { height: 8px; }
.matrix-scroll::-webkit-scrollbar-track { background: transparent; }
.matrix-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
.matrix-scroll::-webkit-scrollbar-thumb:hover { background: #777; }

.matrix-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 4px;
  width: max-content;
  min-width: 100%;
}

.header-label {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #1a1a1a;
  min-width: 150px;
  max-width: 150px;
  font-size: 11px;
  color: #888;
  padding: 0 10px 4px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: flex-end;
}

.header-cells {
  display: flex;
  gap: 2px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
  align-items: flex-end;
}

.ch-num {
  min-width: 50px;
  width: 50px;
  text-align: center;
  font-size: 10px;
  color: #555;
}

.muted {
  color: #888;
  font-size: 12px;
  margin-top: 16px;
  padding: 0 12px;
}

.drag-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  background: #2a2a2a;
  cursor: ns-resize;
  z-index: 10;
  transition: background 0.1s;
}

.drag-handle:hover {
  background: #444;
}

.panel-row-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  overflow: hidden;
}
</style>
```

- [ ] **Step 4: Fix the `selected-channel` prop binding**

The current `selected-channel` logic in the template above is complex because `activeId` is a compound string. Replace the `PeerRow` `:selected-channel` binding with a cleaner computed helper. Add this to the script:

```typescript
function selectedChannelForPeer(peerId: string): number | null {
  const id = panelRow.activeId.value
  if (!id) return null
  const [aPeerId, aCh] = id.split('-')
  if (aPeerId !== peerId) return null
  return Number(aCh)
}
```

Then in the template, replace the complex `:selected-channel` binding on `PeerRow` with:
```
:selected-channel="selectedChannelForPeer(peerId)"
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. Fix any type issues before proceeding.

- [ ] **Step 6: Start dev server and verify visually**

```bash
npm run dev
```

Verify:
- Matrix fills full height when no panel is open
- Clicking a device cell opens the panel row at the bottom
- Drag handle appears between matrix and panel row
- Dragging handle resizes the split
- Pin button promotes floating panel to pinned
- Close button on pinned panel removes it
- Panel row collapses when last panel is closed
- Clicking a panel slot header highlights the correct cell in the matrix

- [ ] **Step 7: Commit**

```bash
git add src/renderer/views/MatrixView.vue
git commit -m "feat: refactor MatrixView to vertical split with resizable panel row"
```

---

## Task 7: Fix `activateSlot` bidirectional sync in `usePanelRow`

**Files:**
- Modify: `src/renderer/composables/usePanelRow.ts`

The current `activateSlot` doesn't update `activeId` when a pinned panel is clicked. Fix that.

- [ ] **Step 1: Update `activateSlot` in `usePanelRow.ts`**

Replace the existing `activateSlot` function:

```typescript
function activateSlot(id: string) {
  activeId.value = id
  // If it's a pinned slot, clear floating (the pinned slot is now the active view)
  if (pinnedSlots.value.find(s => s.id === id)) {
    floatingSlot.value = null
  }
}
```

Also update `selectCell` to set `activeId` when opening a floating slot:

```typescript
function selectCell(peerId: string, channelIndex: number) {
  const id = makeId(peerId, channelIndex)

  const alreadyPinned = pinnedSlots.value.find(s => s.id === id)
  if (alreadyPinned) {
    floatingSlot.value = null
    activeId.value = id   // highlight the existing pinned slot
    return
  }

  floatingSlot.value = { id, peerId, channelIndex, pinned: false }
  activeId.value = id
}
```

And update `clearSelection`:

```typescript
function clearSelection() {
  floatingSlot.value = null
  activeId.value = null
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Test bidirectional sync manually**

```bash
npm run dev
```

Verify:
- Click device cell → cell glows, panel opens, panel header highlighted
- Click a different device cell → first panel closes (if floating), new panel opens
- Pin a panel → it stays; clicking its header in panel row → cell in matrix glows
- Click empty cell → floating panel closes, active highlight clears

- [ ] **Step 4: Commit**

```bash
git add src/renderer/composables/usePanelRow.ts
git commit -m "fix: bidirectional selection sync between matrix cells and panel slots"
```

---

## Task 8: Wire `onAddDevice` auto-open after creation

**Files:**
- Modify: `src/renderer/views/MatrixView.vue`

After adding a device, `activateCell` is called optimistically. But the echo-driven architecture means the cell won't have `loaded > 0` in peerState until the MQTT echo arrives. We need to handle this gracefully.

- [ ] **Step 1: Update `onAddDevice` to wait for state then open**

The optimistic `activateCell` call in Task 6 opens the panel immediately. The `DevicePanel` will render with a partial `deviceState` (loaded may still be `'0'`). The panel body will show the "unsupported" fallback briefly until the echo arrives and peerState updates.

This is acceptable behavior — the reactive `deviceState` passed to `DevicePanel` is a live reference from `peerState`, so it will update automatically when the echo arrives.

No code change needed — verify this works correctly:

```bash
npm run dev
```

Steps to verify:
1. Click an empty cell → AddDevicePopup appears
2. Select a device type → popup closes, panel row opens
3. Within 50–200ms (broker RTT), panel body updates from "unsupported" to the correct device panel
4. If the brief "unsupported" flash is unacceptable, add a loading state — but only if it's actually visible.

- [ ] **Step 2: If the flash is visible, add a loading guard to `DevicePanel.vue`**

Replace the `v-else` unsupported block with:

```vue
<div v-else-if="loaded === '0'" class="unsupported loading">
  <span>Initializing...</span>
</div>
<div v-else class="unsupported">
  Device type {{ loaded }} is not yet supported in this milestone.
</div>
```

Add to style:
```css
.loading {
  color: #555;
  font-style: italic;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/DevicePanel.vue
git commit -m "fix: show loading state in DevicePanel while MQTT echo is in flight"
```

---

## Task 9: Drag-and-drop reorder — verify and polish

**Files:**
- Modify: `src/renderer/components/PanelRow.vue`

HTML5 DnD requires a `dataTransfer.setData` call in `dragstart` or the drag won't work on some browsers/Electron versions.

- [ ] **Step 1: Fix `onDragStart` to set dataTransfer**

```typescript
function onDragStart(e: DragEvent, index: number, slot: PanelSlot) {
  if (!slot.pinned) return
  dragFromIndex.value = index
  e.dataTransfer?.setData('text/plain', String(index))
}
```

Update the template to pass `$event`:
```vue
@dragstart="(e) => onDragStart(e, index, slot)"
```

- [ ] **Step 2: Test drag-to-reorder manually**

```bash
npm run dev
```

Verify:
- Pin two or more panels
- Grab a pinned panel header and drag it left/right
- Drop indicator (cyan left border) appears on target slot
- On drop, panels swap positions correctly
- Floating panel (rightmost) cannot be dragged

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PanelRow.vue
git commit -m "fix: set dataTransfer in dragstart for Electron DnD compatibility"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Covered in Task |
|-------------|----------------|
| Workspace split matrix top / panel row bottom | Task 6 |
| Panel row adaptive (collapses when empty) | Task 2, Task 6 |
| User-resizable split via drag handle | Task 6 |
| Drag handle height persists to settings.json | Task 1, Task 6 |
| One floating slot, always rightmost | Task 2 |
| Pinned slots left of floating | Task 2 |
| Horizontal scroll for overflow | Task 5 |
| Clicking cell opens floating panel | Task 6, Task 7 |
| Clicking already-pinned cell highlights pinned slot | Task 7 |
| Floating panel has pin button only (no close) | Task 3 |
| Pinned panel has close button (no pin) | Task 3 |
| Panel slot header: device icon + peer + channel + metrics | Task 3 |
| Live UG metrics (FPS/dB TX and RX) in header | Task 3 |
| Live OSC/MoCap activity pulses in header | Task 3 |
| Bidirectional selection sync | Task 7 |
| Clicking empty cell clears floating panel | Task 6 |
| Drag-to-reorder pinned panels | Task 5, Task 9 |
| Floating panel cannot be reordered | Task 5 |
| Any peer's device can be opened (no read-only restriction) | Task 4 (props unchanged) |
| Auto-open panel after device creation | Task 6, Task 8 |
| Uniform 380px panel width | Task 5 |
| Panel row height persists across sessions | Task 1, Task 6 |
| Panel row clears on room leave (MatrixView unmounts) | inherent — no task needed |

### Placeholder Scan

No TBD, TODO, or "similar to task N" patterns found. All code steps are complete.

### Type Consistency

- `PanelSlot` defined in `usePanelRow.ts` Task 2, imported by `PanelRow.vue` Task 5 ✓
- `activeId` is `ref<string | null>` throughout ✓
- `allSlots` is `computed<PanelSlot[]>` ✓
- `reorder` event signature `[fromIndex: number, toIndex: number]` matches `onPanelReorder` handler ✓
- `remove` event on `PanelRow` is `[peerId: string, channelIndex: number]`, matches `onPanelRemove` ✓
- `DevicePanel` no longer emits `close` — it emits `remove` only; callers updated ✓
