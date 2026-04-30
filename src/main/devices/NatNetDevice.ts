import * as dgram from 'dgram'
import * as dns from 'dns'
import { promisify } from 'util'
import { topics } from '../../shared/topics'
import { allocateMocapLocalPorts, allocateMocapRoomPorts, type MocapPorts } from '../portAllocator'
import type { DeviceHandler } from './types'

const dnsLookup = promisify(dns.lookup)

type PublishFn = (retained: 0 | 1, topic: string, ...values: string[]) => void
type HasRetainedFn = (topic: string) => boolean

// direction/select values (confirmed from Max dropdown):
//   1 = send to router          (requires NatNetThree2OSC CLI)
//   2 = receive from router     (pure OSC relay — no CLI needed)
//   4 = send to local           (requires NatNetThree2OSC CLI)
export const enum Direction {
  SendToRouter = 1,
  ReceiveFromRouter = 2,
  SendToLocal = 4
}

// Heartbeat packet sent by sink-clients to the proxy's many_port to register/stay alive.
// OSC message "/hb" with no args: bytes [47,104,98,0, 44,0,0,0]
const HEARTBEAT = Buffer.from([47, 104, 98, 0, 44, 0, 0, 0])
const HEARTBEAT_INTERVAL_MS = 5000

function localOsTag(): string {
  if (process.platform === 'darwin') return 'osx'
  if (process.platform === 'win32') return 'windows'
  return process.platform
}

