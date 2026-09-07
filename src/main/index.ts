import { app, BrowserWindow, shell, ipcMain, dialog, Menu, type MenuItem } from 'electron'
import { join, basename } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { networkInterfaces } from 'os'
import { TBusClient } from './busClient'
import { loadSettings, saveSettings, normalizeSettings, type Settings } from './persistence/settings'
import { isPlainObject, looksLikeRack, looksLikeSettings } from './persistence/fileShapes'
import {
  loadRack,
  saveRack,
  buildRackSnapshot,
  isRackEligibleTail,
  type RackSnapshot
} from './persistence/rack'
import { topics } from '../shared/topics'
import { DeviceRouter } from './deviceRouter'
import { OscDevice } from './devices/OscDevice'
import { NatNetDevice } from './devices/NatNetDevice'
import { UltraGridDevice } from './devices/ultragrid/UltraGridDevice'
import { MotiveDevice } from './devices/motive/MotiveDevice'
import type { MotiveSibling } from './devices/motive/motiveLogic'
import { resolveUgPath } from './enumeration/spawnCli'
import { performShutdown } from './shutdown'
import { logEvent, setLogSink, getLogBuffer, clearLogBuffer } from './logBus'
import { enumerate, handleRefreshTrigger } from './enumeration'
import { registerDefaultBackends } from './enumeration/parsers'
import { runCompatCheck, validateToolPath } from './compat'
import { initAutoUpdater, getUpdateStatus, checkForUpdates, downloadUpdate, quitAndInstall } from './updater'
import { TOOL_REQUIREMENTS, type CompatStatus } from '../shared/toolRequirements'
import {
  switchboardBaseUrl,
  fetchSwitchboardRoomState,
  groupProxiesByChannel,
  type ProxyEntry
} from './switchboardClient'

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
let openSettingsMenuItem: MenuItem | null = null
let openRackMenuItem: MenuItem | null = null

// A rack loaded via File > Open Rack..., held in memory until the next join
// restores it (racks only materialize on join). Nothing is written to rack.json
// here — the normal debounced rack autosave persists it once restore republishes
// the topics. Cleared as soon as it is consumed.
let pendingRackOverride: RackSnapshot | null = null

// Live snapshot of the connect-screen's Router fields, kept in sync from the
// renderer as the user types (see 'connect-form:sync'). Not written to disk
// until a File > Save/Save As action fires — normal autosave still only
// persists on Connect/Join, this just lets Save capture typed-but-unconnected
// credentials too.
interface ConnectFormSnapshot {
  host?: string
  port?: number | null
  username?: string
  password?: string
  selectedInterface?: string
}
let latestConnectForm: ConnectFormSnapshot = {}

function connectFormToSettingsPartial(): Partial<Settings> {
  const partial: Partial<Settings> = {}
  if (latestConnectForm.host !== undefined) partial.brokerUrl = latestConnectForm.host
  if (latestConnectForm.port !== undefined && latestConnectForm.port !== null) {
    partial.brokerPort = latestConnectForm.port
  }
  if (latestConnectForm.username !== undefined) partial.brokerUser = latestConnectForm.username
  if (latestConnectForm.password !== undefined) partial.brokerPwd = latestConnectForm.password
  if (latestConnectForm.selectedInterface !== undefined) {
    partial.selectedInterface = latestConnectForm.selectedInterface
  }
  return partial
}

function saveSettingsNow(): void {
  saveSettings({ ...loadSettings(), ...connectFormToSettingsPartial() })
}

