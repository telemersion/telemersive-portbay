# Telemersive Gateway NG — M0 + M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable Electron + Vue 3 app that connects to the telemersive broker, joins a room, renders a peer matrix, and lets the user create/configure/enable/disable/remove OSC devices — with full cross-client interop against the existing Max gateway.

**Architecture:** Electron main process hosts the telemersive-bus client (BusClient) and a single mqtt.js MQTT client. Renderer is a Vue 3 SPA connected via a thin IPC bridge. State flows echo-driven: UI publishes via IPC → main publishes to broker → broker echoes → main routes to device handlers (which live in main) and forwards to renderer for UI re-render. OSC forwarding is a lightweight Node.js `dgram` UDP relay (no child process — unlike UltraGrid which spawns a CLI binary). See spec §5.1 for the full echo model.

**Tech Stack:** Electron (via electron-vite scaffold), Vue 3 + TypeScript, mqtt.js, telemersive-bus (npm), Node.js `dgram` for OSC relay.

**Spec reference:** `docs/spec.md` — all `§` references point there.

**Milestone map:**
- **M0** — Spike: bus-in-Electron + echo proof (this plan, Tasks 1-5)
- **M1** — OSC device end-to-end (this plan, Tasks 6-19)
- M2-M5 — separate plans after M1 ships and interop passes

---

## File Structure

### M0 files (spike — some will be rewritten in M1)

```
src/
  main/
    index.ts              — Electron main entry (electron-vite default)
    busClient.ts          — Typed wrapper around telemersive-bus BusClient
    mqttBridge.ts         — mqtt.js client, subscribe/publish, echo routing
    ipc.ts                — preload script + contextBridge API
  renderer/
    App.vue               — spike shell: connect form + echo display
    main.ts               — Vue app entry
  shared/
    types.ts              — Shared type definitions (BusEvent, MqttMessage)
electron.vite.config.ts   — electron-vite config
package.json
tsconfig.json
```

### M1 additions/rewrites

```
src/
  main/
    busClient.ts          — extended with full event vocabulary (§7.2)
    mqttBridge.ts         — extended with subscription lifecycle (§4.6)
    ipc.ts                — extended with roster + state channels
    deviceRouter.ts       — watches loaded changes, instantiates handlers (§5.2)
    portAllocator.ts      — pure function: (roomId, channelIndex, slot) → port (§8.7)
    persistence/
      settings.ts         — read/write settings.json (§6.3)
      rack.ts             — read/write rack.json (§6.6)
    devices/
      OscDevice.ts        — OSC/StageC handler with dgram UDP relay (§5.4)
      types.ts            — DeviceHandler interface
    shutdown.ts           — app-quit sequence (§3.6)
  renderer/
    App.vue               — rewritten: router between views
    router.ts             — vue-router: connect → rooms → matrix
    state/
      peerState.ts        — reactive MQTT state tree (§4.4)
      roster.ts           — reactive roster from bus events (§4.4)
    composables/
      useMqttBinding.ts   — computed getter + publish setter (§9.5)
    views/
      ConnectView.vue     — broker credentials form (§6.5 step 1-2)
      RoomPickerView.vue  — room list + join form (§6.5 step 3-5)
      MatrixView.vue      — matrix + panel drawer (§9.1)
    components/
      PeerRow.vue         — one peer's row in the matrix
      DeviceCell.vue      — single channel cell (§9.2)
      DevicePanel.vue     — drawer container with breadcrumb (§9.4)
      AddDevicePopup.vue  — device-type picker on empty cell (§9.3)
      panels/
        OscPanel.vue      — OSC device config form (§5.4, mockup: osc_panel.html)
  shared/
    topics.ts             — topic path builders + template-literal types
    types.ts              — extended with PeerState, RosterEntry, DeviceType, etc.
tests/
  main/
    portAllocator.test.ts — unit tests for port formula
    deviceRouter.test.ts  — state machine tests
    devices/
      OscDevice.test.ts   — UDP relay tests (mock dgram)
  renderer/
    state/
      peerState.test.ts   — topic → tree insertion tests
```

---

## M0 — Spike: Bus-in-Electron + Echo Proof

### Task 1: Scaffold the Electron + Vue + TS project

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `src/main/index.ts`, `src/renderer/main.ts`, `src/renderer/App.vue`

- [ ] **Step 1: Scaffold with electron-vite**

```bash
npm create @electron-vite telemersive-gateway-ng -- --template vue-ts
cd telemersive-gateway-ng
```

If `npm create @electron-vite` is unavailable or the template has changed, scaffold manually:

```bash
mkdir telemersive-gateway-ng && cd telemersive-gateway-ng
npm init -y
npm install electron electron-vite vue
npm install -D typescript @vitejs/plugin-vue
```

- [ ] **Step 2: Verify the scaffold runs**

```bash
npm run dev
```

Expected: an Electron window opens with the template's default content. Close it.

- [ ] **Step 3: Install telemersive-bus and mqtt.js**

```bash
npm install telemersive-bus mqtt
npm install -D @types/node
```

- [ ] **Step 4: Configure electron-vite to externalize telemersive-bus**

In `electron.vite.config.ts`, ensure `telemersive-bus` is treated as an external (CJS package, may have native deps):

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [vue()]
  }
})
```

- [ ] **Step 5: Verify it still runs**

```bash
npm run dev
```

Expected: Electron window opens without errors. Check the main-process console for any `telemersive-bus` load errors (there shouldn't be any yet — we haven't imported it).

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold electron-vite + vue-ts project with telemersive-bus"
```

---

### Task 2: busClient.ts — typed wrapper around telemersive-bus

**Files:**
- Create: `src/shared/types.ts`, `src/main/busClient.ts`

- [ ] **Step 1: Define shared types**

```typescript
// src/shared/types.ts

export type BusEventType =
  | 'broker:connected'
  | 'peer:joined'
  | 'peer:id'
  | 'peer:name'
  | 'peer:localIP'
  | 'peer:publicIP'
  | 'peer:room:name'
  | 'peer:room:id'
  | 'peer:room:uuid'
  | 'rooms:update'
  | 'peers:remote:joined'
  | 'peers:remote:left'
  | 'ready'
  | 'chat'

export interface BusEvent {
  type: BusEventType
  payload: unknown
}

export interface RemotePeerInfo {
  peerName: string
  peerId: string
  localIP: string
  publicIP: string
}

export interface MqttMessage {
  topic: string
  payload: string
  retained: boolean
}

export interface BrokerConfig {
  host: string
  port: number
  username: string
  password: string
  localIP: string
}
```

- [ ] **Step 2: Implement busClient.ts**

```typescript
// src/main/busClient.ts
import { EventEmitter } from 'events'
import type { BrokerConfig, RemotePeerInfo } from '../shared/types'

const APPVERSION = 'TeGateway_v0612'

let BusClientClass: any

try {
  const telemersion = require('telemersive-bus')
  BusClientClass = telemersion.BusClient
} catch (err) {
  console.error('Failed to load telemersive-bus:', err)
}

export class TBusClient extends EventEmitter {
  private client: any
  private _peerId: string = ''

  constructor() {
    super()
    if (!BusClientClass) {
      throw new Error('telemersive-bus not available')
    }
    this.client = new BusClientClass(APPVERSION)
    this.client.setCallback(this.onBubbledUp.bind(this))
  }

  get peerId(): string {
    return this._peerId
  }

  async init(): Promise<Record<string, string>> {
    return await this.client.init()
  }

  configure(config: BrokerConfig): void {
    this.client.configureServer(
      'mqtt://' + config.host,
      config.port,
      config.username,
      config.password,
      config.localIP
    )
  }

  async connect(): Promise<void> {
    await this.client.connectServer()
  }

  async disconnect(): Promise<void> {
    await this.client.disconnectServer()
  }

  async join(peerName: string, roomName: string, roomPwd: string): Promise<void> {
    await this.client.join(peerName, roomName, roomPwd)
  }

  async leave(): Promise<void> {
    await this.client.leave()
  }

  async publish(retained: boolean, topic: string, ...values: (string | number)[]): Promise<void> {
    await this.client.peer.mqttClient.publish(
      retained ? 1 : 0,
      topic,
      values
    )
  }

  async subscribe(topic: string): Promise<void> {
    await this.client.peer.mqttClient.subscribe(topic)
  }

  async unsubscribe(topic: string): Promise<void> {
    await this.client.peer.mqttClient.unsubscribe(topic)
  }

  private onBubbledUp(message: string, content: any[]): void {
    if (message === 'bus') {
      this.parseBusEvent(content)
    } else if (message === 'chat') {
      this.emit('chat', content)
    } else if (message === 'mqtt') {
      // Incoming MQTT message from broker: content = [topic, ...values]
      const topic = String(content[0])
      const payload = content.slice(1).join(' ')
      this.emit('mqtt:message', { topic, payload })
    }
    // 'publish' messages are outgoing confirmations — ignore (we trust the echo)
  }

  private parseBusEvent(content: any[]): void {
    const key = content.slice(0, 2).join(' ')
    switch (key) {
      case 'broker connected':
        this.emit('broker:connected', content[2] === 1)
        break
      case 'peer joined':
        this.emit('peer:joined', content[2] === 1)
        break
      case 'peer id':
        this._peerId = String(content[2])
        this.emit('peer:id', this._peerId)
        break
      case 'peer name':
        this.emit('peer:name', String(content[2]))
        break
      case 'peer localIP':
        this.emit('peer:localIP', String(content[2]))
        break
      case 'peer publicIP':
        this.emit('peer:publicIP', String(content[2]))
        break
      case 'peer room': {
        const subKey = content[2]
        if (subKey === 'name') this.emit('peer:room:name', String(content[3]))
        else if (subKey === 'id') this.emit('peer:room:id', Number(content[3]))
        else if (subKey === 'uuid') this.emit('peer:room:uuid', String(content[3]))
        break
      }
      case 'rooms menu': {
        const action = content[2]
        if (action === 'clear') this.emit('rooms:clear')
        else if (action === 'append') this.emit('rooms:append', String(content[3]))
        break
      }
      case 'rooms listing':
        this.emit('rooms:listing', content.length > 2 ? String(content[2]) : null)
        break
      case 'rooms done':
        this.emit('rooms:done')
        break
      case 'peers remote': {
        const action = content[2]
        if (action === 'joined') {
          const info: RemotePeerInfo = {
            peerName: String(content[3]),
            peerId: String(content[4]),
            localIP: String(content[5]),
            publicIP: String(content[6])
          }
          this.emit('peers:remote:joined', info)
        } else if (action === 'left') {
          this.emit('peers:remote:left', String(content[3]))
        }
        break
      }
      case 'peers menu':
        break
      case 'peers done':
        break
      default:
        if (content[0] === 'ready') this.emit('ready')
        break
    }
  }
}
```

