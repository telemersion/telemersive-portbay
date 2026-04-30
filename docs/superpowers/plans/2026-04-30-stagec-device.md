# StageControl Device Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the StageControl (`loaded=4`) device type in the UI and add a dedicated `StageControlPanel.vue` that mirrors `OscPanel` with an always-visible "Open in browser" button for the per-room Open Stage Control web UI.

**Architecture:** The backend handler (`OscDevice` with `deviceType=4`), port allocation, and routing are already fully implemented. This plan only touches the renderer layer plus the `publishInitSequence` in `src/main/index.ts`. A new singleton composable `useSessionInfo` provides `brokerHost` and `roomId` to the panel without prop drilling. A new `StageControlPanel.vue` wraps the same OSC bindings with the browser button added.

**Tech Stack:** TypeScript, Vue 3 (Composition API `<script setup>`), Electron IPC via `window.api`, Vitest for tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/main/index.ts` | Modify | Publish `stagec_enable '1'` in init sequence |
| `src/renderer/components/AddDevicePopup.vue` | Modify | Flip StageControl tile to `implemented: true` |
| `src/renderer/composables/useSessionInfo.ts` | Create | Singleton `{ brokerHost: Ref<string>, roomId: Ref<number> }` |
| `src/renderer/components/panels/StageControlPanel.vue` | Create | OSC panel + "Open Stage Control" browser button |
| `src/renderer/components/DevicePanel.vue` | Modify | Route `loaded=4` to `StageControlPanel` instead of `OscPanel` |

---

### Task 1: Publish `stagec_enable` in init sequence

**Files:**
- Modify: `src/main/index.ts` (around line 130)

- [ ] **Step 1: Add the publish**

Open `src/main/index.ts`. Find these two consecutive lines (around line 129–130):

```ts
  trackedPublish(1, topics.settings(peerId, 'localProps/ug_enable'), resolveUgPath() ? '1' : '0')
  trackedPublish(1, topics.settings(peerId, 'localProps/natnet_enable'), '1')
```

Add one line after them:

```ts
  trackedPublish(1, topics.settings(peerId, 'localProps/ug_enable'), resolveUgPath() ? '1' : '0')
  trackedPublish(1, topics.settings(peerId, 'localProps/natnet_enable'), '1')
  trackedPublish(1, topics.settings(peerId, 'localProps/stagec_enable'), '1')
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: publish stagec_enable=1 in peer init sequence"
```

---

### Task 2: Enable StageControl tile in AddDevicePopup

**Files:**
- Modify: `src/renderer/components/AddDevicePopup.vue` (line 24)

- [ ] **Step 1: Flip the flag**

Open `src/renderer/components/AddDevicePopup.vue`. Find line 24:

```ts
  { type: 4, label: 'StageControl', color: '#FE5FF5', flag: 'stagec_enable', implemented: false },
```

Change to:

```ts
  { type: 4, label: 'StageControl', color: '#FE5FF5', flag: 'stagec_enable', implemented: true },
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/AddDevicePopup.vue
git commit -m "feat: enable StageControl tile in AddDevicePopup"
```

---

### Task 3: Create `useSessionInfo` composable

**Files:**
- Create: `src/renderer/composables/useSessionInfo.ts`

The composable is a module-level singleton (refs live outside the function so all callers share the same reactive state). It populates `brokerHost` from `settings:load` and `roomId` from `peer:room:id` IPC events plus the initial `bus:state` / `bus:localPeer` snapshots.

- [ ] **Step 1: Create the file**

Create `src/renderer/composables/useSessionInfo.ts` with this content:

```ts
import { ref } from 'vue'

const brokerHost = ref('telemersion.zhdk.ch')
const roomId = ref(0)

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  window.api.invoke('settings:load').then((settings: any) => {
    if (settings?.brokerUrl) brokerHost.value = settings.brokerUrl
  })

  window.api.invoke('bus:state').then((s: any) => {
    if (typeof s?.roomId === 'number') roomId.value = s.roomId
  })

  window.api.invoke('bus:localPeer').then((info: any) => {
    if (typeof info?.roomId === 'number') roomId.value = info.roomId
  })

  window.api.on('peer:room:id', (id: number) => { roomId.value = id })
}

