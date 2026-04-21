import { topics } from '../../../shared/topics'
import { allocateUgPorts, type UgPorts } from '../../portAllocator'
import { ChildProcessLifecycle, type LifecycleOptions, type ExitReason } from '../ChildProcessLifecycle'
import type { DeviceHandler } from '../types'
import {
  defaultUltraGridConfig,
  applyTopicChange,
  snapshotTopics,
  isConfigSubpath,
  isTransientSubpath,
  type UltraGridConfig
} from './config'
import { buildUvArgs, extractMenuIndex, type ResolvedMenuIndexes } from './cliBuilder'
import { MonitorLogBuffer } from './monitorLog'

type PublishFn = (retained: 0 | 1, topic: string, value: string) => void
type GetSettingFn = (subpath: string) => string | null
type SpawnFactory = (opts: LifecycleOptions) => ChildProcessLifecycle

const UG_DEVICE_TYPE = 2
const MONITOR_LOG_CAPACITY = 50

export type LocalOs = 'osx' | 'win' | 'linux'

export interface UltraGridDeviceOptions {
  channelIndex: number
  peerId: string
  localIP: string
  roomId: number
  publish: PublishFn
  hasRetained?: (topic: string) => boolean
  getSetting?: GetSettingFn
  host?: string
  resolveBinary?: () => string | null
  spawnFactory?: SpawnFactory
  osOverride?: LocalOs
}

function detectLocalOs(): LocalOs {
  if (process.platform === 'darwin') return 'osx'
  if (process.platform === 'win32') return 'win'
  return 'linux'
}

