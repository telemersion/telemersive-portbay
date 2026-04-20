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
  }

  publishDefaults(): void {
    const defaults = defaultUltraGridConfig()
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
    if (on) this.publishMonitorLog()
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
        textureReceiverName: this.config.audioVideo.videoReciever.texture.name
      })
    } catch (err) {
      this.logWarn(`cannot build UV args: ${(err as Error).message}`)
      this.publishEnableOff()
      this.enabled = false
      return
    }

    this.monitor.clear()
    this.lifecycle = this.spawnFactory({
      binary,
      args,
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
    if (this.monitorGateOn) this.publishMonitorLog()
  }

  private publishMonitorLog(): void {
    this.publish(
      1,
      topics.deviceGui(this.peerId, this.channelIndex, 'monitor/log'),
      this.monitor.snapshot()
    )
  }

  private handleExit(reason: ExitReason, code: number | null, _ports: UgPorts): void {
    this.lifecycle = null
    if (reason === 'killed') return
    if (reason === 'spawn-failure') {
      this.logWarn(`UV spawn-failure (code ${code}); leaving enable=1 for retry`)
      return
    }
    this.logWarn(`UV crashed (code ${code}); disabling`)
    this.enabled = false
    this.publishEnableOff()
  }

  private publishEnableOff(): void {
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  private logWarn(message: string): void {
    this.monitor.append(`[NG] ${message}`)
    if (this.monitorGateOn) this.publishMonitorLog()
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
