// Fictional room used for the documentation screenshots.
//
// The renderer reconstructs the entire room from the raw MQTT stream forwarded
// over IPC and never opens its own socket (see src/renderer/state/localPeer.ts),
// so handing it this fixture produces a complete, reproducible three-peer room
// with no broker, no router, no second machine and no video signal.
//
// The UltraGrid subtree is generated from the device handler's own defaults
// rather than hand-written, so it cannot drift when the config shape changes.

import { readFileSync } from 'node:fs'
import {
  defaultUltraGridConfig,
  applyTopicChange,
  snapshotTopics,
  type UltraGridConfig
} from '../../src/main/devices/ultragrid/config'
import {
  allocateLocalPorts,
  allocateUgPorts,
  allocateMocapLocalPorts,
  allocateMotiveRoomPorts
} from '../../src/main/portAllocator'

export const ROOM = {
  name: 'demo-room',
  id: 11,
  router: 'telemersion.example.org',
  publicIP: '203.0.113.42'
}

export interface Peer {
  peerId: string
  peerName: string
  localIP: string
  color: string
}

// Colours are "r g b a" floats, matching generateDefaultColor() in main/index.ts.
export const PEERS = {
  local: {
    peerId: 'a1b2c3d4e5f6',
    peerName: 'studio-a',
    localIP: '192.168.10.21',
    color: '0.298039 0.760784 0.690196 1'
  } as Peer,
  remoteB: {
    peerId: 'b2c3d4e5f6a7',
    peerName: 'studio-b',
    localIP: '192.168.20.34',
    color: '0.949020 0.686275 0.239216 1'
  } as Peer,
  remoteC: {
    peerId: 'c3d4e5f6a7b8',
    peerName: 'lab-c',
    localIP: '192.168.30.12',
    color: '0.611765 0.505882 0.898039 1'
  } as Peer
}

export type TopicMap = Record<string, string>

const CHANNEL_COUNT = 20

function channelBase(peerId: string, ch: number): string {
  return `/peer/${peerId}/rack/page_0/channel.${ch}`
}

// ── Per-peer settings subtree ────────────────────────────────────
// Mirrors publishInitSequence() in src/main/index.ts.

function settingsTopics(peer: Peer, opts: { locked?: boolean } = {}): TopicMap {
  const s = (tail: string) => `/peer/${peer.peerId}/settings/${tail}`
  return {
    [s('lock/enable')]: opts.locked ? '1' : '0',
    [s('background/color')]: peer.color,

    // Enumerated local hardware, as the enumeration publishes it: entries are
    // "|"-separated, audio entries prefixed with their index (see parseRange()
    // in UltraGridPanel.vue). A bare "-default-" or "0" means "nothing found".
    [s('localMenus/textureCaptureRange')]: 'Syphon|Spout',
    [s('localMenus/ndiRange')]: 'STUDIO-A (Camera 1)|STUDIO-B (Stage Wide)',
    [s('localMenus/portaudioCaptureRange')]: '0 MacBook Pro Microphone|1 BlackHole 16ch|2 Aggregate Device',
    [s('localMenus/coreaudioCaptureRange')]: '0 MacBook Pro Microphone|1 BlackHole 16ch|2 Aggregate Device',
    [s('localMenus/wasapiCaptureRange')]: '0',
    [s('localMenus/jackCaptureRange')]: '0',
    [s('localMenus/portaudioReceiveRange')]: '0 MacBook Pro Speakers|1 BlackHole 16ch|2 Aggregate Device',
    [s('localMenus/coreaudioReceiveRange')]: '0 MacBook Pro Speakers|1 BlackHole 16ch|2 Aggregate Device',
    [s('localMenus/wasapiReceiveRange')]: '0',
    [s('localMenus/jackReceiveRange')]: '0',

    [s('localProps/ug_enable')]: '1',
    [s('localProps/natnet_enable')]: '1',
    [s('localProps/stagec_enable')]: '1',
    [s('localProps/motive_enable')]: '1'
  }
}

// ── Device subtrees ──────────────────────────────────────────────