export function useSessionInfo() {
  init()
  return { brokerHost, roomId }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/composables/useSessionInfo.ts
git commit -m "feat: add useSessionInfo composable for broker host and room id"
```

---

### Task 4: Create `StageControlPanel.vue`

**Files:**
- Create: `src/renderer/components/panels/StageControlPanel.vue`

This panel is structurally identical to `OscPanel.vue` with one addition: an "Open Stage Control ↗" button that opens `http://${brokerHost}:${roomId * 1000 + 900}` in the system browser via `window.open`. The button is always visible, disabled only when `roomId === 0`.

The full `OscPanel.vue` content lives at `src/renderer/components/panels/OscPanel.vue` — read it before writing this file to confirm bindings match exactly.

- [ ] **Step 1: Create the file**

Create `src/renderer/components/panels/StageControlPanel.vue`:

```vue
<script setup lang="ts">
import { useMqttBinding } from '../../composables/useMqttBinding'
import { useSessionInfo } from '../../composables/useSessionInfo'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  isLocal: boolean
  targetLocked: boolean
}>()

const { brokerHost, roomId } = useSessionInfo()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const udp = computed(() => gui.value?.localudp ?? {})
const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => isEnabled.value || (!props.isLocal && props.targetLocked))

const prefix = computed(() =>
  `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/device/gui`
)

function bind(subpath: string, getter: () => string | undefined) {
  return useMqttBinding(getter, `${prefix.value}/${subpath}`)
}

const enableBinding = bind('enable', () => gui.value?.enable)
const descBinding = bind('description', () => gui.value?.description)
const outputIPOne = bind('localudp/outputIPOne', () => udp.value?.outputIPOne)
const outputPortOne = bind('localudp/outputPortOne', () => udp.value?.outputPortOne)
const enableTwo = bind('localudp/enableTwo', () => udp.value?.enableTwo)
const outputIPTwo = bind('localudp/outputIPTwo', () => udp.value?.outputIPTwo)
const outputPortTwo = bind('localudp/outputPortTwo', () => udp.value?.outputPortTwo)
const inputPort = bind('localudp/inputPort', () => udp.value?.inputPort)

const oscUrl = computed(() =>
  roomId.value > 0 ? `http://${brokerHost.value}:${roomId.value * 1000 + 900}` : ''
)

const emit = defineEmits<{ remove: [] }>()

