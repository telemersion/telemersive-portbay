import * as dgram from 'dgram'
import * as dns from 'dns'
import { promisify } from 'util'
import { topics } from '../../shared/topics'
import { allocateLocalPorts, allocateRoomPorts, allocateStageControlPort, type OscPorts } from '../portAllocator'
import type { DeviceHandler } from './types'

const dnsLookup = promisify(dns.lookup)

const HEARTBEAT = Buffer.from([47, 104, 98, 0, 44, 0, 0, 0]) // OSC /hb
const HEARTBEAT_INTERVAL_MS = 5000

type PublishFn = (retained: 0 | 1, topic: string, value: string) => void
type HasRetainedFn = (topic: string) => boolean

export class OscDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType: number
  private peerId: string
  private localIP: string
  private brokerHost: string
  private localPorts: OscPorts
  private roomPorts: OscPorts
  private stageControlPort: number
  private publishedTopics: string[] = []
  private publish: PublishFn
  private hasRetained: HasRetainedFn

  private enabled = false
  private enableTwo = false
  private outputIPOne: string
  private outputIPTwo: string

  // Single UDP socket per device, bound on local inputPort.
  // - Receives from local OSC app → forwards to proxy (room port)
  // - Receives from proxy (after it learns our src tuple on first send) → forwards to local outputPort(s)
  private socket: dgram.Socket | null = null
  private proxyIP: string | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  private _isRunning = false
  get isRunning(): boolean { return this._isRunning }

  // Indicator debouncing: publish '1' on first packet in a window, '0' after silence.
  private inputIndicatorOn = false
  private outputIndicatorOn = false
  private inputIndicatorTimer: NodeJS.Timeout | null = null
  private outputIndicatorTimer: NodeJS.Timeout | null = null
  private static readonly INDICATOR_HOLD_MS = 150

  constructor(
    channelIndex: number,
    peerId: string,
    localIP: string,
    roomId: number,
    publish: PublishFn,
    deviceType: number = 1,
    hasRetained: HasRetainedFn = () => false,
    brokerHost: string = 'telemersion.zhdk.ch'
  ) {
    this.channelIndex = channelIndex
    this.deviceType = deviceType
    this.peerId = peerId
    this.localIP = localIP
    this.brokerHost = brokerHost
    this.localPorts = allocateLocalPorts(channelIndex)
    this.roomPorts = allocateRoomPorts(roomId, channelIndex)
    this.stageControlPort = allocateStageControlPort(roomId)
    this.publish = publish
    this.hasRetained = hasRetained
    this.outputIPOne = localIP
    this.outputIPTwo = localIP
  }

  private roomDestPort(): number {
    return this.deviceType === 4 ? this.stageControlPort : this.roomPorts.inputPort
  }

  publishDefaults(): void {
    this.emitDefaults(false)
  }

  private emitDefaults(force: boolean): void {
    const pub = (field: string, value: string) => {
      const topic = this.isLocaludp(field)
        ? topics.localudp(this.peerId, this.channelIndex, field)
        : this.isMonitor(field)
          ? topics.monitor(this.peerId, this.channelIndex, field)
          : topics.deviceGui(this.peerId, this.channelIndex, field)

      this.publishedTopics.push(topic)
      if (!force && this.hasRetained(topic)) return
      this.publish(1, topic, value)
    }

    pub('peerLocalIP', this.localIP)
    pub('enableTwo', '0')
    pub('inputPort', String(this.localPorts.inputPort))
    pub('outputIPOne', this.localIP)
    pub('outputIPTwo', this.localIP)
    pub('outputPortOne', String(this.localPorts.outputPortOne))
    pub('outputPortTwo', String(this.localPorts.outputPortTwo))
    pub('reset', '0')

    pub('log', '0')
    pub('monitorGate', '0')

    pub('description', this.deviceType === 4 ? 'StageC' : 'OSC')
    pub('enable', '0')
    pub('inputIndicator', '0')
    pub('outputIndicator', '0')
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
        if (value && value !== '0') this.outputIPOne = value
        break
      case 'gui/localudp/outputIPTwo':
        if (value && value !== '0') this.outputIPTwo = value
        break
      case 'gui/localudp/enableTwo':
        this.enableTwo = value === '1'
        break
      case 'gui/localudp/outputPortOne':
        this.localPorts.outputPortOne = parseInt(value, 10) || this.localPorts.outputPortOne
        break
      case 'gui/localudp/outputPortTwo':
        this.localPorts.outputPortTwo = parseInt(value, 10) || this.localPorts.outputPortTwo
        break
      case 'gui/localudp/inputPort':
        this.localPorts.inputPort = parseInt(value, 10) || this.localPorts.inputPort
        break
      case 'gui/localudp/reset':
        if (value === '1' && !this.enabled) {
          this.resetToDefaults()
        }
        break
    }
  }

  private resetToDefaults(): void {
    this.localPorts = allocateLocalPorts(this.channelIndex)
    this.outputIPOne = this.localIP
    this.outputIPTwo = this.localIP
    this.enableTwo = false
    this.emitDefaults(true)
  }

  private handleEnable(enable: boolean): void {
    if (enable && !this.enabled) {
      this.enabled = true
      void this.startRelay()
    } else if (!enable && this.enabled) {
      this.enabled = false
      this.stopRelay()
    }
  }

  private async startRelay(): Promise<void> {
    try {
      const { address } = await dnsLookup(this.brokerHost, { family: 4 })
      this.proxyIP = address
    } catch (err: any) {
      console.error(`[OSC ch.${this.channelIndex}] DNS lookup failed for ${this.brokerHost}:`, err.message)
      this.disableOnError()
      return
    }

    if (!this.enabled) return

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      this.socket.on('message', (msg, rinfo) => {
        if (rinfo.address === this.proxyIP) {
          this.pulseOutputIndicator()
          this.socket!.send(msg, 0, msg.length, this.localPorts.outputPortOne, this.outputIPOne)
          if (this.enableTwo) {
            this.socket!.send(msg, 0, msg.length, this.localPorts.outputPortTwo, this.outputIPTwo)
          }
        } else {
          this.pulseInputIndicator()
          this.socket!.send(msg, 0, msg.length, this.roomDestPort(), this.proxyIP!)
        }
      })
      this.socket.on('error', (err) => {
        console.error(`[OSC ch.${this.channelIndex}] socket error:`, err.message)
        this.disableOnError()
      })
      this.socket.bind(this.localPorts.inputPort, this.localIP, () => {
        this._isRunning = true
        console.log(`[OSC ch.${this.channelIndex}] relay up — local in:${this.localPorts.inputPort} out:${this.localPorts.outputPortOne} → proxy ${this.proxyIP}:${this.roomDestPort()}`)
        this.sendHeartbeat()
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS)
      })
    } catch (err: any) {
      console.error(`[OSC ch.${this.channelIndex}] failed to start relay:`, err.message)
      this.disableOnError()
    }
  }

  private pulseInputIndicator(): void {
    if (!this.inputIndicatorOn) {
      this.inputIndicatorOn = true
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'inputIndicator'), '1')
    }
    if (this.inputIndicatorTimer) clearTimeout(this.inputIndicatorTimer)
    this.inputIndicatorTimer = setTimeout(() => {
      this.inputIndicatorOn = false
      this.inputIndicatorTimer = null
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'inputIndicator'), '0')
    }, OscDevice.INDICATOR_HOLD_MS)
  }

  private pulseOutputIndicator(): void {
    if (!this.outputIndicatorOn) {
      this.outputIndicatorOn = true
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'outputIndicator'), '1')
    }
    if (this.outputIndicatorTimer) clearTimeout(this.outputIndicatorTimer)
    this.outputIndicatorTimer = setTimeout(() => {
      this.outputIndicatorOn = false
      this.outputIndicatorTimer = null
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'outputIndicator'), '0')
    }, OscDevice.INDICATOR_HOLD_MS)
  }

  private disableOnError(): void {
    this.stopRelay()
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  private sendHeartbeat(): void {
    if (!this.socket || !this.proxyIP) return
    this.socket.send(HEARTBEAT, 0, HEARTBEAT.length, this.roomDestPort(), this.proxyIP)
  }

  private stopRelay(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.socket) {
      try { this.socket.close() } catch {}
      this.socket = null
    }
    this.proxyIP = null
    if (this.inputIndicatorTimer) {
      clearTimeout(this.inputIndicatorTimer)
      this.inputIndicatorTimer = null
    }
    if (this.outputIndicatorTimer) {
      clearTimeout(this.outputIndicatorTimer)
      this.outputIndicatorTimer = null
    }
    if (this.inputIndicatorOn) {
      this.inputIndicatorOn = false
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'inputIndicator'), '0')
    }
    if (this.outputIndicatorOn) {
      this.outputIndicatorOn = false
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'outputIndicator'), '0')
    }
    this._isRunning = false
  }

  teardown(): string[] {
    this.stopRelay()
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.stopRelay()
  }
}
