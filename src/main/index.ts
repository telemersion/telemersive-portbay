import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { TBusClient } from './busClient'
import { loadSettings, saveSettings } from './persistence/settings'
import { loadRack, saveRack, buildRackSnapshot, isRackEligibleTail } from './persistence/rack'
import { topics } from '../shared/topics'
import { DeviceRouter } from './deviceRouter'
import { OscDevice } from './devices/OscDevice'
import { UltraGridDevice } from './devices/ultragrid/UltraGridDevice'
import { resolveUgPath } from './enumeration/spawnCli'
import { performShutdown } from './shutdown'
import { logEvent, setLogSink, getLogBuffer, clearLogBuffer } from './logBus'
import { enumerate, handleRefreshTrigger } from './enumeration'
import { registerDefaultBackends } from './enumeration/parsers'

let mainWindow: BrowserWindow | null = null
let bus: TBusClient | null = null
let deviceRouter: DeviceRouter | null = null
let localPeerId = ''
let localPeerName = ''
let roomName = ''
let roomId = 0
let localIP = ''
let brokerConnected = false
let peerJoined = false
const retainedTopics = new Map<string, string>()

const RACK_SAVE_DEBOUNCE_MS = 500
let rackSaveTimer: NodeJS.Timeout | null = null
let rackSaveSuppressed = false

function currentRackSnapshot(): Record<string, string> {
  return buildRackSnapshot(retainedTopics, localPeerId)
}

function scheduleRackSave(): void {
  if (rackSaveSuppressed) return
  if (rackSaveTimer) clearTimeout(rackSaveTimer)
  rackSaveTimer = setTimeout(() => {
    rackSaveTimer = null
    try { saveRack(currentRackSnapshot()) } catch {}
  }, RACK_SAVE_DEBOUNCE_MS)
}

function flushRackSave(): void {
  if (rackSaveTimer) {
    clearTimeout(rackSaveTimer)
    rackSaveTimer = null
  }
  try { saveRack(currentRackSnapshot()) } catch {}
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setLogSink(mainWindow)
  mainWindow.on('closed', () => setLogSink(null))
}

function trackedPublish(retained: 0 | 1, topic: string, ...values: any[]): void {
  const value = values.join(' ')
  let rackMutated = false
  if (retained && localPeerId && topic.includes(`/peer/${localPeerId}/`)) {
    if (value !== '') {
      const prev = retainedTopics.get(topic)
      if (prev !== value) {
        retainedTopics.set(topic, value)
        rackMutated = true
      }
    } else if (retainedTopics.delete(topic)) {
      rackMutated = true
    }
  }
  bus!.publish(retained, topic, ...values)
  logEvent({ kind: 'pub', topic, value, retained: retained === 1 })
  if (rackMutated) scheduleRackSave()
}

function forwardToRenderer(channel: string): void {
  bus!.on(channel, (...args: any[]) => {
    mainWindow?.webContents.send(channel, ...args)
  })
}