async function handleSaveSettingsAs(): Promise<void> {
  const win = activeWindow()
  if (!win) return
  saveSettingsNow()
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Settings As',
    defaultPath: join(app.getPath('userData'), `settings-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Settings', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return
  writeFileSync(result.filePath, JSON.stringify(loadSettings(), null, 2), 'utf-8')
}

// The window to parent modal dialogs on, or null when there is none (macOS
// keeps the app alive after its last window closes).
function activeWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

// Reads and parses a user-picked JSON file, reporting parse failures itself.
function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (!isPlainObject(parsed)) throw new Error('not an object')
    return parsed
  } catch {
    dialog.showErrorBox('Open', `"${basename(filePath)}" is not a valid JSON file.`)
    return null
  }
}

// The rack to archive: a rack opened but not yet applied wins, otherwise the
// live in-memory rack (flushed to disk first), falling back to what's on disk
// when disconnected and nothing is live.
function rackForExport(): RackSnapshot {
  if (pendingRackOverride) return pendingRackOverride
  flushRackSave()
  const live = currentRackSnapshot()
  return Object.keys(live).length > 0 ? live : loadRack()
}

async function handleSaveRackAs(): Promise<void> {
  const win = activeWindow()
  if (!win) return
  const rack = rackForExport()
  if (Object.keys(rack).length === 0) {
    dialog.showErrorBox('Save Rack As', 'There is no rack to save yet.')
    return
  }
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Rack As',
    defaultPath: join(app.getPath('userData'), `rack-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Rack', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return
  writeFileSync(result.filePath, JSON.stringify(rack, null, 2), 'utf-8')
}

async function handleOpenRack(): Promise<void> {
  const win = activeWindow()
  if (!win || brokerConnected) return
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Rack',
    filters: [{ name: 'Rack', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return
  const filePath = result.filePaths[0]

  const parsed = readJsonFile(filePath)
  if (!parsed) return
  if (!looksLikeRack(parsed)) {
    dialog.showErrorBox(
      'Open Rack',
      `"${basename(filePath)}" does not look like a rack file.` +
        (looksLikeSettings(parsed) ? '\n\nThis looks like a settings file — use Open Settings... instead.' : '')
    )
    return
  }

  pendingRackOverride = parsed
  // Reported in-app rather than via dialog.showMessageBox: on Windows an info
  // box rings the system asterisk sound, and a successful load should be quiet.
  sendToRenderer('menu:rack-loaded', basename(filePath))
}

async function handleOpenSettings(): Promise<void> {
  const win = activeWindow()
  if (!win || brokerConnected) return
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Settings',
    filters: [{ name: 'Settings', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return
  const filePath = result.filePaths[0]

  const parsed = readJsonFile(filePath)
  if (!parsed) return
  if (!looksLikeSettings(parsed)) {
    dialog.showErrorBox(
      'Open Settings',
      `"${basename(filePath)}" does not look like a settings file.` +
        (looksLikeRack(parsed) ? '\n\nThis looks like a rack file — use Open Rack... instead.' : '')
    )
    return
  }

  // Non-destructive: the opened file is never written to, and settings.json is
  // left alone until the normal autosave fires on Connect. Nothing to confirm.
  // The renderer's connect-form watcher re-syncs latestConnectForm for us once
  // the form repopulates.
  sendToRenderer('menu:open-settings', normalizeSettings(parsed))
}
const geoCache = new Map<string, Record<string, unknown>>()
const retainedTopics = new Map<string, string>()

let switchboardPollTimer: NodeJS.Timeout | null = null
let switchboardPolling = false
let lastSwitchboardChannels: Record<number, ProxyEntry[]> = {}

const RACK_SAVE_DEBOUNCE_MS = 500
let rackSaveTimer: NodeJS.Timeout | null = null
let rackSaveSuppressed = false

let compatStatus: CompatStatus | null = null

function broadcastCompat(): void {
  if (compatStatus) {
    sendToRenderer('compat:status', compatStatus)
  }
}

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
  const snap = currentRackSnapshot()
  // Never overwrite a populated on-disk rack with an empty snapshot — that's
  // the symptom of a teardown having drained retainedTopics. The good snapshot
  // is already on disk from the last meaningful save.
  if (Object.keys(snap).length === 0) return
  try { saveRack(snap) } catch {}
}

const REPO = 'https://github.com/telemersion/telemersive-portbay'

function setupMenu(): void {
  const template = Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveSettingsNow()
        },
        { type: 'separator' as const },
        {
          label: 'Save Rack As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => { handleSaveRackAs() }
        },
        {
          label: 'Save Settings As...',
          click: () => { handleSaveSettingsAs() }
        },
        { type: 'separator' as const },
        {
          id: 'open-settings',
          label: 'Open Settings...',
          enabled: !brokerConnected,
          click: () => { handleOpenSettings() }
        },
        {
          id: 'open-rack',
          label: 'Open Rack...',
          enabled: !brokerConnected,
          click: () => { handleOpenRack() }
        },
        { type: 'separator' as const },
        // Electron's built-in `fileMenu` role resolves to Close on macOS and
        // Quit elsewhere. Building the submenu by hand means supplying that
        // ourselves, or Windows/Linux lose File > Exit entirely.
        process.platform === 'darwin'
          ? { role: 'close' as const }
          : { role: 'quit' as const }
      ]
    },
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
    {
      label: 'Help',
      submenu: [
        { label: 'Repository',  click: () => shell.openExternal(REPO) },
        { label: 'Releases',    click: () => shell.openExternal(`${REPO}/releases`) },
        { label: 'Wiki',        click: () => shell.openExternal(`${REPO}/wiki`) },
        { label: 'Report Issue', click: () => shell.openExternal(`${REPO}/issues`) },
      ]
    }
  ])
  Menu.setApplicationMenu(template)
  openSettingsMenuItem = template.getMenuItemById('open-settings')
  openRackMenuItem = template.getMenuItemById('open-rack')
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
  mainWindow.on('closed', () => {
    setLogSink(null)
    // macOS keeps the app (and its menu) alive with no window. Clearing the
    // reference keeps the `!mainWindow` guards honest — a destroyed window
    // passed to dialog.* throws.
    mainWindow = null
  })
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
  // JSON.stringify on string tokens produces quoted values that Max treats as
  // symbols. Coerce numeric-looking tokens to numbers so they arrive as floats.
  const wireValues = values.map((v: any) => {
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v)
    return v
  })
  bus!.publish(retained, topic, ...wireValues)
  logEvent({ kind: 'pub', topic, value, retained: retained === 1 })
  if (rackMutated) scheduleRackSave()
}