- [ ] **Step 3: Verify telemersive-bus loads**

Add a temporary import in `src/main/index.ts`:

```typescript
import { TBusClient } from './busClient'

const bus = new TBusClient()
console.log('TBusClient created, peerId will be assigned after init()')
```

Run `npm run dev`. Check the main-process console output.

Expected: `TBusClient created...` message. No errors about missing modules.

If you get a `require is not defined` or module resolution error, check:
- `electron.vite.config.ts` has `externalizeDepsPlugin()` for main
- `telemersive-bus` uses CJS `require()` internally — ensure it's not being bundled

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/main/busClient.ts src/main/index.ts
git commit -m "feat: add busClient.ts wrapper around telemersive-bus"
```

---

### Task 3: IPC bridge — preload + contextBridge

**Files:**
- Create: `src/main/ipc.ts` (preload script)
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create the preload script**

```typescript
// src/main/ipc.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  send: (channel: string, ...args: any[]) => {
    const allowed = ['bus:configure', 'bus:connect', 'bus:disconnect', 'bus:join', 'bus:leave', 'mqtt:publish']
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  invoke: (channel: string, ...args: any[]) => {
    const allowed = ['bus:init', 'bus:connect', 'bus:join', 'mqtt:publish', 'mqtt:subscribe', 'mqtt:unsubscribe']
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const allowed = [
      'bus:event', 'mqtt:message', 'broker:connected', 'peer:joined',
      'peer:id', 'peer:localIP', 'peer:publicIP', 'peer:room:name',
      'peer:room:id', 'rooms:update', 'peers:remote:joined',
      'peers:remote:left', 'ready'
    ]
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
```

- [ ] **Step 2: Wire IPC handlers in main/index.ts**

Replace the temporary content of `src/main/index.ts` with the full main process setup:

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { TBusClient } from './busClient'

let mainWindow: BrowserWindow | null = null
let bus: TBusClient | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/ipc.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupBus() {
  bus = new TBusClient()

  const forward = (channel: string) => {
    bus!.on(channel, (...args: any[]) => {
      mainWindow?.webContents.send(channel, ...args)
    })
  }

  forward('broker:connected')
  forward('peer:joined')
  forward('peer:id')
  forward('peer:name')
  forward('peer:localIP')
  forward('peer:publicIP')
  forward('peer:room:name')
  forward('peer:room:id')
  forward('peer:room:uuid')
  forward('rooms:clear')
  forward('rooms:append')
  forward('rooms:listing')
  forward('rooms:done')
  forward('peers:remote:joined')
  forward('peers:remote:left')
  forward('ready')
  forward('mqtt:message')
}

function setupIpcHandlers() {
  ipcMain.handle('bus:init', async () => {
    return await bus!.init()
  })

  ipcMain.on('bus:configure', (_event, config) => {
    bus!.configure(config)
  })

  ipcMain.handle('bus:connect', async () => {
    await bus!.connect()
  })

  ipcMain.handle('bus:join', async (_event, peerName, roomName, roomPwd) => {
    await bus!.join(peerName, roomName, roomPwd)
  })

  ipcMain.handle('mqtt:publish', async (_event, retained, topic, ...values) => {
    await bus!.publish(retained, topic, ...values)
  })

  ipcMain.handle('mqtt:subscribe', async (_event, topic) => {
    await bus!.subscribe(topic)
  })

  ipcMain.handle('mqtt:unsubscribe', async (_event, topic) => {
    await bus!.unsubscribe(topic)
  })
}

app.whenReady().then(async () => {
  setupBus()
  setupIpcHandlers()

  const ips = await bus!.init()
  console.log('Internal IPs:', ips)
  console.log('PeerId:', bus!.peerId)

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 3: Update electron-vite config for preload**

Ensure `electron.vite.config.ts` has the preload entry pointing at `src/main/ipc.ts`:

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { ipc: resolve(__dirname, 'src/main/ipc.ts') }
      }
    }
  },
  renderer: {
    plugins: [vue()],
    root: resolve(__dirname, 'src/renderer')
  }
})
```

- [ ] **Step 4: Run and verify IPC bridge loads**

```bash
npm run dev
```

Expected: Electron window opens. Main-process console shows `Internal IPs: {...}` and a peerId. No renderer errors in devtools.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts electron.vite.config.ts
git commit -m "feat: add IPC bridge (preload + contextBridge + main handlers)"
```

---

### Task 4: Spike renderer — connect + echo display

**Files:**
- Modify: `src/renderer/App.vue`

- [ ] **Step 1: Add type declaration for the window.api bridge**

```typescript
// src/renderer/env.d.ts
export {}

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
```

- [ ] **Step 2: Build the spike UI**

```vue
<!-- src/renderer/App.vue -->
<script setup lang="ts">
import { ref, reactive } from 'vue'

const config = reactive({
  host: 'telemersion.zhdk.ch',
  port: 3883,
  username: 'peer',
  password: 'telemersion2021',
  localIP: ''
})

const joinForm = reactive({
  peerName: 'NG-spike',
  roomName: '',
  roomPwd: ''
})

const state = reactive({
  connected: false,
  joined: false,
  peerId: '',
  localIP: '',
  publicIP: '',
  rooms: [] as string[],
  log: [] as string[]
})

function log(msg: string) {
  state.log.unshift(`${new Date().toLocaleTimeString()} ${msg}`)
  if (state.log.length > 100) state.log.length = 100
}

// Bus event listeners
window.api.on('broker:connected', (connected: boolean) => {
  state.connected = connected
  log(`broker:connected ${connected}`)
})

window.api.on('peer:joined', (joined: boolean) => {
  state.joined = joined
  log(`peer:joined ${joined}`)
})

window.api.on('peer:id', (id: string) => {
  state.peerId = id
  log(`peer:id ${id}`)
})

window.api.on('peer:localIP', (ip: string) => {
  state.localIP = ip
  config.localIP = ip
  log(`peer:localIP ${ip}`)
})

window.api.on('peer:publicIP', (ip: string) => {
  state.publicIP = ip
  log(`peer:publicIP ${ip}`)
})

window.api.on('rooms:clear', () => {
  state.rooms = []
})

window.api.on('rooms:append', (name: string) => {
  state.rooms.push(name)
  log(`room found: ${name}`)
})

window.api.on('mqtt:message', (msg: { topic: string, payload: string }) => {
  log(`mqtt echo: ${msg.topic} = ${msg.payload}`)
})

window.api.on('peers:remote:joined', (info: any) => {
  log(`remote peer joined: ${info.peerName} (${info.peerId})`)
})

window.api.on('ready', () => {
  log('bus ready')
})

async function doConnect() {
  window.api.send('bus:configure', config)
  await window.api.invoke('bus:connect')
}

async function doJoin() {
  await window.api.invoke('bus:join', joinForm.peerName, joinForm.roomName, joinForm.roomPwd)
}

async function doPublishTest() {
  await window.api.invoke('mqtt:publish', true, `/peer/${state.peerId}/settings/lock/enable`, '0')
  log('published lock/enable 0 — waiting for echo...')
}
</script>

<template>
  <div style="font-family: monospace; padding: 16px; font-size: 13px">
    <h2>NG Spike — Bus-in-Electron + Echo</h2>

    <fieldset style="margin-bottom: 12px">
      <legend>Broker</legend>
      <div>
        <label>Host: <input v-model="config.host" /></label>
        <label>Port: <input v-model.number="config.port" type="number" /></label>
      </div>
      <div>
        <label>User: <input v-model="config.username" /></label>
        <label>Pwd: <input v-model="config.password" type="password" /></label>
      </div>
      <button @click="doConnect" :disabled="state.connected">Connect</button>
      <span v-if="state.connected" style="color: green"> connected</span>
    </fieldset>

    <fieldset v-if="state.connected" style="margin-bottom: 12px">
      <legend>Join Room</legend>
      <div>Rooms: {{ state.rooms.length === 0 ? '(none found)' : state.rooms.join(', ') }}</div>
      <div>
        <label>Peer name: <input v-model="joinForm.peerName" /></label>
        <label>Room: <input v-model="joinForm.roomName" /></label>
        <label>Password: <input v-model="joinForm.roomPwd" type="password" /></label>
      </div>
      <button @click="doJoin" :disabled="state.joined">Join</button>
      <span v-if="state.joined" style="color: green"> joined</span>
    </fieldset>

    <fieldset v-if="state.joined" style="margin-bottom: 12px">
      <legend>Echo Test</legend>
      <div>peerId: {{ state.peerId }}</div>
      <div>localIP: {{ state.localIP }} | publicIP: {{ state.publicIP }}</div>
      <button @click="doPublishTest">Publish lock/enable 0 (test echo)</button>
    </fieldset>

    <fieldset>
      <legend>Event Log</legend>
      <div style="max-height: 300px; overflow-y: auto; background: #111; color: #8bf; padding: 8px; border-radius: 4px">
        <div v-for="(line, i) in state.log" :key="i">{{ line }}</div>
        <div v-if="state.log.length === 0" style="color: #555">waiting for events...</div>
      </div>
    </fieldset>
  </div>
</template>
```

- [ ] **Step 3: Run the spike end-to-end**

```bash
npm run dev
```

1. Enter broker credentials (defaults should work for telemersion.zhdk.ch).
2. Click Connect. Expect `broker:connected true` in the log.
3. Room list should populate. Select or type a room name + password.
4. Click Join. Expect `peer:joined true`, `peer:id {uuid}`, `peer:localIP`, `peer:publicIP`.
5. Click "Publish lock/enable 0". Expect an `mqtt echo:` line showing the topic echoed back.

If step 5 works, **echo-driven execution is validated** — the highest-risk integration point.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.vue src/renderer/env.d.ts
git commit -m "feat: spike renderer with connect/join/echo-test UI"
```

---

### Task 5: M0 interop test + roomID spike

**Files:** None created — this is a test-and-investigate task.

- [ ] **Step 1: Cross-client interop test**

With the NG spike running and joined to a room:

1. Open the Max gateway. Join the **same room** with the **same password**.
2. In NG's event log, confirm you see `remote peer joined: {MaxPeerName} ({MaxPeerId})`.
3. In Max's matrix, confirm the NG spike peer appears as a row (it should — NG published `bus peer joined` and the room manager accepted it).
4. In NG's log, confirm you see `mqtt echo:` lines for Max's retained topics arriving (its `loaded 0` x 20, its `lock/enable`, its `background/color`, etc.).

- [ ] **Step 2: RoomID-vs-port investigation**

While both peers are joined:

1. In NG's event log, note the `peer:room:id` value (e.g., `11`).
2. In Max, create an OSC device on channel 0. Note the ports Max publishes (visible in NG's log as `mqtt echo: /peer/{MaxPeerId}/rack/page_0/channel.0/device/gui/localudp/outputPortOne {value}`).
3. Compute: does `bus peer room id` match the first 2 digits of the port?
   - If `room id = 11` and port = `11008` → direct match. Use `bus peer room id` as the port prefix in `portAllocator.ts`.
   - If `room id = 11` but port = `10008` → mismatch. Need further investigation (check if room ID is 1-indexed while port prefix is 0-indexed, or if there's a separate mapping).
4. Record the finding. This determines M1 Task 11's implementation.

- [ ] **Step 3: Log peer-leave event shape**

Disconnect the Max peer from the room. Check NG's event log for `peers:remote:left` — note the payload shape (just peerId, or peerId + peerName?). Update `busClient.ts` parsing if needed.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjustments from M0 interop test"
```

---

## M1 — OSC Device End-to-End

### Task 6: Topic path builders (src/shared/topics.ts)

**Files:**
- Create: `src/shared/topics.ts`
- Create: `tests/shared/topics.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/shared/topics.test.ts
import { describe, it, expect } from 'vitest'
import { topics, parseTopic } from '../src/shared/topics'

describe('topics', () => {
  it('builds a channel loaded topic', () => {
    expect(topics.channelLoaded('abc123', 0))
      .toBe('/peer/abc123/rack/page_0/channel.0/loaded')
  })

  it('builds a device gui topic', () => {
    expect(topics.deviceGui('abc123', 3, 'enable'))
      .toBe('/peer/abc123/rack/page_0/channel.3/device/gui/enable')
  })

  it('builds a localudp topic', () => {
    expect(topics.localudp('abc123', 0, 'outputPortOne'))
      .toBe('/peer/abc123/rack/page_0/channel.0/device/gui/localudp/outputPortOne')
  })

  it('builds a settings topic', () => {
    expect(topics.settings('abc123', 'lock/enable'))
      .toBe('/peer/abc123/settings/lock/enable')
  })

  it('builds a device wildcard subscribe topic', () => {
    expect(topics.deviceSubscribe('abc123', 5))
      .toBe('/peer/abc123/rack/page_0/channel.5/device/#')
  })

  it('builds the loaded wildcard subscribe topic', () => {
    expect(topics.loadedSubscribe('abc123'))
      .toBe('/peer/abc123/rack/+/+/loaded')
  })

  it('builds the settings wildcard subscribe topic', () => {
    expect(topics.settingsSubscribe('abc123'))
      .toBe('/peer/abc123/settings/#')
  })
})

describe('parseTopic', () => {
  it('parses a channel loaded topic', () => {
    const result = parseTopic('/peer/abc123/rack/page_0/channel.3/loaded')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'loaded',
      channelIndex: 3,
      value: undefined
    })
  })

  it('parses a device gui topic', () => {
    const result = parseTopic('/peer/abc123/rack/page_0/channel.0/device/gui/enable')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'device',
      channelIndex: 0,
      subpath: 'gui/enable'
    })
  })

  it('parses a settings topic', () => {
    const result = parseTopic('/peer/abc123/settings/lock/enable')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'settings',
      subpath: 'lock/enable'
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/shared/topics.test.ts
```

Expected: FAIL — `topics` and `parseTopic` not found.

- [ ] **Step 3: Implement topics.ts**

```typescript
// src/shared/topics.ts

export const topics = {
  channelLoaded(peerId: string, channel: number): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/loaded`
  },

  deviceGui(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/${field}`
  },

  localudp(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/localudp/${field}`
  },

  monitor(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/monitor/${field}`
  },

  settings(peerId: string, subpath: string): string {
    return `/peer/${peerId}/settings/${subpath}`
  },

  deviceSubscribe(peerId: string, channel: number): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/#`
  },

  loadedSubscribe(peerId: string): string {
    return `/peer/${peerId}/rack/+/+/loaded`
  },

  settingsSubscribe(peerId: string): string {
    return `/peer/${peerId}/settings/#`
  }
}

export type ParsedTopic =
  | { peerId: string; type: 'loaded'; channelIndex: number; value: undefined }
  | { peerId: string; type: 'device'; channelIndex: number; subpath: string }
  | { peerId: string; type: 'settings'; subpath: string }
  | null

const CHANNEL_RE = /^\/peer\/([^/]+)\/rack\/page_0\/channel\.(\d+)\/(.+)$/
const SETTINGS_RE = /^\/peer\/([^/]+)\/settings\/(.+)$/

export function parseTopic(topic: string): ParsedTopic {
  let match = CHANNEL_RE.exec(topic)
  if (match) {
    const peerId = match[1]
    const channelIndex = parseInt(match[2], 10)
    const rest = match[3]

    if (rest === 'loaded') {
      return { peerId, type: 'loaded', channelIndex, value: undefined }
    }

    if (rest.startsWith('device/')) {
      return { peerId, type: 'device', channelIndex, subpath: rest.slice('device/'.length) }
    }

    return null
  }

  match = SETTINGS_RE.exec(topic)
  if (match) {
    return { peerId: match[1], type: 'settings', subpath: match[2] }
  }

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/shared/topics.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/topics.ts tests/shared/topics.test.ts
git commit -m "feat: add topic path builders and parser"
```

---

### Task 7: Port allocator (src/main/portAllocator.ts)

**Files:**
- Create: `src/main/portAllocator.ts`
- Create: `tests/main/portAllocator.test.ts`

The port formula comes from §8.7 "PortRanges V5": `{roomID 2-digit}{channelIndex 2-digit}{slot 1-digit}`.

**Important:** Adapt the `roomId` source based on M0 Task 5 Step 2 findings. The code below assumes `bus peer room id` is the direct port prefix. If the M0 spike reveals a mismatch, adjust accordingly.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/portAllocator.test.ts
import { describe, it, expect } from 'vitest'
import { allocateOscPorts } from '../../src/main/portAllocator'

describe('allocateOscPorts', () => {
  it('allocates OSC ports for channel 0 in room 10', () => {
    const ports = allocateOscPorts(10, 0)
    expect(ports).toEqual({
      outputPortOne: 10008,
      outputPortTwo: 10007,
      inputPort: 10009
    })
  })

  it('allocates OSC ports for channel 3 in room 10', () => {
    const ports = allocateOscPorts(10, 3)
    expect(ports).toEqual({
      outputPortOne: 10038,
      outputPortTwo: 10037,
      inputPort: 10039
    })
  })

  it('allocates OSC ports for channel 19 in room 11', () => {
    const ports = allocateOscPorts(11, 19)
    expect(ports).toEqual({
      outputPortOne: 11198,
      outputPortTwo: 11197,
      inputPort: 11199
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/portAllocator.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement portAllocator.ts**

```typescript
// src/main/portAllocator.ts

export interface OscPorts {
  outputPortOne: number
  outputPortTwo: number
  inputPort: number
}

function portBase(roomId: number, channelIndex: number): number {
  return roomId * 1000 + channelIndex * 10
}

export function allocateOscPorts(roomId: number, channelIndex: number): OscPorts {
  const base = portBase(roomId, channelIndex)
  return {
    outputPortOne: base + 8,
    outputPortTwo: base + 7,
    inputPort: base + 9
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/portAllocator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/portAllocator.ts tests/main/portAllocator.test.ts
git commit -m "feat: add port allocator for OSC devices (PortRanges V5)"
```

---

### Task 8: Reactive state tree (src/renderer/state/)

**Files:**
- Create: `src/renderer/state/peerState.ts`
- Create: `src/renderer/state/roster.ts`
- Create: `tests/renderer/state/peerState.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/renderer/state/peerState.test.ts
import { describe, it, expect } from 'vitest'
import { createPeerState } from '../../../src/renderer/state/peerState'

describe('peerState', () => {
  it('sets a loaded value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/loaded', '1')
    expect(state.peers.abc.rack.page_0['channel.0'].loaded).toBe('1')
  })

  it('sets a device gui value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '0')
    expect(state.peers.abc.rack.page_0['channel.0'].device.gui.enable).toBe('0')
  })

  it('sets a settings value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/settings/lock/enable', '0')
    expect(state.peers.abc.settings.lock.enable).toBe('0')
  })

  it('sets a localudp value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.2/device/gui/localudp/outputPortOne', '10028')
    expect(state.peers.abc.rack.page_0['channel.2'].device.gui.localudp.outputPortOne).toBe('10028')
  })

  it('clears a topic when value is empty string', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '1')
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '')
    expect(state.peers.abc.rack.page_0['channel.0'].device.gui.enable).toBe('')
  })

  it('removes a peer subtree', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/settings/lock/enable', '0')
    state.removePeer('abc')
    expect(state.peers.abc).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/renderer/state/peerState.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement peerState.ts**

```typescript
// src/renderer/state/peerState.ts
import { reactive } from 'vue'

function ensurePath(obj: any, keys: string[]): any {
  let current = obj
  for (const key of keys) {
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  return current
}

export function createPeerState() {
  const peers: Record<string, any> = reactive({})

  function applyTopic(topic: string, value: string): void {
    const parts = topic.split('/').filter(Boolean)
    // parts: ['peer', peerId, ...rest]
    if (parts[0] !== 'peer' || parts.length < 3) return

    const peerId = parts[1]
    const rest = parts.slice(2)

    if (!peers[peerId]) {
      peers[peerId] = {}
    }

    const leaf = rest.pop()!
    const parent = ensurePath(peers[peerId], rest)
    parent[leaf] = value
  }

  function removePeer(peerId: string): void {
    delete peers[peerId]
  }

  return { peers, applyTopic, removePeer }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/renderer/state/peerState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implement roster.ts**

```typescript
// src/renderer/state/roster.ts
import { reactive } from 'vue'
import type { RemotePeerInfo } from '../../shared/types'

export interface RosterEntry {
  peerName: string
  localIP: string
  publicIP: string
  joinedAt: number
}

export function createRoster() {
  const entries: Record<string, RosterEntry> = reactive({})

  function addPeer(info: RemotePeerInfo): void {
    entries[info.peerId] = {
      peerName: info.peerName,
      localIP: info.localIP,
      publicIP: info.publicIP,
      joinedAt: Date.now()
    }
  }

  function removePeer(peerId: string): void {
    delete entries[peerId]
  }

  function setLocalPeer(peerId: string, peerName: string, localIP: string, publicIP: string): void {
    entries[peerId] = {
      peerName,
      localIP,
      publicIP,
      joinedAt: Date.now()
    }
  }

  return { entries, addPeer, removePeer, setLocalPeer }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/state/peerState.ts src/renderer/state/roster.ts tests/renderer/state/peerState.test.ts
git commit -m "feat: add reactive peerState tree and roster"
```

---

### Task 9: useMqttBinding composable

**Files:**
- Create: `src/renderer/composables/useMqttBinding.ts`

- [ ] **Step 1: Implement the composable**

```typescript
// src/renderer/composables/useMqttBinding.ts
import { computed } from 'vue'

export function useMqttBinding(
  getValue: () => string | undefined,
  topic: string
) {
  const value = computed(() => getValue() ?? '')

  function set(newValue: string | number): void {
    window.api.invoke('mqtt:publish', true, topic, String(newValue))
  }

  return { value, set }
}
```

This composable follows the §9.5 pattern: the getter reads from the reactive peerState tree, and `set()` publishes via IPC. The UI never writes to state directly — it publishes, waits for the echo, and the state tree updates from the echo.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/composables/useMqttBinding.ts
git commit -m "feat: add useMqttBinding composable for echo-driven UI"
```

---

### Task 10: Settings persistence (src/main/persistence/)

**Files:**
- Create: `src/main/persistence/settings.ts`
- Create: `src/main/persistence/rack.ts`

- [ ] **Step 1: Implement settings.ts**

```typescript
// src/main/persistence/settings.ts
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

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
  settingsVersion: 1
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULTS }

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): void {
  const path = settingsPath()
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
```

- [ ] **Step 2: Implement rack.ts**

```typescript
// src/main/persistence/rack.ts
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export type RackSnapshot = Record<string, string>

function rackPath(): string {
  return join(app.getPath('userData'), 'rack.json')
}

export function loadRack(): RackSnapshot {
  const path = rackPath()
  if (!existsSync(path)) return {}

  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveRack(snapshot: RackSnapshot): void {
  const path = rackPath()
  writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf-8')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/persistence/settings.ts src/main/persistence/rack.ts
git commit -m "feat: add settings and rack persistence"
```

---

### Task 11: ConnectView + RoomPickerView

**Files:**
- Create: `src/renderer/router.ts`
- Create: `src/renderer/views/ConnectView.vue`
- Create: `src/renderer/views/RoomPickerView.vue`
- Create: `src/renderer/views/MatrixView.vue` (placeholder)
- Modify: `src/renderer/App.vue`

- [ ] **Step 1: Install vue-router**

```bash
npm install vue-router
```

- [ ] **Step 2: Create router.ts**

```typescript
// src/renderer/router.ts
import { createRouter, createMemoryHistory } from 'vue-router'
import ConnectView from './views/ConnectView.vue'
import RoomPickerView from './views/RoomPickerView.vue'
import MatrixView from './views/MatrixView.vue'

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'connect', component: ConnectView },
    { path: '/rooms', name: 'rooms', component: RoomPickerView },
    { path: '/matrix', name: 'matrix', component: MatrixView }
  ]
})
```

- [ ] **Step 3: Create ConnectView.vue**

```vue
<!-- src/renderer/views/ConnectView.vue -->
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const error = ref('')
const connecting = ref(false)

const config = reactive({
  host: 'telemersion.zhdk.ch',
  port: 3883,
  username: 'peer',
  password: 'telemersion2021',
  localIP: ''
})

// Pre-fill from saved settings
window.api.invoke('settings:load').then((settings: any) => {
  if (settings) {
    config.host = settings.brokerUrl || config.host
    config.port = settings.brokerPort || config.port
    config.username = settings.brokerUser || config.username
    config.password = settings.brokerPwd || config.password
  }
})

window.api.on('peer:localIP', (ip: string) => {
  config.localIP = ip
})

window.api.on('broker:connected', (connected: boolean) => {
  if (connected) {
    connecting.value = false
    router.push('/rooms')
  } else {
    connecting.value = false
    error.value = 'Connection failed'
  }
})

async function connect() {
  error.value = ''
  connecting.value = true
  window.api.send('bus:configure', config)
  try {
    await window.api.invoke('bus:connect')
  } catch (e: any) {
    connecting.value = false
    error.value = e.message || 'Connection failed'
  }
}
</script>

<template>
  <div class="connect-view">
    <h2>Connect to Broker</h2>
    <div class="form-row">
      <label>Host</label>
      <input v-model="config.host" />
    </div>
    <div class="form-row">
      <label>Port</label>
      <input v-model.number="config.port" type="number" />
    </div>
    <div class="form-row">
      <label>Username</label>
      <input v-model="config.username" />
    </div>
    <div class="form-row">
      <label>Password</label>
      <input v-model="config.password" type="password" />
    </div>
    <button @click="connect" :disabled="connecting">
      {{ connecting ? 'Connecting...' : 'Connect' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.connect-view { max-width: 400px; margin: 40px auto; }
.form-row { margin-bottom: 8px; }
.form-row label { display: inline-block; min-width: 80px; }
.form-row input { width: 240px; }
.error { color: #f44; margin-top: 8px; }
</style>
```

- [ ] **Step 4: Create RoomPickerView.vue**

```vue
<!-- src/renderer/views/RoomPickerView.vue -->
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const rooms = ref<string[]>([])
const joining = ref(false)

const form = reactive({
  peerName: '',
  roomName: '',
  roomPwd: ''
})

// Pre-fill from saved settings
window.api.invoke('settings:load').then((settings: any) => {
  if (settings) {
    form.peerName = settings.peerName || ''
    form.roomName = settings.lastRoomName || ''
    form.roomPwd = settings.lastRoomPwd || ''
  }
})

window.api.on('rooms:clear', () => { rooms.value = [] })
window.api.on('rooms:append', (name: string) => { rooms.value.push(name) })

window.api.on('peer:joined', (joined: boolean) => {
  if (joined) {
    joining.value = false
    router.push('/matrix')
  }
})

function selectRoom(name: string) {
  form.roomName = name
}

async function join() {
  joining.value = true
  await window.api.invoke('bus:join', form.peerName, form.roomName, form.roomPwd)
}
</script>

<template>
  <div class="room-picker">
    <h2>Join Room</h2>

    <div v-if="rooms.length > 0" class="room-list">
      <h3>Available Rooms</h3>
      <div
        v-for="name in rooms"
        :key="name"
        class="room-item"
        :class="{ selected: form.roomName === name }"
        @click="selectRoom(name)"
      >
        {{ name }}
      </div>
    </div>
    <p v-else class="muted">No rooms found — type a name to create one.</p>

    <div class="form-row">
      <label>Peer Name</label>
      <input v-model="form.peerName" placeholder="your display name" />
    </div>
    <div class="form-row">
      <label>Room</label>
      <input v-model="form.roomName" placeholder="room name" />
    </div>
    <div class="form-row">
      <label>Password</label>
      <input v-model="form.roomPwd" type="password" placeholder="room password" />
    </div>
    <button @click="join" :disabled="joining || !form.peerName || !form.roomName">
      {{ joining ? 'Joining...' : 'Join' }}
    </button>
  </div>
</template>

<style scoped>
.room-picker { max-width: 400px; margin: 40px auto; }
.form-row { margin-bottom: 8px; }
.form-row label { display: inline-block; min-width: 100px; }
.form-row input { width: 220px; }
.room-list { margin-bottom: 16px; }
.room-item { padding: 4px 8px; cursor: pointer; border-radius: 4px; }
.room-item:hover { background: #333; }
.room-item.selected { background: #2563eb; color: white; }
.muted { color: #888; font-size: 12px; }
</style>
```

- [ ] **Step 5: Create placeholder MatrixView.vue**

```vue
<!-- src/renderer/views/MatrixView.vue -->
<script setup lang="ts">
</script>

<template>
  <div class="matrix-view">
    <h2>Matrix</h2>
    <p>Connected and joined. Matrix UI coming in next task.</p>
  </div>
</template>

<style scoped>
.matrix-view { padding: 16px; }
</style>
```

- [ ] **Step 6: Rewrite App.vue to use the router**

```vue
<!-- src/renderer/App.vue -->
<script setup lang="ts">
</script>

<template>
  <router-view />
</template>
```

- [ ] **Step 7: Wire the router in main.ts**

```typescript
// src/renderer/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 8: Add settings:load IPC handler in main**

Add to `src/main/index.ts` inside `setupIpcHandlers()`:

```typescript
ipcMain.handle('settings:load', () => {
  return loadSettings()
})

ipcMain.handle('settings:save', (_event, settings) => {
  saveSettings(settings)
})
```

And add the import at the top:

```typescript
import { loadSettings, saveSettings } from './persistence/settings'
```

Also add `'settings:load'` and `'settings:save'` to the allowed invoke channels in `src/main/ipc.ts`.

- [ ] **Step 9: Run and verify the flow**

```bash
npm run dev
```

1. ConnectView appears with pre-filled broker credentials.
2. Click Connect → navigates to RoomPickerView.
3. Room list shows (if rooms exist on broker).
4. Fill in peer name + room name + password → click Join.
5. Navigates to MatrixView placeholder.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/ src/main/index.ts src/main/ipc.ts
git commit -m "feat: add ConnectView, RoomPickerView, and vue-router navigation"
```

---

### Task 12: Initial publish sequence (§7.1)

**Files:**
- Modify: `src/main/index.ts`

This wires up the post-join publish sequence: 20x `loaded 0`, lock, color, localMenus, localProps.

- [ ] **Step 1: Create the init publisher function**

Add a new function in `src/main/index.ts`:

```typescript
import { topics } from '../shared/topics'
import { loadRack, saveRack } from './persistence/rack'

let localPeerId = ''
let roomId = 0
let localIP = ''

// Collect bus identity events
bus!.on('peer:id', (id: string) => { localPeerId = id })
bus!.on('peer:room:id', (id: number) => { roomId = id })
bus!.on('peer:localIP', (ip: string) => { localIP = ip })

async function publishInitSequence(): Promise<void> {
  const peerId = localPeerId

  // 20x loaded 0
  for (let ch = 0; ch < 20; ch++) {
    await bus!.publish(true, topics.channelLoaded(peerId, ch), '0')
  }

  // Settings
  await bus!.publish(true, topics.settings(peerId, 'lock/enable'), '0')

  // Peer color — load from settings or generate default
  const settings = loadSettings()
  const color = settings.peerColor || generateDefaultColor(peerId)
  await bus!.publish(true, topics.settings(peerId, 'background/color'), color)

  // localMenus — publish -default- for video/NDI; audio enumeration deferred to M2
  await bus!.publish(true, topics.settings(peerId, 'localMenus/textureCaptureRange'), '-default-')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/ndiRange'), '-default-')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/portaudioCaptureRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/coreaudioCaptureRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/wasapiCaptureRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/jackCaptureRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/portaudioReceiveRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/coreaudioReceiveRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/wasapiReceiveRange'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localMenus/jackReceiveRange'), '0')

  // localProps — ug_enable based on binary presence; natnet_enable = 0 for M1
  await bus!.publish(true, topics.settings(peerId, 'localProps/ug_enable'), '0')
  await bus!.publish(true, topics.settings(peerId, 'localProps/natnet_enable'), '0')

  // Rack restore (§6.6)
  const savedRack = loadRack()
  if (Object.keys(savedRack).length > 0) {
    for (const [tail, value] of Object.entries(savedRack)) {
      await bus!.publish(true, `/peer/${peerId}/${tail}`, value)
    }
  }
}

function generateDefaultColor(peerId: string): string {
  let hash = 0
  for (let i = 0; i < peerId.length; i++) {
    hash = ((hash << 5) - hash) + peerId.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  const r = hslToComponent(hue, 0.6, 0.55, 0)
  const g = hslToComponent(hue, 0.6, 0.55, 8)
  const b = hslToComponent(hue, 0.6, 0.55, 4)
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} 1`
}

function hslToComponent(h: number, s: number, l: number, n: number): number {
  const a = s * Math.min(l, 1 - l)
  const k = (n + h / 30) % 12
  return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
}
```

- [ ] **Step 2: Wire it to the peer:joined event**

In `src/main/index.ts`, inside `setupBus()`:

```typescript
bus!.on('peer:joined', async (joined: boolean) => {
  mainWindow?.webContents.send('peer:joined', joined)
  if (joined) {
    // Subscribe to own peer
    await bus!.subscribe(topics.settingsSubscribe(localPeerId))
    await bus!.subscribe(topics.loadedSubscribe(localPeerId))

    // Publish init sequence
    await publishInitSequence()
  }
})
```

- [ ] **Step 3: Test manually**

```bash
npm run dev
```

Connect and join a room. Check that the broker receives all 20 `loaded 0` topics + settings. Verify in the Max gateway (if available) that the NG peer's row appears in the matrix.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add initial publish sequence on join (§7.1)"
```

---

### Task 13: Device router (src/main/deviceRouter.ts)

**Files:**
- Create: `src/main/deviceRouter.ts`
- Create: `src/main/devices/types.ts`

- [ ] **Step 1: Define the DeviceHandler interface**

```typescript
// src/main/devices/types.ts

export interface DeviceHandler {
  readonly channelIndex: number
  readonly deviceType: number

  onTopicChanged(subpath: string, value: string): void

  publishDefaults(): Promise<void>

  teardown(): Promise<string[]>

  destroy(): void
}
```

`teardown()` returns the list of topics that were published (for retained-clear on unload per §5.2.2).

- [ ] **Step 2: Implement deviceRouter.ts**

```typescript
// src/main/deviceRouter.ts
import { TBusClient } from './busClient'
import { topics, parseTopic } from '../shared/topics'
import type { DeviceHandler } from './devices/types'

export class DeviceRouter {
  private handlers = new Map<number, DeviceHandler>()
  private ownPeerId: string
  private bus: TBusClient
  private handlerFactory: (type: number, channel: number) => DeviceHandler | null

  constructor(
    bus: TBusClient,
    ownPeerId: string,
    handlerFactory: (type: number, channel: number) => DeviceHandler | null
  ) {
    this.bus = bus
    this.ownPeerId = ownPeerId
    this.handlerFactory = handlerFactory
  }

  async onMqttMessage(topic: string, value: string): Promise<void> {
    const parsed = parseTopic(topic)
    if (!parsed) return
    if (parsed.peerId !== this.ownPeerId) return

    if (parsed.type === 'loaded') {
      await this.handleLoaded(parsed.channelIndex, parseInt(value, 10) || 0)
    } else if (parsed.type === 'device') {
      const handler = this.handlers.get(parsed.channelIndex)
      if (handler) {
        handler.onTopicChanged(parsed.subpath, value)
      }
    }
  }

  private async handleLoaded(channel: number, deviceType: number): Promise<void> {
    const existing = this.handlers.get(channel)

    if (deviceType === 0) {
      if (existing) {
        await this.unloadChannel(channel)
      }
      return
    }

    if (existing) {
      if (existing.deviceType === deviceType) return
      await this.unloadChannel(channel)
    }

    const handler = this.handlerFactory(deviceType, channel)
    if (!handler) return

    this.handlers.set(channel, handler)

    await handler.publishDefaults()

    await this.bus.subscribe(topics.deviceSubscribe(this.ownPeerId, channel))
  }

  private async unloadChannel(channel: number): Promise<void> {
    const handler = this.handlers.get(channel)
    if (!handler) return

    await this.bus.unsubscribe(topics.deviceSubscribe(this.ownPeerId, channel))

    const publishedTopics = await handler.teardown()
    for (const t of publishedTopics) {
      await this.bus.publish(true, t, '')
    }

    handler.destroy()
    this.handlers.delete(channel)
  }

  async destroyAll(): Promise<void> {
    for (const channel of [...this.handlers.keys()]) {
      await this.unloadChannel(channel)
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/deviceRouter.ts src/main/devices/types.ts
git commit -m "feat: add device router with load/unload state machine (§5.2)"
```

---

### Task 14: OscDevice handler with dgram relay

**Files:**
- Create: `src/main/devices/OscDevice.ts`
- Create: `tests/main/devices/OscDevice.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/devices/OscDevice.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dgram', () => ({
  createSocket: vi.fn(() => ({
    bind: vi.fn((_port, _addr, cb) => cb?.()),
    close: vi.fn((cb) => cb?.()),
    send: vi.fn((_msg, _offset, _len, _port, _addr, cb) => cb?.()),
    on: vi.fn()
  }))
}))

// We'll test the handler's state machine, not the actual UDP relay
import { OscDevice } from '../../../src/main/devices/OscDevice'

describe('OscDevice', () => {
  const mockPublish = vi.fn(async () => {})
  let device: OscDevice

  beforeEach(() => {
    vi.clearAllMocks()
    device = new OscDevice(
      0,                           // channelIndex
      'testPeerId',               // peerId
      '192.168.1.100',            // localIP
      10,                          // roomId
      mockPublish                  // publish function
    )
  })

  it('has device type 1 (OSC)', () => {
    expect(device.deviceType).toBe(1)
  })

  it('publishes defaults with correct ports', async () => {
    await device.publishDefaults()

    const calls = mockPublish.mock.calls
    const topicValueMap = new Map(calls.map(c => [c[1] as string, c[2] as string]))

    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/outputPortOne')).toBe('10008')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/outputPortTwo')).toBe('10007')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/inputPort')).toBe('10009')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/enable')).toBe('0')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/description')).toBe('OSC')
  })

  it('tracks published topics for teardown', async () => {
    await device.publishDefaults()
    const teardownTopics = await device.teardown()
    expect(teardownTopics.length).toBeGreaterThan(10)
    expect(teardownTopics).toContain('/peer/testPeerId/rack/page_0/channel.0/device/gui/enable')
  })

  it('starts relay on enable 0→1', async () => {
    await device.publishDefaults()
    device.onTopicChanged('gui/enable', '1')
    expect(device.isRunning).toBe(true)
  })

  it('stops relay on enable 1→0', async () => {
    await device.publishDefaults()
    device.onTopicChanged('gui/enable', '1')
    device.onTopicChanged('gui/enable', '0')
    expect(device.isRunning).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/devices/OscDevice.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement OscDevice.ts**

```typescript
// src/main/devices/OscDevice.ts
import * as dgram from 'dgram'
import { topics } from '../../shared/topics'
import { allocateOscPorts, type OscPorts } from '../portAllocator'
import type { DeviceHandler } from './types'

type PublishFn = (retained: boolean, topic: string, value: string) => Promise<void>

export class OscDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType: number
  private peerId: string
  private localIP: string
  private ports: OscPorts
  private publishedTopics: string[] = []
  private publish: PublishFn

  private enabled = false
  private enableTwo = false
  private outputIPOne: string
  private outputIPTwo: string
  private socket: dgram.Socket | null = null

  private _isRunning = false
  get isRunning(): boolean { return this._isRunning }

  constructor(
    channelIndex: number,
    peerId: string,
    localIP: string,
    roomId: number,
    publish: PublishFn,
    deviceType: number = 1
  ) {
    this.channelIndex = channelIndex
    this.deviceType = deviceType
    this.peerId = peerId
    this.localIP = localIP
    this.ports = allocateOscPorts(roomId, channelIndex)
    this.publish = publish
    this.outputIPOne = localIP
    this.outputIPTwo = localIP
  }

  async publishDefaults(): Promise<void> {
    const pub = async (field: string, value: string) => {
      const topic = this.isLocaludp(field)
        ? topics.localudp(this.peerId, this.channelIndex, field)
        : this.isMonitor(field)
          ? topics.monitor(this.peerId, this.channelIndex, field)
          : topics.deviceGui(this.peerId, this.channelIndex, field)

      this.publishedTopics.push(topic)
      await this.publish(true, topic, value)
    }

    // localudp subtopics
    await pub('peerLocalIP', this.localIP)
    await pub('enableTwo', '0')
    await pub('inputPort', String(this.ports.inputPort))
    await pub('outputIPOne', this.localIP)
    await pub('outputIPTwo', this.localIP)
    await pub('outputPortOne', String(this.ports.outputPortOne))
    await pub('outputPortTwo', String(this.ports.outputPortTwo))
    await pub('reset', '0')

    // monitor subtopics
    await pub('log', '0')
    await pub('monitorGate', '0')

    // gui-level subtopics
    await pub('description', this.deviceType === 4 ? 'StageC' : 'OSC')
    await pub('enable', '0')
    await pub('inputIndicator', '0')
    await pub('outputIndicator', '0')
  }

  private isLocaludp(field: string): boolean {
    return ['peerLocalIP', 'enableTwo', 'inputPort', 'outputIPOne', 'outputIPTwo',
            'outputPortOne', 'outputPortTwo', 'reset'].includes(field)
  }

  private isMonitor(field: string): boolean {
    return ['log', 'monitorGate'].includes(field)
  }

  onTopicChanged(subpath: string, value: string): void {
    switch (subpath) {
      case 'gui/enable':
        this.handleEnable(value === '1')
        break
      case 'gui/localudp/outputIPOne':
        this.outputIPOne = value
        break
      case 'gui/localudp/outputIPTwo':
        this.outputIPTwo = value
        break
      case 'gui/localudp/enableTwo':
        this.enableTwo = value === '1'
        break
      case 'gui/localudp/outputPortOne':
        this.ports.outputPortOne = parseInt(value, 10) || this.ports.outputPortOne
        break
      case 'gui/localudp/outputPortTwo':
        this.ports.outputPortTwo = parseInt(value, 10) || this.ports.outputPortTwo
        break
      case 'gui/localudp/inputPort':
        this.ports.inputPort = parseInt(value, 10) || this.ports.inputPort
        break
      case 'gui/localudp/reset':
        if (value === '1' && !this.enabled) {
          this.resetToDefaults()
        }
        break
    }
  }

  private handleEnable(enable: boolean): void {
    if (enable && !this.enabled) {
      this.enabled = true
      this.startRelay()
    } else if (!enable && this.enabled) {
      this.enabled = false
      this.stopRelay()
    }
  }

  private startRelay(): void {
    try {
      this.socket = dgram.createSocket('udp4')
      this.socket.on('message', (msg, rinfo) => {
        this.forwardMessage(msg)
      })
      this.socket.bind(this.ports.inputPort, this.localIP, () => {
        this._isRunning = true
      })
      this.socket.on('error', (err) => {
        console.error(`[OSC ch.${this.channelIndex}] socket error:`, err.message)
        this.stopRelay()
        this.publish(true,
          topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      })
    } catch (err: any) {
      console.error(`[OSC ch.${this.channelIndex}] failed to start relay:`, err.message)
      this.publish(true,
        topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
    }
  }

  private forwardMessage(msg: Buffer): void {
    if (!this.socket) return

    this.socket.send(msg, 0, msg.length, this.ports.outputPortOne, this.outputIPOne)

    if (this.enableTwo) {
      this.socket.send(msg, 0, msg.length, this.ports.outputPortTwo, this.outputIPTwo)
    }
  }

  private stopRelay(): void {
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
    this._isRunning = false
  }

  private resetToDefaults(): void {
    // Re-publish default port values
  }

  async teardown(): Promise<string[]> {
    this.stopRelay()
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.stopRelay()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/devices/OscDevice.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/devices/OscDevice.ts tests/main/devices/OscDevice.test.ts
git commit -m "feat: add OscDevice handler with dgram UDP relay"
```

---

### Task 15: Wire device router into main process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Integrate the device router**

Add to `src/main/index.ts`, after bus setup:

```typescript
import { DeviceRouter } from './deviceRouter'
import { OscDevice } from './devices/OscDevice'

let deviceRouter: DeviceRouter | null = null

// Inside the peer:joined handler, after publishInitSequence():
bus!.on('peer:joined', async (joined: boolean) => {
  mainWindow?.webContents.send('peer:joined', joined)
  if (joined) {
    await bus!.subscribe(topics.settingsSubscribe(localPeerId))
    await bus!.subscribe(topics.loadedSubscribe(localPeerId))

    deviceRouter = new DeviceRouter(
      bus!,
      localPeerId,
      (type: number, channel: number) => {
        if (type === 1 || type === 4) {
          return new OscDevice(channel, localPeerId, localIP, roomId,
            (retained, topic, value) => bus!.publish(retained, topic, value),
            type
          )
        }
        return null
      }
    )

    await publishInitSequence()
  }
})

// Route MQTT messages through both device router and renderer
bus!.on('mqtt:message', async (msg: { topic: string, payload: string }) => {
  mainWindow?.webContents.send('mqtt:message', msg)
  if (deviceRouter) {
    await deviceRouter.onMqttMessage(msg.topic, msg.payload)
  }
})
```

- [ ] **Step 2: Test by creating an OSC device locally**

Run the app, join a room, then use the Max gateway to create an OSC device on the NG peer's channel 0. Watch the NG console — the device router should instantiate an OscDevice and publish the subtree defaults. Max should see the device appear with ports.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire device router + OscDevice into main process"
```

---

### Task 16: Matrix view — peer rows + device cells

**Files:**
- Modify: `src/renderer/views/MatrixView.vue`
- Create: `src/renderer/components/PeerRow.vue`
- Create: `src/renderer/components/DeviceCell.vue`
- Create: `src/renderer/components/AddDevicePopup.vue`

- [ ] **Step 1: Create DeviceCell.vue**

```vue
<!-- src/renderer/components/DeviceCell.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loaded: string
  description: string
  enable: string
  isLocal: boolean
  isLocked: boolean
}>()

const emit = defineEmits<{
  click: []
  add: [deviceType: number]
}>()

const isEmpty = computed(() => props.loaded === '0' || props.loaded === '')
const deviceColor = computed(() => {
  switch (props.loaded) {
    case '1': return '#36ABFF'  // OSC
    case '2': return '#EF9F27'  // UltraGrid
    case '3': return '#1D9E75'  // MoCap
    case '4': return '#36ABFF'  // StageC (same as OSC)
    default: return 'transparent'
  }
})

const isEnabled = computed(() => props.enable === '1')
</script>

<template>
  <div
    class="device-cell"
    :class="{ empty: isEmpty, enabled: isEnabled, locked: isLocked && !isLocal }"
    :style="{ borderColor: isEmpty ? 'transparent' : deviceColor }"
    @click="isEmpty ? undefined : emit('click')"
  >
    <template v-if="isEmpty">
      <button
        v-if="!isLocked || isLocal"
        class="add-btn"
        @click.stop="emit('add', 1)"
        title="Add device"
      >+</button>
    </template>
    <template v-else>
      <span class="cell-label" :style="{ color: deviceColor }">
        {{ description || 'device' }}
      </span>
      <span v-if="isEnabled" class="cell-indicator" />
    </template>
  </div>
</template>

<style scoped>
.device-cell {
  width: 72px; height: 40px;
  border: 1.5px solid transparent;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 11px; position: relative;
}
.device-cell.empty { cursor: default; }
.device-cell.locked { opacity: 0.4; pointer-events: none; }
.add-btn {
  width: 24px; height: 24px; border-radius: 4px;
  border: 1px dashed #555; background: none; color: #888;
  cursor: pointer; font-size: 16px;
}
.add-btn:hover { border-color: #aaa; color: #aaa; }
.cell-label { font-size: 10px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 60px; }
.cell-indicator { width: 6px; height: 6px; border-radius: 50%; background: #1D9E75; position: absolute; top: 4px; right: 4px; }
</style>
```

- [ ] **Step 2: Create PeerRow.vue**

```vue
<!-- src/renderer/components/PeerRow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import DeviceCell from './DeviceCell.vue'

const props = defineProps<{
  peerId: string
  peerName: string
  peerColor: string
  isLocal: boolean
  isLocked: boolean
  channels: Record<string, any>
  channelCount: number
}>()

const emit = defineEmits<{
  cellClick: [channelIndex: number]
  addDevice: [channelIndex: number, deviceType: number]
}>()

function channelData(index: number) {
  const key = `channel.${index}`
  const ch = props.channels?.[key]
  return {
    loaded: ch?.loaded ?? '0',
    description: ch?.device?.gui?.description ?? '',
    enable: ch?.device?.gui?.enable ?? '0'
  }
}

const colorStyle = computed(() => {
  if (!props.peerColor) return {}
  const parts = props.peerColor.split(' ').map(Number)
  if (parts.length < 3) return {}
  const r = Math.round(parts[0] * 255)
  const g = Math.round(parts[1] * 255)
  const b = Math.round(parts[2] * 255)
  return { backgroundColor: `rgb(${r},${g},${b})` }
})
</script>

<template>
  <div class="peer-row">
    <div class="peer-header">
      <div class="peer-color" :style="colorStyle" />
      <span class="peer-name">{{ peerName }}{{ isLocal ? ' (you)' : '' }}</span>
    </div>
    <div class="peer-channels">
      <DeviceCell
        v-for="i in channelCount"
        :key="i - 1"
        :loaded="channelData(i - 1).loaded"
        :description="channelData(i - 1).description"
        :enable="channelData(i - 1).enable"
        :is-local="isLocal"
        :is-locked="isLocked"
        @click="emit('cellClick', i - 1)"
        @add="(type) => emit('addDevice', i - 1, type)"
      />
    </div>
  </div>
</template>

<style scoped>
.peer-row { display: flex; align-items: center; gap: 4px; padding: 4px 0; }
.peer-header { min-width: 140px; display: flex; align-items: center; gap: 8px; }
.peer-color { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.peer-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.peer-channels { display: flex; gap: 2px; overflow-x: auto; }
</style>
```

- [ ] **Step 3: Implement MatrixView.vue**

```vue
<!-- src/renderer/views/MatrixView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { createPeerState } from '../state/peerState'
import { createRoster } from '../state/roster'
import PeerRow from '../components/PeerRow.vue'

const peerState = createPeerState()
const roster = createRoster()

let ownPeerId = ''

const CHANNEL_COUNT = 20

window.api.on('peer:id', (id: string) => {
  ownPeerId = id
})

window.api.on('peer:name', (name: string) => {
  // Set once we have both id and name
})

window.api.on('peer:localIP', (ip: string) => {
  if (ownPeerId) {
    roster.setLocalPeer(ownPeerId, '', ip, '')
  }
})

window.api.on('peers:remote:joined', (info: any) => {
  roster.addPeer(info)
})

window.api.on('peers:remote:left', (peerId: string) => {
  roster.removePeer(peerId)
  peerState.removePeer(peerId)
})

window.api.on('mqtt:message', (msg: { topic: string, payload: string }) => {
  peerState.applyTopic(msg.topic, msg.payload)
})

const sortedPeerIds = computed(() => {
  const ids = Object.keys(roster.entries)
  return [
    ...ids.filter(id => id === ownPeerId),
    ...ids.filter(id => id !== ownPeerId)
  ]
})

function peerChannels(peerId: string) {
  return peerState.peers[peerId]?.rack?.page_0 ?? {}
}

function peerColor(peerId: string) {
  return peerState.peers[peerId]?.settings?.background?.color ?? ''
}

function isLocked(peerId: string) {
  return peerState.peers[peerId]?.settings?.lock?.enable === '1'
}

function onCellClick(peerId: string, channelIndex: number) {
  // Open device panel — implemented in Task 17
  console.log('cell click', peerId, channelIndex)
}

async function onAddDevice(peerId: string, channelIndex: number, deviceType: number) {
  const topic = `/peer/${peerId}/rack/page_0/channel.${channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', true, topic, String(deviceType))
}
</script>

<template>
  <div class="matrix-view">
    <div class="matrix-header">
      <span class="header-label">Peer</span>
      <div class="channel-numbers">
        <span v-for="i in CHANNEL_COUNT" :key="i - 1" class="ch-num">{{ i - 1 }}</span>
      </div>
    </div>

    <PeerRow
      v-for="peerId in sortedPeerIds"
      :key="peerId"
      :peer-id="peerId"
      :peer-name="roster.entries[peerId]?.peerName ?? peerId.slice(0, 6)"
      :peer-color="peerColor(peerId)"
      :is-local="peerId === ownPeerId"
      :is-locked="isLocked(peerId)"
      :channels="peerChannels(peerId)"
      :channel-count="CHANNEL_COUNT"
      @cell-click="(ch) => onCellClick(peerId, ch)"
      @add-device="(ch, type) => onAddDevice(peerId, ch, type)"
    />

    <p v-if="sortedPeerIds.length === 0" class="muted">Waiting for peer data...</p>
  </div>
</template>

<style scoped>
.matrix-view { padding: 16px; overflow-x: auto; }
.matrix-header { display: flex; align-items: center; gap: 4px; padding-bottom: 4px; border-bottom: 1px solid #333; }
.header-label { min-width: 140px; font-size: 11px; color: #888; }
.channel-numbers { display: flex; gap: 2px; }
.ch-num { width: 72px; text-align: center; font-size: 10px; color: #666; }
.muted { color: #888; font-size: 12px; margin-top: 16px; }
</style>
```

- [ ] **Step 4: Test manually**

```bash
npm run dev
```

Connect, join a room. The matrix should show:
- Local peer row with `(you)` tag and 20 empty cells with `+` buttons.
- Remote peer rows (if any Max peers are in the room) with their devices visible.
- Click `+` on an empty cell → publishes `loaded 1` → device appears after echo.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/MatrixView.vue src/renderer/components/PeerRow.vue src/renderer/components/DeviceCell.vue
git commit -m "feat: add matrix view with peer rows and device cells"
```

---

### Task 17: OSC device panel (drawer)

**Files:**
- Create: `src/renderer/components/DevicePanel.vue`
- Create: `src/renderer/components/panels/OscPanel.vue`
- Modify: `src/renderer/views/MatrixView.vue`

- [ ] **Step 1: Create OscPanel.vue**

Follows the layout in `docs/mockups/osc_panel.html` and uses `useMqttBinding` for every field (§9.5).

```vue
<!-- src/renderer/components/panels/OscPanel.vue -->
<script setup lang="ts">
import { useMqttBinding } from '../../composables/useMqttBinding'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  isLocal: boolean
}>()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const udp = computed(() => gui.value?.localudp ?? {})
const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => !props.isLocal || isEnabled.value)

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

const emit = defineEmits<{ remove: [] }>()

function toggleEnable() {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

async function removeDevice() {
  const topic = `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', true, topic, '0')
  emit('remove')
}
</script>

<template>
  <div class="osc-panel">
    <div class="panel-header">
      <button
        class="enable-btn"
        :class="{ active: isEnabled }"
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
        <label>output 2</label>
        <button
          class="toggle-btn"
          :class="{ on: enableTwo.value.value === '1' }"
          :disabled="isLocked"
          @click="enableTwo.set(enableTwo.value.value === '1' ? '0' : '1')"
        >
          {{ enableTwo.value.value === '1' ? 'enabled' : 'disabled' }}
        </button>
      </div>

      <div v-if="enableTwo.value.value === '1'" class="field-row">
        <label></label>
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
      </div>
    </section>

    <section>
      <h4>Receiving at</h4>
      <div class="field-row">
        <label>local IP</label>
        <input :value="udp.peerLocalIP" disabled />
      </div>
      <div class="field-row">
        <label>input port</label>
        <input
          class="port-input"
          :value="inputPort.value.value"
          :disabled="isLocked"
          @change="inputPort.set(($event.target as HTMLInputElement).value)"
        />
      </div>
    </section>

    <div class="panel-actions">
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled">
        Remove Device
      </button>
    </div>
  </div>
</template>

<style scoped>
.osc-panel { padding: 12px; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; }
.enable-btn.active { background: #1D9E75; color: white; border-color: #1D9E75; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input { flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row input:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 72px !important; flex: none !important; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 11px; }
.toggle-btn.on { background: #36ABFF; color: white; border-color: #36ABFF; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Create DevicePanel.vue (drawer container)**

```vue
<!-- src/renderer/components/DevicePanel.vue -->
<script setup lang="ts">
import OscPanel from './panels/OscPanel.vue'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  peerName: string
  roomName: string
  deviceState: any
  isLocal: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')
const description = computed(() => props.deviceState?.device?.gui?.description ?? 'device')

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="device-panel" @keydown="onKeydown" tabindex="0">
    <div class="panel-breadcrumb">
      {{ roomName }} &gt; {{ peerName }} &gt; {{ description }} &gt; channel {{ channelIndex }}
    </div>
    <button class="close-btn" @click="emit('close')">X</button>

    <OscPanel
      v-if="loaded === '1' || loaded === '4'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :is-local="isLocal"
      @remove="emit('close')"
    />

    <div v-else class="unsupported">
      Device type {{ loaded }} is not yet supported in this milestone.
    </div>
  </div>
</template>

<style scoped>
.device-panel {
  position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
  background: #1a1a1a; border-left: 1px solid #333;
  display: flex; flex-direction: column; z-index: 100;
}
.panel-breadcrumb { font-size: 11px; color: #888; padding: 8px 12px; font-family: monospace; }
.close-btn { position: absolute; top: 8px; right: 12px; background: none; border: none; color: #888; cursor: pointer; font-size: 14px; }
.unsupported { padding: 24px; color: #666; text-align: center; }
</style>
```

- [ ] **Step 3: Wire the panel into MatrixView.vue**

Add panel state and the drawer to `MatrixView.vue`:

```typescript
// Add to <script setup> in MatrixView.vue:
import DevicePanel from '../components/DevicePanel.vue'
import { ref } from 'vue'

const panelOpen = ref(false)
const panelPeerId = ref('')
const panelChannel = ref(0)

function onCellClick(peerId: string, channelIndex: number) {
  const ch = peerState.peers[peerId]?.rack?.page_0?.[`channel.${channelIndex}`]
  if (ch?.loaded && ch.loaded !== '0') {
    panelPeerId.value = peerId
    panelChannel.value = channelIndex
    panelOpen.value = true
  }
}

function closePanel() {
  panelOpen.value = false
}
```

Add to the template:

```vue
<DevicePanel
  v-if="panelOpen"
  :peer-id="panelPeerId"
  :channel-index="panelChannel"
  :peer-name="roster.entries[panelPeerId]?.peerName ?? ''"
  :room-name="''"
  :device-state="peerChannels(panelPeerId)[`channel.${panelChannel}`]"
  :is-local="panelPeerId === ownPeerId"
  @close="closePanel"
/>
```

- [ ] **Step 4: Test the full flow**

```bash
npm run dev
```

1. Connect, join room. Matrix appears.
2. Click `+` on channel 0 → device created (appears after echo).
3. Click the device cell → panel drawer opens from right.
4. Configure forward-to IP/port. Each change publishes via echo.
5. Click ON → relay starts (check main-process console for socket bind).
6. Click OFF → relay stops. Fields become editable.
7. Click Remove Device → device disappears.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ src/renderer/views/MatrixView.vue
git commit -m "feat: add OSC device panel drawer with echo-driven bindings"
```

---

### Task 18: Shutdown sequence (§3.6)

**Files:**
- Create: `src/main/shutdown.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Implement shutdown.ts**

```typescript
// src/main/shutdown.ts
import type { TBusClient } from './busClient'
import type { DeviceRouter } from './deviceRouter'
import { saveSettings, loadSettings } from './persistence/settings'
import { saveRack } from './persistence/rack'

export async function performShutdown(
  bus: TBusClient,
  deviceRouter: DeviceRouter | null,
  publishedTopics: string[],
  rackSnapshot: Record<string, string>
): Promise<void> {
  // 1. Persist
  saveRack(rackSnapshot)

  // 2. Kill all child processes / stop relays
  if (deviceRouter) {
    await deviceRouter.destroyAll()
  }

  // 3. Clear retained topics
  for (const topic of publishedTopics) {
    try {
      await bus.publish(true, topic, '')
    } catch {}
  }

  // 4. Leave + disconnect
  try { await bus.leave() } catch {}
  try { await bus.disconnect() } catch {}
}
```

- [ ] **Step 2: Wire into app lifecycle in main/index.ts**

```typescript
import { performShutdown } from './shutdown'

// Track all published topics
const allPublishedTopics: string[] = []
const rackSnapshot: Record<string, string> = {}

// Wrap the bus publish to track topics
const originalPublish = bus!.publish.bind(bus!)
bus!.publish = async (retained: boolean, topic: string, ...values: (string | number)[]) => {
  if (retained && topic.includes(`/peer/${localPeerId}/`)) {
    const value = values.join(' ')
    if (value !== '') {
      allPublishedTopics.push(topic)
      const tail = topic.replace(`/peer/${localPeerId}/`, '')
      rackSnapshot[tail] = value
    }
  }
  return originalPublish(retained, topic, ...values)
}

// macOS: hide window on close, quit on Cmd-Q
mainWindow!.on('close', (e) => {
  if (process.platform === 'darwin') {
    e.preventDefault()
    mainWindow!.hide()
  }
})

app.on('before-quit', async (e) => {
  e.preventDefault()
  await performShutdown(bus!, deviceRouter, allPublishedTopics, rackSnapshot)
  app.exit(0)
})
```

- [ ] **Step 3: Test shutdown**

1. Join a room, create a device.
2. Quit the app (Cmd-Q on macOS).
3. Check the broker (rejoin with Max): the NG peer's retained topics should be cleared.
4. Relaunch NG, join the same room: the device should restore from `rack.json`.

- [ ] **Step 4: Commit**

```bash
git add src/main/shutdown.ts src/main/index.ts
git commit -m "feat: add shutdown sequence with retained-topic clearing"
```

---

### Task 19: M1 interop test — full cross-client pass

**Files:** None — this is a manual test protocol.

- [ ] **Step 1: NG creates, Max sees**

1. NG joined to room. Create OSC device on channel 0.
2. In Max: confirm the device appears with correct description (`OSC`), ports, and IP.
3. In Max: open the NG peer's OSC panel. Confirm values match.

- [ ] **Step 2: Max creates on NG, NG handles**

1. From Max: click `+` on NG's channel 1, select OSC.
2. In NG: confirm the device appears in the matrix (loaded echo → subtree published → cell renders).
3. In NG: open the panel. Confirm ports and IP are correct.
4. In NG: click Enable. Confirm the relay starts (main-process log).
5. From Max: send OSC data to NG's input port. Confirm NG forwards to output port.

- [ ] **Step 3: Cross-peer enable/disable**

1. From Max: toggle enable on NG's channel 1 device.
2. In NG: confirm relay starts/stops. Confirm UI reflects the change.

- [ ] **Step 4: Lock test**

1. In NG: toggle lock on.
2. In Max: confirm NG's row is greyed out (no `+` affordance).
3. In NG: toggle lock off.
4. In Max: confirm row is editable again.

- [ ] **Step 5: Device removal**

1. From Max: remove the device on NG's channel 1.
2. In NG: confirm device disappears, retained topics cleared.

- [ ] **Step 6: Quit + restore**

1. NG has a device on channel 0. Quit NG.
2. Relaunch, rejoin same room.
3. Confirm device restores from `rack.json`.
4. In Max: confirm restored device appears correctly.

- [ ] **Step 7: Record results**

Create `docs/logs/m1-interop-test.md` with pass/fail for each step and any issues found.

---

## Future Milestones (paragraph-level)

### M2 — Device Enumeration + UltraGrid

Add audio device enumeration (spawn `uv -s portaudio:help` etc. on join, parse output, publish `localMenus/*`). Implement the UltraGrid panel (the most complex UI — conditional rendering driven by connection × transmission × network/mode per §9.6). Port the 829-line CLI builder from `tg.ultragrid.js` to TypeScript. UltraGridDevice handler spawns `uv` as a child process, pipes stdout to the monitor log topic. Cross-client test: NG and Max exchange UltraGrid video/audio in the same room.

### M3 — NatNet + StageControl + Lock + Color

NatNet device panel + handler (spawns NatNetThree2OSC). StageControl routed through OSC handler with `loaded=4` (§5.4) — only presentation differs (matrix-cell color, breadcrumb). Lock toggle on local peer row, lock enforcement on remote rows (grey-out per §5.5). Peer color published and rendered in matrix row header. Full four-device-type cross-client interop pass.

### M4 — Polish + Edge Cases

Channel >=20 warning in matrix header. Duplicate peerName disambiguation. Broker-disconnect banner. CLI crash surfaces stderr to channel monitor log. "Start empty" vs "restore" option on join screen. Peer-leave event handling (remove subtree + row).

### M5 — macOS Packaging + Notarization

Signed, notarized `.dmg`. UltraGrid and NatNet binaries bundled. electron-builder config. CI pipeline. Install-from-dmg smoke test with Max peer.

---

## TBD Resolution Map

| TBD | Resolve by | Default until then |
|------|-----------|-------------------|
| TBD-1 (packaging) | M5 | electron-builder |
| TBD-5 (video/NDI enum CLI) | M2 | publish `-default-` |
| TBD-6 (updateMenu grammar) | M2 | parse known backends only |
| TBD-11 (monitor log UX) | M4 | console.log in main |
| TBD-12 (error UI) | M4 | console.error in main |
| TBD-14 (restartProxy hack) | post-M5 | not implemented |
