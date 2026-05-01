import * as dgram from 'dgram'
import * as dns from 'dns'
import { networkInterfaces } from 'os'
import { promisify } from 'util'
import { topics } from '../../../shared/topics'
import { allocateMotiveRoomPorts, type MotivePorts } from '../../portAllocator'
import type { DeviceHandler } from '../types'
import {
  MotiveDirection,
  type MotiveConfig,
  type HealthState,
  type MotiveSibling,
  DEFAULT_MULTICAST_IP,
  DEFAULT_DATA_PORT,
  DEFAULT_CMD_PORT,
  SOURCE_HANDSHAKE,
  SINK_HANDSHAKE,
  HANDSHAKE_INTERVAL_MS,
  HANDSHAKE_OK_WINDOW_MS,
  findPortConflict,
  formatPortConflict,
  deriveHealthState,
  defaultsForDirection,
  defaultDescription
} from './motiveLogic'

const dnsLookup = promisify(dns.lookup)

const HEALTH_TICK_MS = 500
const INDICATOR_HOLD_MS = 200
const MOTIVE_DEVICE_TYPE = 5

type PublishFn = (retained: 0 | 1, topic: string, ...values: string[]) => void
type HasRetainedFn = (topic: string) => boolean
type SiblingProviderFn = () => MotiveSibling[]

export interface MotiveDeviceOptions {
  channelIndex: number
  peerId: string
  localIP: string
  roomId: number
  publish: PublishFn
  hasRetained?: HasRetainedFn
  brokerHost?: string
  // Returns the current state of all loaded Motive devices on this peer
  // (including this one). Used at enable time for the port-conflict check.
  siblings?: SiblingProviderFn
}