/** OSC (loaded=1) and StageControl (loaded=4) share the OSC handler. */
function oscDevice(
  peer: Peer,
  ch: number,
  opts: {
    stageControl?: boolean
    enabled?: boolean
    flowing?: boolean
    description?: string
    enableTwo?: boolean
    outputIPOne?: string
    outputPortOne?: string
  } = {}
): TopicMap {
  const base = channelBase(peer.peerId, ch)
  const ports = allocateLocalPorts(ch)
  const gui = (f: string) => `${base}/device/gui/${f}`
  const udp = (f: string) => `${base}/device/gui/localudp/${f}`

  return {
    [`${base}/loaded`]: opts.stageControl ? '4' : '1',
    [gui('description')]: opts.description ?? (opts.stageControl ? 'StageC' : 'OSC'),
    [gui('enable')]: opts.enabled ? '1' : '0',
    [gui('inputIndicator')]: opts.flowing ? '1' : '0',
    [gui('outputIndicator')]: opts.flowing ? '1' : '0',
    [udp('peerLocalIP')]: peer.localIP,
    [udp('enableTwo')]: opts.enableTwo ? '1' : '0',
    [udp('inputPort')]: String(ports.inputPort),
    [udp('outputIPOne')]: opts.outputIPOne ?? '127.0.0.1',
    [udp('outputPortOne')]: opts.outputPortOne ?? String(ports.outputPortOne),
    [udp('outputIPTwo')]: '127.0.0.1',
    [udp('outputPortTwo')]: String(ports.outputPortTwo),
    [udp('reset')]: '0',
    [`${base}/device/gui/monitor/log`]: '0',
    [`${base}/device/gui/monitor/monitorGate`]: '0'
  }
}

/**
 * UltraGrid (loaded=2). Config overrides are applied through the handler's own
 * applyTopicChange(), so an invalid subpath is silently dropped exactly as it
 * would be at runtime rather than inventing a topic that does not exist.
 */
function ultraGridDevice(
  peer: Peer,
  ch: number,
  opts: {
    overrides?: Record<string, string>
    enabled?: boolean
    description?: string
    /** "txActive rxActive txFps txVol rxFps rxVol" */
    indicators?: string
    monitorLog?: string
  } = {}
): TopicMap {
  const base = channelBase(peer.peerId, ch)
  const txPorts = allocateUgPorts(ROOM.id, ch)

  let config: UltraGridConfig = applyTopicChange(
    defaultUltraGridConfig(),
    'remoteValues/local_os',
    'osx'
  )
  config = applyTopicChange(
    config,
    'network/local/customSending',
    `0.0.0.0:${txPorts.videoPort}`
  )
  config = applyTopicChange(config, 'enable', opts.enabled ? '1' : '0')
  for (const [subpath, value] of Object.entries(opts.overrides ?? {})) {
    config = applyTopicChange(config, subpath, value)
  }

  const out: TopicMap = { [`${base}/loaded`]: '2' }
  for (const { subpath, value } of snapshotTopics(config)) {
    out[`${base}/device/gui/${subpath}`] = value
  }
  out[`${base}/device/gui/description`] = opts.description ?? 'UG'
  out[`${base}/device/gui/indicators`] = opts.indicators ?? '0 0 0 0 0 0'
  if (opts.monitorLog) out[`${base}/device/gui/monitor/log`] = opts.monitorLog
  return out
}

/** NatNet / MoCap (loaded=3), driven by NatNetFour2OSC. */
function natNetDevice(
  peer: Peer,
  ch: number,
  opts: { enabled?: boolean; direction?: string; indicators?: string } = {}
): TopicMap {
  const base = channelBase(peer.peerId, ch)
  const ports = allocateMocapLocalPorts(ch)
  const gui = (f: string) => `${base}/device/gui/${f}`
  const udp = (f: string) => `${base}/device/gui/localudp/${f}`
  const nn = (f: string) => `${base}/device/gui/natnet/${f}`

  return {
    [`${base}/loaded`]: '3',
    [gui('description')]: 'MoCap',
    [gui('enable')]: opts.enabled ? '1' : '0',
    [gui('enableTwo')]: '0',
    [gui('indicators')]: opts.indicators ?? '0 0 1 0',
    [`${base}/device/gui/direction/select`]: opts.direction ?? '1',
    [udp('outputIPOne')]: '127.0.0.1',
    [udp('outputPortOne')]: String(ports.outputPort),
    [udp('outputIPTwo')]: '127.0.0.1',
    [udp('outputPortTwo')]: String(ports.outputPort + 1),
    [udp('listeningIP')]: peer.localIP,
    [udp('inputPort')]: String(ports.inputPort),
    [nn('cmdPort')]: '1510',
    [nn('dataPort')]: '1511',
    [nn('motiveIP')]: '192.168.30.50',
    [nn('multicastIP')]: '239.255.42.99',
    [nn('frameModulo')]: '1',
    [nn('oscMode')]: '0',
    [nn('autoReconnect')]: '1',
    [nn('bundled')]: '1',
    [nn('invmatrix')]: '0',
    [nn('matrix')]: '0',
    [nn('leftHanded')]: '0',
    [nn('yUp2zUp')]: '0',
    [nn('sendMarkerInfos')]: '1',
    [nn('sendOtherMarkerInfos')]: '0',
    [nn('sendSkeletons')]: '1',
    [nn('verbose')]: '0',
    [`${base}/device/gui/monitor/log`]: '',
    [`${base}/device/gui/monitor/monitorGate`]: '0'
  }
}