export class UltraGridDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType = UG_DEVICE_TYPE

  private readonly peerId: string
  private readonly roomId: number
  private readonly host: string
  private readonly publish: PublishFn
  private readonly hasRetained: (topic: string) => boolean
  private readonly getSetting: GetSettingFn
  private readonly resolveBinary: () => string | null
  private readonly spawnFactory: SpawnFactory
  private readonly localOs: LocalOs

  private config: UltraGridConfig = defaultUltraGridConfig()
  private readonly publishedTopics = new Set<string>()
  private readonly monitor = new MonitorLogBuffer(MONITOR_LOG_CAPACITY)
  private monitorGateOn = false

  private lifecycle: ChildProcessLifecycle | null = null
  private enabled = false

  constructor(opts: UltraGridDeviceOptions) {
    this.channelIndex = opts.channelIndex
    this.peerId = opts.peerId
    this.roomId = opts.roomId
    this.host = opts.host ?? 'telemersion.zhdk.ch'
    this.publish = opts.publish
    this.hasRetained = opts.hasRetained ?? (() => false)
    this.getSetting = opts.getSetting ?? (() => null)
    this.resolveBinary = opts.resolveBinary ?? (() => null)
    this.spawnFactory = opts.spawnFactory ?? ((o) => new ChildProcessLifecycle(o))
    this.localOs = opts.osOverride ?? detectLocalOs()
    this.config = applyTopicChange(this.config, 'remoteValues/local_os', this.localOs)
  }

  publishDefaults(): void {
    const defaults = applyTopicChange(
      defaultUltraGridConfig(),
      'remoteValues/local_os',
      this.localOs
    )
    for (const { subpath, value } of snapshotTopics(defaults)) {
      this.pubDeviceGui(subpath, value, false)
    }
    this.pubDeviceGui('description', 'UG', false)
    this.pubDeviceGui('indicators/inputIndicator', '0', false)
    this.pubDeviceGui('indicators/outputIndicator', '0', false)
    this.pubDeviceGui('monitor/log', '', false)
    this.pubDeviceGui('monitor/monitorGate', '0', false)
  }

  private pubDeviceGui(subpath: string, value: string, force: boolean): void {
    const topic = topics.deviceGui(this.peerId, this.channelIndex, subpath)
    this.publishedTopics.add(topic)
    if (!force && this.hasRetained(topic)) return
    this.publish(1, topic, value)
  }

  onTopicChanged(subpath: string, value: string): void {
    if (!subpath.startsWith('gui/')) return
    const tail = subpath.slice('gui/'.length)

    if (tail === 'enable') {
      this.handleEnable(value === '1')
      return
    }

    if (tail === 'monitor/monitorGate') {
      this.handleMonitorGate(value === '1')
      return
    }

    if (tail === 'monitor/log') return
    if (isTransientSubpath(tail)) return
    if (!isConfigSubpath(tail)) return

    this.config = applyTopicChange(this.config, tail, value)
  }

  private handleEnable(enable: boolean): void {
    if (enable && !this.enabled) {
      this.enabled = true
      this.startProcess()
    } else if (!enable && this.enabled) {
      this.enabled = false
      this.stopProcess()
    }
  }

  private handleMonitorGate(on: boolean): void {
    if (on === this.monitorGateOn) return
    this.monitorGateOn = on
    if (on) this.replayMonitorLog()
  }

  private startProcess(): void {
    const binary = this.resolveBinary()
    if (!binary) {
      this.logWarn('UltraGrid binary not found; cannot start')
      this.publishEnableOff()
      this.enabled = false
      return
    }

    const indexes = this.resolveMenuIndexes()
    const ports = allocateUgPorts(this.roomId, this.channelIndex)

    let args: string[]
    try {
      args = buildUvArgs({
        config: this.config,
        ports,
        indexes,
        host: this.host,
        textureReceiverName: this.config.audioVideo.videoReciever.texture.name,
        localOs: this.localOs
      })
    } catch (err) {
      this.logWarn(`cannot build UV args: ${(err as Error).message}`)
      this.publishEnableOff()
      this.enabled = false
      return
    }

    this.monitor.clear()
    const cliLine = `${binary} ${args.join(' ')}`
    console.log(`[UG ch.${this.channelIndex}] spawn: ${cliLine}`)
    const cliLogLine = `[CLI] ${cliLine}`
    this.monitor.append(cliLogLine)
    if (this.monitorGateOn) this.publishMonitorLine(cliLogLine)
    // Quotes in argv are shell syntax — spawn passes argv verbatim, so `'Simple Server'`
    // would reach uv as a literal 13-char string and fail the Syphon name match. Strip
    // wrapping single quotes here; the logged cliLine above keeps them for pastability.
    this.lifecycle = this.spawnFactory({
      binary,
      args: stripArgQuotes(args),
      env: sanitizedChildEnv(),
      onStdout: (line) => this.handleLogLine(line),
      onStderr: (line) => this.handleLogLine(line),
      onExit: (reason, code) => this.handleExit(reason, code, ports)
    })
    this.lifecycle.start()
  }

  private stopProcess(): void {
    this.lifecycle?.stop()
  }

  private handleLogLine(line: string): void {
    this.monitor.append(line)
    if (this.monitorGateOn) this.publishMonitorLine(line)
  }

  private publishMonitorLine(line: string): void {
    this.publish(
      1,
      topics.deviceGui(this.peerId, this.channelIndex, 'monitor/log'),
      line
    )
  }

  private replayMonitorLog(): void {
    for (const line of this.monitor.replay()) {
      this.publishMonitorLine(line)
    }
  }

  private handleExit(reason: ExitReason, code: number | null, _ports: UgPorts): void {
    this.lifecycle = null
    if (reason === 'killed') return
    const label = reason === 'spawn-failure' ? 'UV spawn-failure' : 'UV crashed'
    this.logWarn(`${label} (code ${code}); disabling`)
    this.enabled = false
    this.publishEnableOff()
  }

  private publishEnableOff(): void {
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  private logWarn(message: string): void {
    const line = `[NG] ${message}`
    this.monitor.append(line)
    if (this.monitorGateOn) this.publishMonitorLine(line)
    console.warn(`[UG ch.${this.channelIndex}] ${message}`)
  }

  private resolveMenuIndexes(): ResolvedMenuIndexes {
    const videoType = this.config.audioVideo.videoCapture.type
    const audioType = this.config.audioVideo.audioCapture.type
    const audioRxType = this.config.audioVideo.audioReceiver.type

    const textureSel = this.config.audioVideo.videoCapture.texture.menu.selection
    const ndiSel = this.config.audioVideo.videoCapture.ndi.menu.selection

    const textureCapture = videoType === '0' ? textureSel : null
    const ndiCapture = videoType === '1' ? ndiSel : null

    return {
      textureCapture,
      ndiCapture,
      audioCapture: this.resolveAudioIndex(audioType, 'Capture', true),
      audioReceive: this.resolveAudioIndex(audioRxType, 'Receive', false)
    }
  }

  private resolveAudioIndex(
    type: string,
    side: 'Capture' | 'Receive',
    capture: boolean
  ): number | null {
    const backend = audioBackendFromType(type)
    if (!backend) return null
    const section = capture
      ? this.config.audioVideo.audioCapture
      : this.config.audioVideo.audioReceiver
    const selection = (section as any)[backend]?.menu?.selection as string | undefined
    if (!selection || selection === '-default-') return null
    const rangeTopic = `localMenus/${backend}${side}Range`
    const range = this.getSetting(rangeTopic) ?? ''
    return extractMenuIndex(range, selection)
  }

  teardown(): string[] {
    this.lifecycle?.stop()
    this.lifecycle = null
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.lifecycle?.stop()
    this.lifecycle = null
  }
}

function audioBackendFromType(type: string): 'portaudio' | 'coreaudio' | 'wasapi' | 'jack' | null {
  if (type === '0') return 'portaudio'
  if (type === '1') return 'coreaudio'
  if (type === '2') return 'wasapi'
  if (type === '3') return 'jack'
  return null
}

// Strip env vars Electron injects into the main process so the UV child can't
// inherit Electron's launch identity. On macOS, `__CFBundleIdentifier` in
// particular conflates the child with the Electron host, which blocks Syphon
// server discovery across the launch boundary.
function sanitizedChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.__CFBundleIdentifier
  delete env.MallocNanoZone
  return env
}

function stripArgQuotes(args: string[]): string[] {
  return args.map((a) => a.replace(/'([^']*)'/g, '$1'))
}