function toggleEnable() {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

async function removeDevice() {
  const topic = `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: '0', retain: true })
  emit('remove')
}

async function resetDevice() {
  await window.api.invoke('mqtt:publish', {
    topic: `${prefix.value}/localudp/reset`,
    value: '1',
    retain: true
  })
}

function openOsc() {
  if (oscUrl.value) window.open(oscUrl.value, '_blank')
}
</script>

<template>
  <div class="stagec-panel">
    <div class="panel-header">
      <button
        class="enable-btn"
        :class="{ active: isEnabled }"
        :disabled="!isLocal && targetLocked"
        @click="toggleEnable"
      >
        {{ isEnabled ? 'ON' : 'OFF' }}
      </button>
      <input
        class="description-input"
        :value="descBinding.value.value"
        :disabled="isLocked"
        @change="descBinding.set(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="open-osc-row">
      <button
        class="open-osc-btn"
        :disabled="roomId === 0"
        :title="oscUrl || 'Join a room first'"
        @click="openOsc"
      >
        Open Stage Control ↗
      </button>
    </div>

    <section>
      <h4>Forward to</h4>
      <div class="field-row">
        <label>output 1</label>
        <input
          :value="outputIPOne.value.value"
          :disabled="isLocked"
          placeholder="IP address"
          @change="outputIPOne.set(($event.target as HTMLInputElement).value)"
        />
        <input
          class="port-input"
          :value="outputPortOne.value.value"
          :disabled="isLocked"
          placeholder="port"
          @change="outputPortOne.set(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-row">
        <button
          class="toggle-btn label-slot"
          :class="{ on: enableTwo.value.value === '1' }"
          :disabled="isLocked"
          @click="enableTwo.set(enableTwo.value.value === '1' ? '0' : '1')"
        >
          {{ enableTwo.value.value === '1' ? 'output 2' : 'output 2 off' }}
        </button>
        <template v-if="enableTwo.value.value === '1'">
          <input
            :value="outputIPTwo.value.value"
            :disabled="isLocked"
            placeholder="IP address"
            @change="outputIPTwo.set(($event.target as HTMLInputElement).value)"
          />
          <input
            class="port-input"
            :value="outputPortTwo.value.value"
            :disabled="isLocked"
            placeholder="port"
            @change="outputPortTwo.set(($event.target as HTMLInputElement).value)"
          />
        </template>
      </div>
    </section>

    <section>
      <h4>Receiving at</h4>
      <div class="field-row">
        <label>input</label>
        <input :value="udp.peerLocalIP" disabled placeholder="IP address" />
        <input class="port-input" :value="inputPort.value.value" disabled placeholder="port" />
      </div>
    </section>

    <div class="panel-actions">
      <button class="reset-btn" @click="resetDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Reset to Defaults
      </button>
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Remove Device
      </button>
    </div>
  </div>
</template>

<style scoped>
.stagec-panel { padding: 12px; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; background: #333; color: #ccc; }
.enable-btn.active { background: #1D9E75; color: white; border-color: #1D9E75; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
.open-osc-row { margin-bottom: 12px; }
.open-osc-btn { width: 100%; padding: 7px 12px; border-radius: 6px; border: 1px solid #FE5FF5; background: none; color: #FE5FF5; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.15s, color 0.15s; }
.open-osc-btn:hover:not(:disabled) { background: #FE5FF5; color: #111; }
.open-osc-btn:disabled { opacity: 0.35; cursor: not-allowed; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input { flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row input:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 72px !important; flex: none !important; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 11px; }
.toggle-btn.on { background: #FE5FF5; color: white; border-color: #FE5FF5; }
.toggle-btn.label-slot { min-width: 70px; text-align: center; }
.toggle-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; display: flex; gap: 8px; }
.reset-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #888; background: none; color: #aaa; cursor: pointer; font-size: 11px; }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/StageControlPanel.vue src/renderer/composables/useSessionInfo.ts
git commit -m "feat: add StageControlPanel with Open Stage Control browser button"
```

---

### Task 5: Wire `StageControlPanel` into `DevicePanel.vue`

**Files:**
- Modify: `src/renderer/components/DevicePanel.vue`

- [ ] **Step 1: Update the component**

Open `src/renderer/components/DevicePanel.vue`. Replace the entire file content with:

```vue
<script setup lang="ts">
import OscPanel from './panels/OscPanel.vue'
import StageControlPanel from './panels/StageControlPanel.vue'
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
    <StageControlPanel
      v-if="loaded === '4'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <OscPanel
      v-else-if="loaded === '1'"
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

    <div v-else-if="loaded === '0'" class="unsupported loading">
      <span>Initializing...</span>
    </div>

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
  min-height: 0;
}

.unsupported {
  padding: 24px;
  color: #666;
  text-align: center;
}

.loading {
  color: #555;
  font-style: italic;
}
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass (no renderer unit tests exist for these components, but the suite should be green).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/DevicePanel.vue
git commit -m "feat: route loaded=4 to StageControlPanel in DevicePanel"
```

---

### Task 6: Manual smoke test

This is a UI feature — verify end-to-end in the running app.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Join a room**

Connect to the broker and join any room. Confirm the room ID is visible in the header (e.g. `#11`).

- [ ] **Step 3: Add a StageControl device**

Click `+` on an empty channel in your own row. Confirm the StageControl tile is now enabled (pink dot, not greyed out). Click it. Confirm:
- The matrix cell turns pink (`#FE5FF5`) with the bidi icon
- Opening the panel shows the StageControl panel with "Open Stage Control ↗" button
- The "Forward to" and "Receiving at" sections are populated with IP/port defaults

- [ ] **Step 4: Test the browser button**

Click "Open Stage Control ↗". Confirm the system browser opens at `http://<broker>:<roomId * 1000 + 900>`.

- [ ] **Step 5: Confirm button disabled before room join**

Disconnect and remain on the session screen (or observe state before joining). The button should be disabled (greyed, `roomId === 0`).

- [ ] **Step 6: Test on a remote peer channel**

If a second peer is available, have them or simulate them adding a StageControl device on their channel. Confirm:
- The browser button is still visible and functional in the remote panel view
- The URL uses the same `roomId` (shared per room, not per peer)