/** Motive bridge (loaded=5), NG-only. */
function motiveDevice(
  peer: Peer,
  ch: number,
  opts: { enabled?: boolean; direction?: string; indicators?: string } = {}
): TopicMap {
  const base = channelBase(peer.peerId, ch)
  const ports = allocateMotiveRoomPorts(ROOM.id, ch)
  const gui = (f: string) => `${base}/device/gui/${f}`
  const udp = (f: string) => `${base}/device/gui/localudp/${f}`

  return {
    [`${base}/loaded`]: '5',
    [gui('description')]: opts.direction === '2' ? 'Motive Sink' : 'Motive Source',
    [gui('enable')]: opts.enabled ? '1' : '0',
    [gui('indicators')]: opts.indicators ?? '0 0 1 0',
    [`${base}/device/gui/direction/select`]: opts.direction ?? '1',
    [`${base}/device/gui/health/state`]: 'ok',
    [udp('multicastIP')]: '239.255.42.99',
    [udp('dataPort')]: String(ports.dataTxPort),
    [udp('cmdPort')]: String(ports.cmdPort),
    [udp('interfaceName')]: 'en0',
    [udp('motiveIP')]: '192.168.30.50',
    [udp('reset')]: '0',
    [`${base}/device/gui/monitor/log`]: '',
    [`${base}/device/gui/monitor/monitorGate`]: '0'
  }
}

// ── The room ─────────────────────────────────────────────────────
//
// Channels line up across peers on purpose: devices in the same column are the
// ones that can exchange data, which is the single most important thing the
// matrix screenshot has to teach.
//
//   ch.0  UltraGrid  a → b, c     video+audio, running
//   ch.1  OSC        a ↔ b        running
//   ch.2  StageC     a            running
//   ch.3  UltraGrid  b, c         audio only, idle
//   ch.4  MoCap      b            idle
//   ch.5  Motive     c            idle

function emptyChannels(peerId: string, used: number[]): TopicMap {
  const out: TopicMap = {}
  for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
    if (!used.includes(ch)) out[`${channelBase(peerId, ch)}/loaded`] = '0'
  }
  return out
}

// Backend values, from the panel's own <option> lists:
//   video capture / receive — 0 texture, 1 ndi, 2 custom
//   audio capture / receive — 0 portaudio, 1 coreaudio, 2 wasapi, 3 jack, 7 custom
// The selection topics hold the option *label*, not the enumeration index.

const UG_SENDING_OVERRIDES: Record<string, string> = {
  'network/mode': '1',
  'audioVideo/connection': '2',
  'audioVideo/transmission': '2',
  'audioVideo/videoCapture/type': '1',
  'audioVideo/videoCapture/ndi/menu/selection': 'STUDIO-A (Camera 1)',
  'audioVideo/videoCapture/advanced/compress/codec': '2',
  'audioVideo/videoCapture/advanced/compress/bitrate': '20',
  'audioVideo/audioCapture/type': '1',
  'audioVideo/audioCapture/coreaudio/menu/selection': 'Aggregate Device',
  'audioVideo/audioCapture/advanced/channels/channels': '2',
  'audioVideo/videoReciever/type': '1',
  'audioVideo/videoReciever/ndi/name': 's_channel_0'
}

const UG_RECEIVING_OVERRIDES: Record<string, string> = {
  'network/mode': '1',
  'audioVideo/connection': '2',
  'audioVideo/transmission': '2',
  'audioVideo/videoCapture/type': '0',
  'audioVideo/videoReciever/type': '1',
  'audioVideo/videoReciever/ndi/name': 's_channel_0',
  'audioVideo/audioReceiver/type': '1',
  'audioVideo/audioReceiver/coreaudio/menu/selection': 'BlackHole 16ch'
}

const UG_AUDIO_ONLY_OVERRIDES: Record<string, string> = {
  'network/mode': '1',
  'audioVideo/connection': '2',
  'audioVideo/transmission': '1',
  'audioVideo/audioCapture/type': '1',
  'audioVideo/audioCapture/coreaudio/menu/selection': 'BlackHole 16ch',
  'audioVideo/audioReceiver/type': '1',
  'audioVideo/audioReceiver/coreaudio/menu/selection': 'MacBook Pro Speakers'
}