function publishInitSequence(): void {
  const peerId = localPeerId

  for (let ch = 0; ch < 20; ch++) {
    trackedPublish(1, topics.channelLoaded(peerId, ch), '0')
  }

  trackedPublish(1, topics.settings(peerId, 'lock/enable'), '0')

  const settings = loadSettings()
  const color = settings.peerColor || generateDefaultColor(peerId)
  trackedPublish(1, topics.settings(peerId, 'background/color'), color)

  trackedPublish(1, topics.settings(peerId, 'localMenus/textureCaptureRange'), '-default-')
  trackedPublish(1, topics.settings(peerId, 'localMenus/ndiRange'), '-default-')
  trackedPublish(1, topics.settings(peerId, 'localMenus/portaudioCaptureRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/coreaudioCaptureRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/wasapiCaptureRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/jackCaptureRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/portaudioReceiveRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/coreaudioReceiveRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/wasapiReceiveRange'), '0')
  trackedPublish(1, topics.settings(peerId, 'localMenus/jackReceiveRange'), '0')

  trackedPublish(1, topics.settings(peerId, 'localProps/ug_enable'), resolveUgPath() ? '1' : '0')
  trackedPublish(1, topics.settings(peerId, 'localProps/natnet_enable'), '0')

  const savedRack = loadRack()
  if (Object.keys(savedRack).length > 0) {
    for (const [tail, value] of Object.entries(savedRack)) {
      if (!isRackEligibleTail(tail)) continue
      trackedPublish(1, `/peer/${peerId}/${tail}`, value)
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

function setupBus(): void {
  bus = new TBusClient()

  bus.on('peer:id', (id: string) => { localPeerId = id })
  bus.on('peer:room:id', (id: number) => { roomId = id; console.log('[bus] peer:room:id =', id) })
  bus.on('peer:room:name', (name: string) => { roomName = name })
  bus.on('peer:localIP', (ip: string) => { if (ip) localIP = ip })

  bus.on('broker:connected', (connected: boolean) => {
    brokerConnected = connected
    if (!connected) {
      peerJoined = false
      roomName = ''
      roomId = 0
    }
  })

  bus.on('peer:joined', (joined: boolean) => {
    peerJoined = joined
    mainWindow?.webContents.send('peer:joined', joined)
    if (joined) {
      bus!.subscribe(topics.settingsSubscribe(localPeerId))
      bus!.subscribe(topics.loadedSubscribe(localPeerId))

      deviceRouter = new DeviceRouter(
        bus!,
        localPeerId,
        (type: number, channel: number) => {
          if (type === 1 || type === 4) {
            return new OscDevice(channel, localPeerId, localIP, roomId,
              (retained, topic, value) => trackedPublish(retained, topic, value),
              type,
              (topic: string) => retainedTopics.has(topic),
              loadSettings().brokerUrl
            )
          }
          if (type === 2) {
            return new UltraGridDevice({
              channelIndex: channel,
              peerId: localPeerId,
              localIP,
              roomId,
              publish: (retained, topic, value) => trackedPublish(retained, topic, value),
              hasRetained: (topic: string) => retainedTopics.has(topic),
              getSetting: (subpath: string) =>
                retainedTopics.get(topics.settings(localPeerId, subpath)) ?? null,
              host: loadSettings().brokerUrl,
              resolveBinary: resolveUgPath
            })
          }
          return null
        },
        (retained, topic, value) => trackedPublish(retained, topic, value)
      )

      publishInitSequence()

      enumerate(localPeerId, (retained, topic, value) =>
        trackedPublish(retained, topic, value)
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[enumerate] failed: ${message}`)
      })
    }
  })

  bus.on('peers:remote:joined', (info: { peerName: string; peerId: string; localIP: string; publicIP: string }) => {
    bus!.subscribe(`/peer/${info.peerId}/#`)
  })

  bus.on('peers:remote:left', (info: { peerName: string; peerId: string }) => {
    bus!.unsubscribe(`/peer/${info.peerId}/#`)
  })

  bus.on('mqtt:message', (msg: { topic: string; payload: string }) => {
    mainWindow?.webContents.send('mqtt:message', msg)
    if (deviceRouter) {
      deviceRouter.onMqttMessage(msg.topic, msg.payload)
    }
    if (localPeerId) {
      handleRefreshTrigger(localPeerId, msg.topic, (retained, topic, value) =>
        trackedPublish(retained, topic, value)
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[enumerate] refresh trigger failed: ${message}`)
      })
    }
  })

  const channels = [
    'broker:connected', 'peer:id', 'peer:name',
    'peer:localIP', 'peer:publicIP', 'peer:room:name', 'peer:room:id',
    'peer:room:uuid', 'rooms:clear', 'rooms:append', 'rooms:listing',
    'rooms:done', 'peers:remote:joined', 'peers:remote:left',
    'peers:clear', 'peers:append', 'peers:done',
    'ready', 'chat'
  ]
  for (const ch of channels) {
    forwardToRenderer(ch)
  }
}

function setupIpcHandlers(): void {
  ipcMain.on('bus:configure', (_event, config) => {
    bus!.configure(config)
  })

  ipcMain.handle('bus:init', async () => {
    return await bus!.init()
  })

  ipcMain.handle('bus:connect', () => {
    bus!.connect()
  })

  ipcMain.handle('bus:disconnect', () => {
    bus!.disconnect()
  })

  ipcMain.handle('bus:join', (_event, peerName, roomName, roomPwd) => {
    localPeerName = peerName
    bus!.join(peerName, roomName, roomPwd)
  })

  ipcMain.handle('bus:leave', () => {
    flushRackSave()
    rackSaveSuppressed = true
    try { deviceRouter?.destroyAll() }
    finally { rackSaveSuppressed = false }
    bus!.leave()
  })

  ipcMain.handle('mqtt:publish', async (_event, payload: { topic: string; value: string; retain: boolean }) => {
    trackedPublish(payload.retain ? 1 : 0, payload.topic, payload.value)
  })

  ipcMain.handle('mqtt:subscribe', async (_event, topic) => {
    bus!.subscribe(topic)
  })

  ipcMain.handle('mqtt:unsubscribe', async (_event, topic) => {
    bus!.unsubscribe(topic)
  })

  ipcMain.handle('bus:localPeer', () => {
    return { peerId: localPeerId, peerName: localPeerName, localIP, roomId }
  })

  ipcMain.handle('bus:state', () => {
    return {
      connected: brokerConnected,
      joined: peerJoined,
      peerName: localPeerName,
      roomName,
      roomId
    }
  })

  ipcMain.handle('settings:load', () => {
    return loadSettings()
  })

  ipcMain.handle('settings:save', (_event, settings) => {
    saveSettings(settings)
  })

  ipcMain.handle('log:get', () => {
    return getLogBuffer()
  })

  ipcMain.handle('log:clear', () => {
    clearLogBuffer()
  })

}

app.whenReady().then(async () => {
  registerDefaultBackends()
  setupBus()
  setupIpcHandlers()

  const ips = await bus!.init()
  const firstIp = Object.values(ips).find((v: any) => v?.address)
  if (firstIp && !localIP) {
    localIP = (firstIp as any).address
  }
  console.log('Internal IPs:', ips)
  console.log('Local IP:', localIP)
  console.log('PeerId:', bus!.peerId)

  createWindow()

  if (process.platform === 'darwin') {
    mainWindow!.on('close', (e) => {
      if (!isShuttingDown) {
        e.preventDefault()
        mainWindow!.hide()
      }
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isShuttingDown = false
app.on('before-quit', (e) => {
  if (isShuttingDown) return
  isShuttingDown = true
  e.preventDefault()
  flushRackSave()
  rackSaveSuppressed = true
  if (bus) {
    performShutdown(bus, deviceRouter, [...retainedTopics.keys()])
  }
  setTimeout(() => app.exit(0), 500)
})