function sendToRenderer(channel: string, ...args: any[]): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, ...args)
}

function forwardToRenderer(channel: string): void {
  bus!.on(channel, (...args: any[]) => sendToRenderer(channel, ...args))
}

async function pollSwitchboardOnce(): Promise<void> {
  if (!roomName) return
  const baseUrl = switchboardBaseUrl(loadSettings().brokerUrl)
  try {
    const state = await fetchSwitchboardRoomState(baseUrl, roomName)
    lastSwitchboardChannels = groupProxiesByChannel(state, roomId)
    sendToRenderer('switchboard:state', { roomId, error: false, channels: lastSwitchboardChannels })
  } catch {
    sendToRenderer('switchboard:state', { roomId, error: true, channels: lastSwitchboardChannels })
  }
}

function startSwitchboardPolling(): void {
  if (switchboardPolling) return
  switchboardPolling = true
  const tick = (): void => {
    if (!switchboardPolling) return
    pollSwitchboardOnce().finally(() => {
      if (!switchboardPolling) return
      const intervalMs = Math.max(1, loadSettings().switchboardPollIntervalSec) * 1000
      switchboardPollTimer = setTimeout(tick, intervalMs)
    })
  }
  tick()
}

function stopSwitchboardPolling(): void {
  switchboardPolling = false
  if (switchboardPollTimer) {
    clearTimeout(switchboardPollTimer)
    switchboardPollTimer = null
  }
  lastSwitchboardChannels = {}
  sendToRenderer('switchboard:state', { roomId: 0, error: false, channels: {} })
}