export function buildRoom(): {
  local: TopicMap
  remoteB: TopicMap
  remoteC: TopicMap
} {
  const a = PEERS.local
  const b = PEERS.remoteB
  const c = PEERS.remoteC

  const local: TopicMap = {
    ...emptyChannels(a.peerId, [0, 1, 2]),
    ...settingsTopics(a),
    ...ultraGridDevice(a, 0, {
      overrides: UG_SENDING_OVERRIDES,
      enabled: true,
      description: 'Camera 1',
      indicators: '1 1 30 -12.4 29.9 -14.1',
      monitorLog: ''
    }),
    ...oscDevice(a, 1, {
      enabled: true,
      flowing: true,
      description: 'Cues',
      outputIPOne: '127.0.0.1',
      outputPortOne: '7400'
    }),
    ...oscDevice(a, 2, { stageControl: true, enabled: true, flowing: true })
  }

  const remoteB: TopicMap = {
    ...emptyChannels(b.peerId, [0, 1, 3, 4]),
    ...settingsTopics(b),
    ...ultraGridDevice(b, 0, {
      overrides: UG_RECEIVING_OVERRIDES,
      enabled: true,
      description: 'Camera 1',
      indicators: '0 1 0 0 29.9 -14.1'
    }),
    ...oscDevice(b, 1, { enabled: true, flowing: true, description: 'Cues' }),
    ...ultraGridDevice(b, 3, {
      overrides: UG_AUDIO_ONLY_OVERRIDES,
      description: 'Talkback'
    }),
    ...natNetDevice(b, 4)
  }

  const remoteC: TopicMap = {
    ...emptyChannels(c.peerId, [0, 3, 5]),
    ...settingsTopics(c, { locked: true }),
    ...ultraGridDevice(c, 0, {
      overrides: UG_RECEIVING_OVERRIDES,
      enabled: true,
      description: 'Camera 1',
      indicators: '0 1 0 0 29.9 -14.1'
    }),
    ...ultraGridDevice(c, 3, {
      overrides: UG_AUDIO_ONLY_OVERRIDES,
      description: 'Talkback'
    }),
    ...motiveDevice(c, 5)
  }

  return { local, remoteB, remoteC }
}

// ── Non-MQTT state ───────────────────────────────────────────────

/** Read from package.json so the Settings screenshot never shows a stale version. */
const NG_VERSION: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).version

export const COMPAT_OK = {
  ngVersion: NG_VERSION,
  lastCheckedAt: Date.UTC(2026, 2, 3, 9, 41),
  tools: [
    {
      id: 'ultragrid',
      label: 'UltraGrid',
      required: '1.10.3',
      installed: '1.10.3',
      path: '/Applications/uv-qt.app/Contents/MacOS/uv',
      status: 'ok'
    },
    {
      id: 'natnetOsc',
      label: 'NatNetFour2OSC',
      required: '1.2.0',
      installed: null,
      path: null,
      status: 'unsupported-os'
    }
  ]
}

export const COMPAT_MISSING = {
  ...COMPAT_OK,
  tools: [
    { ...COMPAT_OK.tools[0], installed: null, path: null, status: 'missing' },
    COMPAT_OK.tools[1]
  ]
}

/** Proxy state for the channel header indicators and the proxy status modal. */
export function switchboardState() {
  const proxy = (
    port: number,
    offset: number,
    running: boolean,
    traffic = false,
    clients: Record<string, { role: string; last_seen: number }> = {}
  ) => ({
    port,
    offset,
    running,
    pid: running ? 4000 + offset : 0,
    packets_in: traffic ? 184_223 : 0,
    bytes_in: traffic ? 246_118_400 : 0,
    packets_out: traffic ? 368_446 : 0,
    bytes_out: traffic ? 492_236_800 : 0,
    clients
  })

  const now = Math.floor(Date.now() / 1000)
  return {
    roomId: ROOM.id,
    error: false,
    channels: {
      0: [
        proxy(11002, 2, true, true, {
          '192.168.10.21': { role: 'source', last_seen: now },
          '192.168.20.34': { role: 'sink', last_seen: now },
          '192.168.30.12': { role: 'sink', last_seen: now }
        }),
        proxy(11004, 4, true, true, {
          '192.168.10.21': { role: 'source', last_seen: now },
          '192.168.20.34': { role: 'sink', last_seen: now }
        })
      ],
      1: [
        proxy(11017, 7, true, true, {
          '192.168.10.21': { role: 'peer', last_seen: now },
          '192.168.20.34': { role: 'peer', last_seen: now }
        }),
        proxy(11018, 8, true),
        proxy(11019, 9, true, true)
      ],
      2: [proxy(11027, 7, true), proxy(11028, 8, true), proxy(11029, 9, true, true)],
      3: [proxy(11032, 2, true), proxy(11034, 4, true)],
      4: [proxy(11040, 0, true), proxy(11041, 1, true)],
      5: [proxy(11050, 0, true), proxy(11052, 2, true), proxy(11056, 6, true)]
    }
  }
}