export class NatNetDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType = 3
  private peerId: string
  private localIP: string
  private brokerHost: string
  private localPorts: MocapPorts
  private roomPorts: MocapPorts
  private publishedTopics: string[] = []
  private publish: PublishFn
  private hasRetained: HasRetainedFn

  private enabled = false
  private enableTwo = false
  private direction: number = Direction.ReceiveFromRouter
  // Local forwarding targets — where received packets are forwarded on this machine.
  private outputPortOne: number
  private outputPortTwo: number
  private outputIPOne: string
  private outputIPTwo: string
  private listeningIP: string

  // Receive-from-router relay state (direction = 2).
  private socket: dgram.Socket | null = null
  private proxyIP: string | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  // Indicator slot 1 ("minor") pulses on inbound proxy traffic.
  private minorIndicatorOn = false
  private minorIndicatorTimer: NodeJS.Timeout | null = null
  private static readonly INDICATOR_HOLD_MS = 150

  constructor(
    channelIndex: number,
    peerId: string,
    localIP: string,
    roomId: number,
    publish: PublishFn,
    hasRetained: HasRetainedFn = () => false,
    brokerHost: string = 'telemersion.zhdk.ch'
  ) {
    this.channelIndex = channelIndex
    this.peerId = peerId
    this.localIP = localIP
    this.brokerHost = brokerHost
    this.localPorts = allocateMocapLocalPorts(channelIndex)
    this.roomPorts = allocateMocapRoomPorts(roomId, channelIndex)
    this.publish = publish
    this.hasRetained = hasRetained
    this.outputPortOne = this.localPorts.inputPort
    this.outputPortTwo = this.localPorts.inputPort
    this.outputIPOne = localIP
    this.outputIPTwo = localIP
    this.listeningIP = localIP
  }

  publishDefaults(): void {
    this.emitDefaults(false)
  }

  private emitDefaults(force: boolean): void {
    const pub = (field: string, value: string) => {
      const topic = topics.deviceGui(this.peerId, this.channelIndex, field)
      this.publishedTopics.push(topic)
      if (!force && this.hasRetained(topic)) return
      this.publish(1, topic, ...value.split(' '))
    }

    pub('direction/select', String(Direction.ReceiveFromRouter))
    pub('direction/enableNatNet', '0')

    pub('localudp/inputPort', String(this.localPorts.inputPort))
    pub('localudp/listeningIP', this.localIP)
    pub('localudp/outputIPOne', this.localIP)
    pub('localudp/outputIPTwo', this.localIP)
    pub('localudp/outputPortOne', String(this.outputPortOne))
    pub('localudp/outputPortTwo', String(this.outputPortTwo))
    pub('localudp/reset', '0')

    // NatNet CLI parameters — meaningful only when direction = SendToRouter/SendToLocal.
    // Defaults mirror Max patch; NatNetThree2OSC CLI spawn is not wired yet (stage 2).
    pub('natnet/defaultLocalIP', '0')
    pub('natnet/autoReconnect', '0')
    pub('natnet/bundled', '0')
    pub('natnet/cmdPort', '1510')
    pub('natnet/codec', '3')
    pub('natnet/dataPort', '1511')
    pub('natnet/frameModulo', '1')
    pub('natnet/invmatrix', '0')
    pub('natnet/leftHanded', '0')
    pub('natnet/matrix', '0')
    pub('natnet/motiveIP', this.localIP)
    pub('natnet/multicastIP', '239.255.42.99')
    pub('natnet/sendMarkerInfos', '0')
    pub('natnet/sendOtherMarkerInfos', '0')
    pub('natnet/sendSkeletons', '0')
    pub('natnet/verbose', '0')
    pub('natnet/yUp2zUp', '0')

    pub('monitor/log', '0')
    pub('monitor/monitorGate', '0')

    pub('remoteValues/local_os', localOsTag())

    pub('description', 'MoCap')
    pub('enable', '0')
    pub('enableTwo', '0')
    // Combined indicators string "{input} {output} {running}" (3 slots).
    pub('indicators', '0 0 0')
  }

  onTopicChanged(subpath: string, value: string): void {
    switch (subpath) {
      case 'gui/enable':
        this.handleEnable(value === '1')
        break
      case 'gui/enableTwo':
        this.enableTwo = value === '1'
        break
      case 'gui/direction/select':
        this.direction = parseInt(value, 10) || 0
        break
      case 'gui/direction/enableNatNet':
        // stored for future CLI wiring
        break
      case 'gui/localudp/outputIPOne':
        if (value && value !== '0') this.outputIPOne = value
        break
      case 'gui/localudp/outputIPTwo':
        if (value && value !== '0') this.outputIPTwo = value
        break
      case 'gui/localudp/listeningIP':
        if (value && value !== '0') this.listeningIP = value
        break
      case 'gui/localudp/outputPortOne':
        this.outputPortOne = parseInt(value, 10) || this.outputPortOne
        break
      case 'gui/localudp/outputPortTwo':
        this.outputPortTwo = parseInt(value, 10) || this.outputPortTwo
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
    this.localPorts = allocateMocapLocalPorts(this.channelIndex)
    this.outputPortOne = this.localPorts.inputPort
    this.outputPortTwo = this.localPorts.inputPort
    this.outputIPOne = this.localIP
    this.outputIPTwo = this.localIP
    this.listeningIP = this.localIP
    this.enableTwo = false
    this.emitDefaults(true)
  }

  private handleEnable(enable: boolean): void {
    if (enable === this.enabled) return
    if (enable) {
      if (this.direction === Direction.ReceiveFromRouter) {
        this.enabled = true
        void this.startReceiveRelay()
        return
      }
      // SendToRouter (1) and SendToLocal (4) require the NatNetThree2OSC CLI — not wired yet.
      const mode = this.direction === Direction.SendToLocal ? 'send-to-local' : 'send-to-router'
      console.log(`[NatNet ch.${this.channelIndex}] enable=1 (direction=${mode}) — handler not implemented yet`)
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      return
    }
    this.enabled = false
    this.stopReceiveRelay()
    console.log(`[NatNet ch.${this.channelIndex}] enable=0`)
  }

  // Receive-from-router (direction=2): bind roomPorts.inputPort (proxy many_port = base+1),
  // send periodic heartbeats to stay registered as a sink, forward received packets
  // to outputPortOne (and outputPortTwo if enableTwo).
  private async startReceiveRelay(): Promise<void> {
    try {
      const { address } = await dnsLookup(this.brokerHost, { family: 4 })
      this.proxyIP = address
    } catch (err: any) {
      console.error(`[NatNet ch.${this.channelIndex}] DNS lookup failed for ${this.brokerHost}:`, err.message)
      this.disableOnError()
      return
    }

    if (!this.enabled) return

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      this.socket.on('message', (msg, rinfo) => {
        if (rinfo.address !== this.proxyIP) return
        this.pulseMinorIndicator()
        this.socket!.send(msg, 0, msg.length, this.outputPortOne, this.outputIPOne)
        if (this.enableTwo) {
          this.socket!.send(msg, 0, msg.length, this.outputPortTwo, this.outputIPTwo)
        }
      })
      this.socket.on('error', (err) => {
        console.error(`[NatNet ch.${this.channelIndex}] socket error:`, err.message)
        this.disableOnError()
      })
      this.socket.bind(this.roomPorts.inputPort, this.listeningIP, () => {
        console.log(
          `[NatNet ch.${this.channelIndex}] receive relay up — ` +
          `proxy ${this.proxyIP}:${this.roomPorts.inputPort} → ` +
          `local ${this.outputPortOne}${this.enableTwo ? `/${this.outputPortTwo}` : ''}`
        )
        this.sendHeartbeat()
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS)
      })
    } catch (err: any) {
      console.error(`[NatNet ch.${this.channelIndex}] failed to start receive relay:`, err.message)
      this.disableOnError()
    }
  }

  private sendHeartbeat(): void {
    if (!this.socket || !this.proxyIP) return
    this.socket.send(HEARTBEAT, 0, HEARTBEAT.length, this.roomPorts.inputPort, this.proxyIP)
  }

  private pulseMinorIndicator(): void {
    if (!this.minorIndicatorOn) {
      this.minorIndicatorOn = true
      this.publishIndicators()
    }
    if (this.minorIndicatorTimer) clearTimeout(this.minorIndicatorTimer)
    this.minorIndicatorTimer = setTimeout(() => {
      this.minorIndicatorOn = false
      this.minorIndicatorTimer = null
      this.publishIndicators()
    }, NatNetDevice.INDICATOR_HOLD_MS)
  }

  private publishIndicators(): void {
    const minor = this.minorIndicatorOn ? '1' : '0'
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'indicators'), '0', minor, '0')
  }

  private disableOnError(): void {
    this.stopReceiveRelay()
    this.enabled = false
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  private stopReceiveRelay(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.socket) {
      try { this.socket.close() } catch {}
      this.socket = null
    }
    this.proxyIP = null
    if (this.minorIndicatorTimer) {
      clearTimeout(this.minorIndicatorTimer)
      this.minorIndicatorTimer = null
    }
    if (this.minorIndicatorOn) {
      this.minorIndicatorOn = false
      this.publishIndicators()
    }
  }

  teardown(): string[] {
    this.stopReceiveRelay()
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.enabled = false
    this.stopReceiveRelay()
  }
}