function publishInitSequence(): void {
  const peerId = localPeerId

  for (let ch = 0; ch < 20; ch++) {
    trackedPublish(1, topics.channelLoaded(peerId, ch), '0')
  }

  trackedPublish(1, topics.settings(peerId, 'lock/enable'), '0')

  const settings = loadSettings()
  const colorTopic = topics.settings(peerId, 'background/color')
  const color = retainedTopics.get(colorTopic) || settings.peerColor || generateDefaultColor(peerId)
  trackedPublish(1, colorTopic, ...color.split(' '))

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
  trackedPublish(1, topics.settings(peerId, 'localProps/natnet_enable'), '1')
  trackedPublish(1, topics.settings(peerId, 'localProps/stagec_enable'), '1')
  trackedPublish(1, topics.settings(peerId, 'localProps/motive_enable'), '1')

  // A rack opened via File > Open Rack... takes precedence for this join; from
  // then on the normal autosave owns rack.json again.
  const savedRack = pendingRackOverride ?? loadRack()
  pendingRackOverride = null
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
  return `${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)} 1`
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
    if (openSettingsMenuItem) openSettingsMenuItem.enabled = !connected
    if (openRackMenuItem) openRackMenuItem.enabled = !connected
    if (!connected) {
      peerJoined = false
      roomName = ''
      roomId = 0
      stopSwitchboardPolling()
    }
  })

  bus.on('peer:joined', (joined: boolean) => {
    peerJoined = joined
    sendToRenderer('peer:joined', joined)
    if (!joined) {
      stopSwitchboardPolling()
    }
    if (joined) {
      startSwitchboardPolling()
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
          if (type === 3) {
            return new NatNetDevice({
              channelIndex: channel,
              peerId: localPeerId,
              localIP,
              roomId,
              publish: (retained, topic, ...values) => trackedPublish(retained, topic, ...values),
              hasRetained: (topic: string) => retainedTopics.has(topic),
              brokerHost: loadSettings().brokerUrl,
              resolveBinary: () => loadSettings().natnetOscPath || null
            })
          }
          if (type === 2) {
            return new UltraGridDevice({
              channelIndex: channel,
              peerId: localPeerId,
              localIP,
              roomId,
              publish: (retained, topic, ...values) => trackedPublish(retained, topic, ...values),
              hasRetained: (topic: string) => retainedTopics.has(topic),
              getSetting: (subpath: string) =>
                retainedTopics.get(topics.settings(localPeerId, subpath)) ?? null,
              host: loadSettings().brokerUrl,
              resolveBinary: resolveUgPath
            })
          }
          if (type === 5) {
            return new MotiveDevice({
              channelIndex: channel,
              peerId: localPeerId,
              localIP,
              roomId,
              publish: (retained, topic, ...values) => trackedPublish(retained, topic, ...values),
              hasRetained: (topic: string) => retainedTopics.has(topic),
              brokerHost: loadSettings().brokerUrl,
              siblings: (): MotiveSibling[] => {
                const list: MotiveSibling[] = []
                if (!deviceRouter) return list
                for (const h of deviceRouter.loadedHandlers()) {
                  if (h.deviceType !== 5) continue
                  const m = h as unknown as { toSibling: () => MotiveSibling }
                  if (typeof m.toSibling === 'function') list.push(m.toSibling())
                }
                return list
              }
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
    sendToRenderer('mqtt:message', msg)
    if (deviceRouter) {
      deviceRouter.onMqttMessage(msg.topic, msg.payload)
    }
    if (localPeerId) {
      if (msg.topic === topics.settings(localPeerId, 'background/color') && msg.payload) {
        const s = loadSettings()
        if (s.peerColor !== msg.payload) {
          saveSettings({ ...s, peerColor: msg.payload })
        }
      }
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
    'ready', 'chat', 'bus:error'
  ]
  for (const ch of channels) {
    forwardToRenderer(ch)
  }
}

function setupIpcHandlers(): void {
  ipcMain.on('bus:configure', (_event, config) => {
    bus!.configure(config)
  })

  ipcMain.on('connect-form:sync', (_event, snapshot: ConnectFormSnapshot) => {
    latestConnectForm = snapshot
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
    try {
      deviceRouter?.destroyAll()
    } finally {
      // Teardown publishes empty retained values to clear broker state, which
      // also drains retainedTopics via trackedPublish. Drop whatever is left so
      // a later flush (e.g. on quit) cannot overwrite the saved rack snapshot
      // with the post-teardown empty map.
      retainedTopics.clear()
      rackSaveSuppressed = false
    }
    bus!.leave()
  })

  ipcMain.handle('mqtt:publish', async (_event, payload: { topic: string; value: string; retain: boolean }) => {
    trackedPublish(payload.retain ? 1 : 0, payload.topic, ...payload.value.split(' '))
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

  ipcMain.handle('settings:save', (_event, partial) => {
    saveSettings({ ...loadSettings(), ...partial })
  })

  ipcMain.handle('log:get', () => {
    return getLogBuffer()
  })

  ipcMain.handle('log:clear', () => {
    clearLogBuffer()
  })

  ipcMain.handle('compat:get-status', async () => {
    if (!compatStatus) compatStatus = await runCompatCheck()
    return compatStatus
  })

  ipcMain.handle('compat:recheck', async () => {
    compatStatus = await runCompatCheck()
    broadcastCompat()
    return compatStatus
  })

  ipcMain.handle('compat:locate', async (_event, toolId: 'ultragrid' | 'natnetOsc') => {
    if (!mainWindow) return null
    const isUg = toolId === 'ultragrid'
    const filters =
      process.platform === 'darwin' && isUg
        ? [{ name: 'UltraGrid app', extensions: ['app'] }]
        : process.platform === 'win32'
          ? [{ name: 'Executable', extensions: ['exe'] }]
          : [{ name: 'All files', extensions: ['*'] }]
    const defaultPath =
      process.platform === 'darwin' ? '/Applications'
        : process.platform === 'win32' ? process.env['ProgramFiles'] || 'C:\\Program Files'
          : '/usr/local/bin'
    const titleSuffix = isUg
      ? process.platform === 'darwin' ? ' (uv-qt.app)'
        : process.platform === 'win32' ? ' (uv.exe)'
          : ' (uv binary)'
      : ' (NatNetFour2OSC.exe)'
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Locate ${isUg ? 'UltraGrid' : 'NatNetFour2OSC'}${titleSuffix}`,
      defaultPath,
      properties: ['openFile'],
      filters
    })
    if (result.canceled || result.filePaths.length === 0) return null
    let picked = result.filePaths[0]
    // macOS .app bundles: resolve to inner uv binary.
    if (process.platform === 'darwin' && isUg && picked.endsWith('.app')) {
      const inner = join(picked, 'Contents', 'MacOS', 'uv')
      if (existsSync(inner)) picked = inner
    }
    const validated = await validateToolPath(toolId, picked)
    if (validated.status === 'ok' || validated.status === 'version-mismatch') {
      const s = loadSettings()
      if (toolId === 'ultragrid') saveSettings({ ...s, ugPath: picked })
      else saveSettings({ ...s, natnetOscPath: picked })
    }
    compatStatus = await runCompatCheck()
    broadcastCompat()
    return compatStatus
  })

  ipcMain.handle('compat:open-download', async (_event, toolId: 'ultragrid' | 'natnetOsc') => {
    const req = TOOL_REQUIREMENTS.find((r) => r.id === toolId)
    if (!req) return false
    const url = req.downloadUrl[process.platform]
    if (!url) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('compat:reveal-tools-folder', async () => {
    const dir = app.getPath('userData')
    await shell.openPath(dir)
    return dir
  })

  ipcMain.handle('update:get-status', () => {
    return getUpdateStatus()
  })

  ipcMain.handle('update:check', async () => {
    if (app.isPackaged) {
      await checkForUpdates()
    } else {
      sendToRenderer('update:status', { state: 'not-available' })
    }
  })

  ipcMain.handle('update:download', async () => {
    await downloadUpdate()
  })

  ipcMain.handle('update:install', () => {
    isShuttingDown = true
    flushRackSave()
    rackSaveSuppressed = true
    if (bus) {
      performShutdown(bus, deviceRouter, [...retainedTopics.keys()])
    }
    quitAndInstall()
  })

  ipcMain.handle('net:interfaces', () => {
    const all = networkInterfaces()
    const out: Array<{ name: string; address: string; family: string }> = []
    for (const [name, addrs] of Object.entries(all)) {
      if (!addrs) continue
      for (const a of addrs) {
        if (a.internal) continue
        if (a.family !== 'IPv4') continue
        out.push({ name, address: a.address, family: a.family })
      }
    }
    return out
  })

  ipcMain.handle('settings:get-path', () => {
    return join(app.getPath('userData'), 'settings.json')
  })

  ipcMain.handle('settings:reveal', () => {
    const path = join(app.getPath('userData'), 'settings.json')
    if (existsSync(path)) {
      shell.showItemInFolder(path)
    } else {
      shell.openPath(app.getPath('userData'))
    }
    return path
  })

  ipcMain.handle('settings:open-in-editor', async () => {
    const path = join(app.getPath('userData'), 'settings.json')
    if (!existsSync(path)) return null
    const err = await shell.openPath(path)
    return err ? { error: err } : { ok: true }
  })

  ipcMain.handle('geo:lookup', async (_event, ip?: string) => {
    const key = ip || ''
    if (geoCache.has(key)) return geoCache.get(key)
    try {
      const url = ip ? `http://ip-api.com/json/${ip}` : 'http://ip-api.com/json/'
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json() as Record<string, unknown>
      geoCache.set(key, data)
      return data
    } catch {
      return null
    }
  })

}

app.whenReady().then(async () => {
  registerDefaultBackends()
  setupBus()
  setupIpcHandlers()
  setupMenu()

  const ips = await bus!.init()
  const firstIp = Object.values(ips).find((v: any) => v?.address)
  if (firstIp && !localIP) {
    localIP = (firstIp as any).address
  }
  console.log('Internal IPs:', ips)
  console.log('Local IP:', localIP)
  console.log('PeerId:', bus!.peerId)

  createWindow()

  initAutoUpdater((status) => sendToRenderer('update:status', status))
  if (app.isPackaged) {
    setTimeout(() => checkForUpdates(), 2_000)
  }

  runCompatCheck()
    .then((status) => {
      compatStatus = status
      broadcastCompat()
    })
    .catch((err) => {
      console.warn('[compat] initial check failed:', err)
    })

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