/**
 * The Activity log is an MQTT traffic log, not an application log: one line per
 * subscribe / publish / receive, which is what makes the echo-driven design
 * legible (see LogPanel.vue). Entries below are a plausible join sequence.
 */
export function logEntries(): Array<{
  seq: number
  ts: number
  kind: 'sub' | 'unsub' | 'pub' | 'recv'
  topic: string
  value?: string
  retained?: boolean
}> {
  const a = PEERS.local.peerId
  const b = PEERS.remoteB.peerId
  const raw: Array<[('sub' | 'unsub' | 'pub' | 'recv'), string, string?, boolean?]> = [
    ['sub',  `/peer/${a}/settings/#`],
    ['sub',  `/peer/${a}/rack/+/+/loaded`],
    ['pub',  `/peer/${a}/settings/lock/enable`, '0', true],
    ['pub',  `/peer/${a}/settings/background/color`, PEERS.local.color, true],
    ['recv', `/peer/${a}/settings/background/color`, PEERS.local.color],
    ['sub',  `/peer/${b}/#`],
    ['recv', `/peer/${b}/rack/page_0/channel.0/loaded`, '2'],
    ['pub',  `/peer/${a}/rack/page_0/channel.0/loaded`, '2', true],
    ['recv', `/peer/${a}/rack/page_0/channel.0/loaded`, '2'],
    ['sub',  `/peer/${a}/rack/page_0/channel.0/device/#`],
    ['pub',  `/peer/${a}/rack/page_0/channel.0/device/gui/network/mode`, '1', true],
    ['pub',  `/peer/${a}/rack/page_0/channel.0/device/gui/audioVideo/connection`, '2', true],
    ['pub',  `/peer/${a}/rack/page_0/channel.0/device/gui/enable`, '0', true],
    ['recv', `/peer/${a}/rack/page_0/channel.0/device/gui/enable`, '0'],
    ['pub',  `/peer/${a}/rack/page_0/channel.0/device/gui/enable`, '1', true],
    ['recv', `/peer/${a}/rack/page_0/channel.0/device/gui/enable`, '1'],
    ['recv', `/peer/${a}/rack/page_0/channel.0/device/gui/indicators`, '1 1 30 -12.4 29.9 -14.1'],
    ['pub',  `/peer/${a}/rack/page_0/channel.1/loaded`, '1', true],
    ['recv', `/peer/${a}/rack/page_0/channel.1/loaded`, '1'],
    ['sub',  `/peer/${a}/rack/page_0/channel.1/device/#`],
    ['recv', `/peer/${a}/rack/page_0/channel.1/device/gui/localudp/inputPort`, '10019']
  ]
  // Fixed base timestamp keeps the rendered log identical between runs.
  const base = new Date(2026, 2, 3, 9, 41, 18, 220).getTime()
  return raw.map(([kind, topic, value, retained], i) => ({
    seq: i + 1,
    ts: base + i * 137,
    kind,
    topic,
    ...(value !== undefined ? { value } : {}),
    ...(retained !== undefined ? { retained } : {})
  }))
}

export const UPDATE_AVAILABLE = { state: 'available', version: '0.1.15' }

/**
 * Written into the throwaway Electron profile before launch. brokerUrl drives
 * the Stage Control URL the panel builds, and peerName/room prefill the Session
 * form, so the screenshots never show the author's real credentials.
 */
export const PROFILE_SETTINGS = {
  brokerUrl: ROOM.router,
  brokerPort: 3883,
  brokerUser: 'peer',
  brokerPwd: 'demo-password',
  peerName: PEERS.local.peerName,
  lastRoomName: ROOM.name,
  lastRoomPwd: 'demo-room-password',
  peerColor: PEERS.local.color,
  panelRowHeight: 560,
  switchboardPollIntervalSec: 5
}