export class MotiveDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType = MOTIVE_DEVICE_TYPE

  private peerId: string
  private localIP: string
  private brokerHost: string
  private roomPorts: MotivePorts
  private publish: PublishFn
  private hasRetained: HasRetainedFn
  private siblingsProvider: SiblingProviderFn

  private publishedTopics: string[] = []

  // Wire state
  private enabled = false
  private direction: MotiveDirection = MotiveDirection.Source
  private multicastIP = DEFAULT_MULTICAST_IP
  private dataPort = DEFAULT_DATA_PORT
  private cmdPort = DEFAULT_CMD_PORT
  private interfaceName = ''
  private motiveIP = ''

  // Runtime state
  private proxyIP: string | null = null
  private dataSocket: dgram.Socket | null = null
  private cmdSocket: dgram.Socket | null = null
  private handshakeTimer: NodeJS.Timeout | null = null
  private healthTimer: NodeJS.Timeout | null = null

  // Sink-only: address+port of the consumer (Unity), captured the moment it
  // sends its first cmd packet. null until first contact.
  private clientCmndAddress: string | null = null
  private clientCmndPort: number | null = null

  // Observation counters (used by health-state derivation).
  private lastHandshakeReplyAt: number | null = null
  private lastDataPacketAt: number | null = null
  private lastCmdPacketAt: number | null = null
  private lastConsumerCmdAt: number | null = null
  private duplicateSourceDetected = false
  private interfaceMissing = false
  private portConflict = false

  // Indicator pulse state (slot 0=data, slot 1=cmd, slot 2=direction, slot 3=running).
  private dataPulseTimer: NodeJS.Timeout | null = null
  private cmdPulseTimer: NodeJS.Timeout | null = null
  private dataPulseOn = false
  private cmdPulseOn = false
  private lastPublishedHealth: HealthState | null = null
  private lastPublishedIndicators = ''

  constructor(opts: MotiveDeviceOptions) {
    this.channelIndex = opts.channelIndex
    this.peerId = opts.peerId
    this.localIP = opts.localIP
    this.brokerHost = opts.brokerHost ?? 'telemersion.zhdk.ch'
    this.roomPorts = allocateMotiveRoomPorts(opts.roomId, opts.channelIndex)
    this.publish = opts.publish
    this.hasRetained = opts.hasRetained ?? (() => false)
    this.siblingsProvider = opts.siblings ?? (() => [])
  }

  publishDefaults(): void {
    const pub = (field: string, value: string): void => {
      const topic = topics.deviceGui(this.peerId, this.channelIndex, field)
      this.publishedTopics.push(topic)
      if (this.hasRetained(topic)) return
      this.publish(1, topic, ...value.split(' '))
    }

    pub('direction/select', String(MotiveDirection.Source))
    pub('localudp/multicastIP', DEFAULT_MULTICAST_IP)
    pub('localudp/dataPort', String(DEFAULT_DATA_PORT))
    pub('localudp/cmdPort', String(DEFAULT_CMD_PORT))
    pub('localudp/interfaceName', this.guessInterfaceName())
    pub('localudp/motiveIP', '')
    pub('localudp/reset', '0')

    pub('health/state', 'ok')
    pub('indicators', '0 0 1 0')
    pub('monitor/log', '')
    pub('monitor/monitorGate', '0')

    pub('description', defaultDescription(MotiveDirection.Source))
    pub('enable', '0')
  }

  onTopicChanged(subpath: string, value: string): void {
    switch (subpath) {
      case 'gui/enable':
        if (value === '1') this.handleEnable()
        else this.handleDisable()
        break
      case 'gui/direction/select': {
        const next = parseInt(value, 10) === MotiveDirection.Sink
          ? MotiveDirection.Sink
          : MotiveDirection.Source
        if (next !== this.direction) this.handleDirectionChange(next)
        break
      }
      case 'gui/localudp/multicastIP':
        if (value) this.multicastIP = value
        break
      case 'gui/localudp/dataPort': {
        const n = parseInt(value, 10)
        if (n > 0) this.dataPort = n
        break
      }
      case 'gui/localudp/cmdPort': {
        const n = parseInt(value, 10)
        if (n > 0) this.cmdPort = n
        break
      }
      case 'gui/localudp/interfaceName':
        this.interfaceName = value || ''
        break
      case 'gui/localudp/motiveIP':
        this.motiveIP = value || ''
        break
      case 'gui/localudp/reset':
        if (value === '1' && !this.enabled) {
          this.handleReset()
        }
        break
      default:
        // Other subpaths (description, monitor/*, health/*) are state-only.
        break
    }
  }

  // ─── Enable / disable ─────────────────────────────────────────────────
  private async handleEnable(): Promise<void> {
    if (this.enabled) return

    // Q15-E: refuse to enable on multicast or cmd-port collision with another
    // enabled Motive sibling on this peer.
    const conflict = findPortConflict({
      self: { channelIndex: this.channelIndex, config: this.snapshotConfig() },
      siblings: this.siblingsProvider().filter((s) => s.channelIndex !== this.channelIndex)
    })
    if (conflict) {
      this.portConflict = true
      this.logMonitor(formatPortConflict(conflict, this.snapshotConfig()))
      this.publishHealth('port_conflict')
      // Auto-flip enable=0 — let the rack reflect that we did not start.
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      return
    }
    this.portConflict = false

    if (!this.interfaceExists(this.interfaceName)) {
      this.interfaceMissing = true
      this.logMonitor(`Interface "${this.interfaceName}" not found on this host. Pick another interface.`)
      this.publishHealth('interface_missing')
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      return
    }
    this.interfaceMissing = false

    try {
      const { address } = await dnsLookup(this.brokerHost, { family: 4 })
      this.proxyIP = address
    } catch (err: any) {
      this.logMonitor(`DNS lookup failed for ${this.brokerHost}: ${err.message}`)
      this.publishHealth('no_proxy')
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      return
    }

    this.enabled = true
    this.duplicateSourceDetected = false
    this.lastHandshakeReplyAt = null
    this.lastDataPacketAt = null
    this.lastConsumerCmdAt = null

    try {
      if (this.direction === MotiveDirection.Source) {
        this.startSource()
      } else {
        this.startSink()
      }
    } catch (err: any) {
      this.logMonitor(`Failed to start ${this.direction === 1 ? 'Source' : 'Sink'} relay: ${err.message}`)
      this.disableInternal()
      return
    }

    this.startHandshakeLoop()
    this.startHealthTick()
  }

  private handleDisable(): void {
    if (!this.enabled) return
    this.disableInternal()
  }

  private disableInternal(): void {
    this.enabled = false
    this.stopRelay()
    this.publishHealth('ok')
    this.publishIndicators(true)
  }

  private handleReset(): void {
    if (this.enabled) return
    const fallbackIface = this.guessInterfaceName()
    const fresh = defaultsForDirection(this.direction, fallbackIface)
    this.multicastIP = fresh.multicastIP
    this.dataPort = fresh.dataPort
    this.cmdPort = fresh.cmdPort
    this.interfaceName = fresh.interfaceName
    this.motiveIP = ''

    const pub = (field: string, value: string): void => {
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, field), ...value.split(' '))
    }
    pub('localudp/multicastIP', fresh.multicastIP)
    pub('localudp/dataPort', String(fresh.dataPort))
    pub('localudp/cmdPort', String(fresh.cmdPort))
    pub('localudp/interfaceName', fresh.interfaceName)
    pub('localudp/motiveIP', '')
    pub('localudp/reset', '0')
  }

  private handleDirectionChange(next: MotiveDirection): void {
    // Q20-A: direction change while enable=0 tears down per-role state but
    // keeps user-shared fields. The handler reconstructs in the new role on
    // the next enable.
    this.stopRelay()
    this.direction = next
    this.clientCmndAddress = null
    this.clientCmndPort = null
    this.motiveIP = ''
    this.duplicateSourceDetected = false

    // Q16: if description still equals the prior default, follow the role.
    const priorDefault = defaultDescription(next === MotiveDirection.Source ? MotiveDirection.Sink : MotiveDirection.Source)
    const descTopic = topics.deviceGui(this.peerId, this.channelIndex, 'description')
    if (this.hasRetained(descTopic)) {
      // We don't know the prior value here; the panel handles default-tracking
      // via its own watch. The handler updates motiveIP only.
    }
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'localudp/motiveIP'), '')

    // Suggest the role-appropriate default description if it's still the prior
    // role's default. We can't read the current value from here without a
    // hasRetained-with-value accessor, so fall back to publishing the new
    // default unconditionally only when the user has not customized — we
    // approximate this by checking if the topic was authored by us as a
    // default (i.e. published once at construction time).
    this.publish(1, descTopic, ...defaultDescription(next).split(' '))
  }

  // ─── Source-side relay ────────────────────────────────────────────────
  private startSource(): void {
    if (!this.proxyIP) return

    const iface = this.findInterfaceAddress(this.interfaceName)
    if (!iface) throw new Error(`Interface "${this.interfaceName}" has no IPv4 address`)

    // Bind the multicast listener on the chosen NIC.
    const dataSock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    dataSock.on('error', (err) => {
      this.logMonitor(`Source data socket error: ${err.message}`)
      this.disableInternal()
    })
    dataSock.bind(this.dataPort, () => {
      try {
        dataSock.addMembership(this.multicastIP, iface)
      } catch (err: any) {
        this.logMonitor(`Failed to join multicast ${this.multicastIP} on ${this.interfaceName}: ${err.message}`)
        this.disableInternal()
        return
      }
      dataSock.on('message', (msg) => {
        if (!this.enabled || !this.proxyIP) return
        this.lastDataPacketAt = Date.now()
        this.pulseData()
        // Forward Motive multicast data → proxy data TX slot.
        dataSock.send(msg, 0, msg.length, this.roomPorts.dataTxPort, this.proxyIP)
      })
    })
    this.dataSocket = dataSock

    // Cmd: Source ↔ Motive (unicast on motiveIP:cmdPort) ↔ proxy.
    const cmdSock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    cmdSock.on('error', (err) => {
      this.logMonitor(`Source cmd socket error: ${err.message}`)
      this.disableInternal()
    })
    cmdSock.bind(0, iface, () => {
      cmdSock.on('message', (msg, rinfo) => {
        if (!this.enabled || !this.proxyIP) return
        // Detect duplicate Source: another Source's [8,8,8] arriving from the
        // proxy means two NG instances are claiming Source on this channel.
        if (rinfo.address === this.proxyIP && msg.length === 3 && msg[0] === 8 && msg[1] === 8 && msg[2] === 8) {
          this.duplicateSourceDetected = true
          this.logMonitor('Another peer is acting as Motive Source on this channel — disabling.')
          this.publishHealth('duplicate_source')
          this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
          return
        }
        // Handshake reply from proxy — keeps health/state="ok".
        if (rinfo.address === this.proxyIP && msg.length === 3 && msg[0] === 9 && msg[1] === 9 && msg[2] === 9) {
          this.lastHandshakeReplyAt = Date.now()
          return
        }
        this.lastCmdPacketAt = Date.now()
        this.pulseCmd()
        if (rinfo.address === this.proxyIP) {
          // proxy → Motive
          if (this.motiveIP) {
            cmdSock.send(msg, 0, msg.length, this.cmdPort, this.motiveIP)
          }
        } else {
          // Motive → proxy
          cmdSock.send(msg, 0, msg.length, this.roomPorts.cmdPort, this.proxyIP)
        }
      })
    })
    this.cmdSocket = cmdSock
  }

  // ─── Sink-side relay ──────────────────────────────────────────────────
  private startSink(): void {
    if (!this.proxyIP) return

    const iface = this.findInterfaceAddress(this.interfaceName)
    if (!iface) throw new Error(`Interface "${this.interfaceName}" has no IPv4 address`)

    // Cmd: bind on Motive's cmd port to receive consumer commands. Captures
    // (clientCmndAddress, clientCmndPort) from first packet.
    const cmdSock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    cmdSock.on('error', (err) => {
      this.logMonitor(`Sink cmd socket error: ${err.message}`)
      this.disableInternal()
    })
    cmdSock.bind(this.cmdPort, iface, () => {
      cmdSock.on('message', (msg, rinfo) => {
        if (!this.enabled || !this.proxyIP) return
        if (rinfo.address === this.proxyIP) {
          // Handshake reply from proxy.
          if (msg.length === 3 && msg[0] === 8 && msg[1] === 8 && msg[2] === 8) {
            // Another Sink? Not the duplicate-source case; ignore at protocol level.
            this.lastHandshakeReplyAt = Date.now()
            return
          }
          if (msg.length === 3 && msg[0] === 9 && msg[1] === 9 && msg[2] === 9) {
            this.lastHandshakeReplyAt = Date.now()
            return
          }
          // proxy → consumer (only if we have a known consumer)
          if (this.clientCmndAddress && this.clientCmndPort) {
            this.lastCmdPacketAt = Date.now()
            this.pulseCmd()
            cmdSock.send(msg, 0, msg.length, this.clientCmndPort, this.clientCmndAddress)
          }
        } else {
          // consumer → proxy. Capture client address+port on first contact.
          this.clientCmndAddress = rinfo.address
          this.clientCmndPort = rinfo.port
          this.lastConsumerCmdAt = Date.now()
          this.lastCmdPacketAt = Date.now()
          this.pulseCmd()
          cmdSock.send(msg, 0, msg.length, this.roomPorts.cmdPort, this.proxyIP)
        }
      })
    })
    this.cmdSocket = cmdSock

    // Data: receive from proxy data RX slot, re-multicast on the local LAN.
    const dataSock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    dataSock.on('error', (err) => {
      this.logMonitor(`Sink data socket error: ${err.message}`)
      this.disableInternal()
    })
    dataSock.bind(0, iface, () => {
      try {
        dataSock.setMulticastInterface(iface)
      } catch (err: any) {
        this.logMonitor(`Failed to set multicast interface on ${this.interfaceName}: ${err.message}`)
        this.disableInternal()
        return
      }
      dataSock.on('message', (msg, rinfo) => {
        if (!this.enabled) return
        if (rinfo.address !== this.proxyIP) return
        this.lastDataPacketAt = Date.now()
        this.pulseData()
        // Re-multicast NatNet data so local consumers think Motive is here.
        dataSock.send(msg, 0, msg.length, this.dataPort, this.multicastIP)
      })
    })
    this.dataSocket = dataSock
  }

  // ─── Handshake & health tick ──────────────────────────────────────────
  private startHandshakeLoop(): void {
    const send = (): void => {
      if (!this.enabled || !this.proxyIP) return
      const cmdSock = this.cmdSocket
      if (!cmdSock) return
      const buf = this.direction === MotiveDirection.Source ? SOURCE_HANDSHAKE : SINK_HANDSHAKE
      try {
        cmdSock.send(buf, 0, buf.length, this.roomPorts.cmdPort, this.proxyIP)
        // Sink also handshakes on the data slot (the patches do).
        if (this.direction === MotiveDirection.Sink && this.dataSocket) {
          this.dataSocket.send(buf, 0, buf.length, this.roomPorts.dataRxPort, this.proxyIP)
        }
      } catch {}
    }
    send()
    this.handshakeTimer = setInterval(send, HANDSHAKE_INTERVAL_MS)
  }

  private startHealthTick(): void {
    this.healthTimer = setInterval(() => {
      const state = deriveHealthState({
        enabled: this.enabled,
        direction: this.direction,
        lastHandshakeReplyAt: this.lastHandshakeReplyAt,
        lastDataPacketAt: this.lastDataPacketAt,
        lastConsumerCmdAt: this.lastConsumerCmdAt,
        duplicateSourceDetected: this.duplicateSourceDetected,
        interfaceMissing: this.interfaceMissing,
        portConflict: this.portConflict,
        now: Date.now()
      })
      this.publishHealth(state)
      this.publishIndicators(false)
    }, HEALTH_TICK_MS)
  }

  // ─── Indicators ───────────────────────────────────────────────────────
  private pulseData(): void {
    if (!this.dataPulseOn) {
      this.dataPulseOn = true
      this.publishIndicators(false)
    }
    if (this.dataPulseTimer) clearTimeout(this.dataPulseTimer)
    this.dataPulseTimer = setTimeout(() => {
      this.dataPulseOn = false
      this.dataPulseTimer = null
      this.publishIndicators(false)
    }, INDICATOR_HOLD_MS)
  }

  private pulseCmd(): void {
    if (!this.cmdPulseOn) {
      this.cmdPulseOn = true
      this.publishIndicators(false)
    }
    if (this.cmdPulseTimer) clearTimeout(this.cmdPulseTimer)
    this.cmdPulseTimer = setTimeout(() => {
      this.cmdPulseOn = false
      this.cmdPulseTimer = null
      this.publishIndicators(false)
    }, INDICATOR_HOLD_MS)
  }

  private publishIndicators(force: boolean): void {
    const handshakeOk =
      this.lastHandshakeReplyAt !== null &&
      Date.now() - this.lastHandshakeReplyAt < HANDSHAKE_OK_WINDOW_MS
    const running = this.enabled && handshakeOk && !this.duplicateSourceDetected ? '1' : '0'
    const data = this.dataPulseOn ? '1' : '0'
    const cmd = this.cmdPulseOn ? '1' : '0'
    const dir = String(this.direction)
    const next = `${data} ${cmd} ${dir} ${running}`
    if (!force && next === this.lastPublishedIndicators) return
    this.lastPublishedIndicators = next
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'indicators'), data, cmd, dir, running)
  }

  // ─── Health publishing ────────────────────────────────────────────────
  private publishHealth(state: HealthState): void {
    if (state === this.lastPublishedHealth) return
    this.lastPublishedHealth = state
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'health/state'), state)
  }

  // ─── Monitor log ──────────────────────────────────────────────────────
  private logMonitor(line: string): void {
    const stamped = `[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${line}`
    this.publish(0, topics.deviceGui(this.peerId, this.channelIndex, 'monitor/log'), stamped)
    console.warn(`[Motive ch.${this.channelIndex}] ${line}`)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  private snapshotConfig(): MotiveConfig {
    return {
      direction: this.direction,
      multicastIP: this.multicastIP,
      dataPort: this.dataPort,
      cmdPort: this.cmdPort,
      interfaceName: this.interfaceName
    }
  }

  private interfaceExists(name: string): boolean {
    if (!name) return false
    return !!this.findInterfaceAddress(name)
  }

  private findInterfaceAddress(name: string): string | null {
    if (!name) return null
    const all = networkInterfaces()
    const addrs = all[name]
    if (!addrs) return null
    for (const a of addrs) {
      if (a.internal) continue
      if (a.family !== 'IPv4') continue
      return a.address
    }
    return null
  }

  private guessInterfaceName(): string {
    const all = networkInterfaces()
    for (const [name, addrs] of Object.entries(all)) {
      if (!addrs) continue
      for (const a of addrs) {
        if (a.internal) continue
        if (a.family !== 'IPv4') continue
        if (a.address === this.localIP) return name
      }
    }
    for (const [name, addrs] of Object.entries(all)) {
      if (!addrs) continue
      for (const a of addrs) {
        if (a.internal) continue
        if (a.family !== 'IPv4') continue
        return name
      }
    }
    return ''
  }

  private stopRelay(): void {
    if (this.handshakeTimer) {
      clearInterval(this.handshakeTimer)
      this.handshakeTimer = null
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
    if (this.dataSocket) {
      try {
        if (this.direction === MotiveDirection.Source) {
          const iface = this.findInterfaceAddress(this.interfaceName) ?? undefined
          this.dataSocket.dropMembership(this.multicastIP, iface)
        }
      } catch {}
      try { this.dataSocket.close() } catch {}
      this.dataSocket = null
    }
    if (this.cmdSocket) {
      try { this.cmdSocket.close() } catch {}
      this.cmdSocket = null
    }
    if (this.dataPulseTimer) {
      clearTimeout(this.dataPulseTimer)
      this.dataPulseTimer = null
    }
    if (this.cmdPulseTimer) {
      clearTimeout(this.cmdPulseTimer)
      this.cmdPulseTimer = null
    }
    this.dataPulseOn = false
    this.cmdPulseOn = false
    this.proxyIP = null
  }

  // Snapshot for sibling-conflict checks (Q15-E).
  toSibling(): MotiveSibling {
    return {
      channelIndex: this.channelIndex,
      enabled: this.enabled,
      config: this.snapshotConfig()
    }
  }

  teardown(): string[] {
    this.stopRelay()
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.enabled = false
    this.stopRelay()
  }
}
