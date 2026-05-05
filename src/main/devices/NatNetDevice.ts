import * as dgram from 'dgram'
import * as dns from 'dns'
import { promisify } from 'util'
import { topics } from '../../shared/topics'
import { allocateMocapLocalPorts, allocateMocapRoomPorts, type MocapPorts } from '../portAllocator'
import { ChildProcessLifecycle, type LifecycleOptions, type ExitReason } from './ChildProcessLifecycle'
import { MonitorLogBuffer } from './ultragrid/monitorLog'
import type { DeviceHandler } from './types'

const dnsLookup = promisify(dns.lookup)

type PublishFn = (retained: 0 | 1, topic: string, ...values: string[]) => void
type HasRetainedFn = (topic: string) => boolean
type SpawnFactory = (opts: LifecycleOptions) => ChildProcessLifecycle

// direction/select values (confirmed from Max dropdown):
//   1 = send to router          (requires NatNetFour2OSC CLI)
//   2 = receive from router     (pure OSC relay — no CLI needed)
//   4 = send to local           (requires NatNetFour2OSC CLI)
export const enum Direction {
  SendToRouter = 1,
  ReceiveFromRouter = 2,
  SendToLocal = 4
}

// Heartbeat packet sent by sink-clients to the proxy's many_port to register/stay alive.
// OSC message "/hb" with no args: bytes [47,104,98,0, 44,0,0,0]
const HEARTBEAT = Buffer.from([47, 104, 98, 0, 44, 0, 0, 0])
const HEARTBEAT_INTERVAL_MS = 5000

const MONITOR_LOG_CAPACITY = 200

function localOsTag(): string {
  if (process.platform === 'darwin') return 'osx'
  if (process.platform === 'win32') return 'windows'
  return process.platform
}

export interface NatNetDeviceOptions {
  channelIndex: number
  peerId: string
  localIP: string
  roomId: number
  publish: PublishFn
  hasRetained?: HasRetainedFn
  brokerHost?: string
  resolveBinary?: () => string | null
  spawnFactory?: SpawnFactory
}

// Stored natnet/* config values — used to build CLI args at spawn time.
interface NatNetCliConfig {
  defaultLocalIP: string
  autoReconnect: string
  bundled: string
  cmdPort: string
  codec: string
  dataPort: string
  frameModulo: string
  invmatrix: string
  leftHanded: string
  matrix: string
  motiveIP: string
  multicastIP: string
  sendMarkerInfos: string
  sendOtherMarkerInfos: string
  sendSkeletons: string
  verbose: string
  yUp2zUp: string
}

function defaultCliConfig(localIP: string): NatNetCliConfig {
  return {
    defaultLocalIP: '0',
    autoReconnect: '0',
    bundled: '0',
    cmdPort: '1510',
    codec: '3',
    dataPort: '1511',
    frameModulo: '1',
    invmatrix: '0',
    leftHanded: '0',
    matrix: '0',
    motiveIP: localIP,
    multicastIP: '239.255.42.99',
    sendMarkerInfos: '0',
    sendOtherMarkerInfos: '0',
    sendSkeletons: '0',
    verbose: '0',
    yUp2zUp: '0',
  }
}

// Build NatNetFour2OSC (v1.2.0) CLI args from stored config + port/IP targets.
// Flag names verified against NatNetFour2OSC v1.2.0 --help output.
// Note: the Max topic field names don't map 1:1 to flag names — see comments.
function buildNatNetArgs(
  cfg: NatNetCliConfig,
  localIP: string,   // this machine's IP  → --localIP (required)
  oscSendIP: string, // OSC destination IP → --oscSendIP (required)
  oscSendPort: number // OSC destination port → --oscSendPort (required)
): string[] {
  const args: string[] = []

  // Required flags.
  args.push('--localIP', localIP)
  args.push('--motiveIP', cfg.motiveIP)
  args.push('--oscSendIP', oscSendIP)
  args.push('--oscSendPort', String(oscSendPort))
  // v1.2.0 has a parser bug: it fails to deserialize the default value for
  // --oscMode unless it's passed explicitly on the command line.
  args.push('--oscMode', 'max')

  // Optional flags with non-default values.
  if (cfg.multicastIP && cfg.multicastIP !== '239.255.42.99') {
    args.push('--multiCastIP', cfg.multicastIP)   // capital C per CLI help
  }
  if (cfg.dataPort && cfg.dataPort !== '1511') {
    args.push('--motiveDataPort', cfg.dataPort)
  }
  if (cfg.cmdPort && cfg.cmdPort !== '1510') {
    args.push('--motiveCmdPort', cfg.cmdPort)
  }
  if (cfg.frameModulo && cfg.frameModulo !== '1') {
    args.push('--frameModulo', cfg.frameModulo)
  }

  // Boolean flags — only emitted when enabled (value '1').
  if (cfg.autoReconnect === '1') args.push('--autoReconnect')
  if (cfg.bundled === '1') args.push('--bundled')
  if (cfg.invmatrix === '1') args.push('--invMatrix')      // capital M per CLI help
  if (cfg.leftHanded === '1') args.push('--leftHanded')
  if (cfg.matrix === '1') args.push('--matrix')
  if (cfg.sendMarkerInfos === '1') args.push('--sendMarkerInfo')   // no trailing s
  if (cfg.sendOtherMarkerInfos === '1') args.push('--sendOtherMarkerInfo') // no trailing s
  if (cfg.sendSkeletons === '1') args.push('--sendSkeletons')
  if (cfg.verbose === '1') args.push('--verbose')
  if (cfg.yUp2zUp === '1') args.push('--yup2zup')          // all lowercase per CLI help

  return args
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
  private resolveBinary: () => string | null
  private spawnFactory: SpawnFactory

  private enabled = false
  private enableTwo = false
  private direction: number = Direction.ReceiveFromRouter
  // Local forwarding targets — where received packets are forwarded on this machine.
  private outputPortOne: number
  private outputPortTwo: number
  private outputIPOne: string
  private outputIPTwo: string
  private listeningIP: string

  // Stored natnet/* config (CLI args built from these at spawn time).
  private cliConfig: NatNetCliConfig

  // Receive-from-router relay state (direction = 2).
  private socket: dgram.Socket | null = null
  private proxyIP: string | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  // CLI process state (directions 1 and 4).
  private lifecycle: ChildProcessLifecycle | null = null
  private readonly monitor = new MonitorLogBuffer(MONITOR_LOG_CAPACITY)
  private monitorGateOn = false

  // Indicator slots: {input} {output} {running}
  private minorIndicatorOn = false
  private minorIndicatorTimer: NodeJS.Timeout | null = null
  private runningIndicatorOn = false
  private static readonly INDICATOR_HOLD_MS = 150

  constructor(opts: NatNetDeviceOptions) {
    this.channelIndex = opts.channelIndex
    this.peerId = opts.peerId
    this.localIP = opts.localIP
    this.brokerHost = opts.brokerHost ?? 'telemersion.zhdk.ch'
    this.localPorts = allocateMocapLocalPorts(opts.channelIndex)
    this.roomPorts = allocateMocapRoomPorts(opts.roomId, opts.channelIndex)
    this.publish = opts.publish
    this.hasRetained = opts.hasRetained ?? (() => false)
    this.resolveBinary = opts.resolveBinary ?? (() => null)
    this.spawnFactory = opts.spawnFactory ?? ((o) => new ChildProcessLifecycle(o))
    this.outputPortOne = this.localPorts.inputPort
    this.outputPortTwo = this.localPorts.inputPort
    this.outputIPOne = opts.localIP
    this.outputIPTwo = opts.localIP
    this.listeningIP = opts.localIP
    this.cliConfig = defaultCliConfig(opts.localIP)
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

    // NatNet CLI parameters — used when direction = SendToRouter/SendToLocal.
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
      case 'gui/direction/select': {
        const d = parseInt(value, 10) || 0
        this.direction = d
        // Re-publish ports when switching modes so the panel shows correct values.
        // CLI modes: outputPortOne defaults to base+0 (--oscSendPort), inputPort is base+2.
        // ReceiveFromRouter: restore the relay ports.
        if (d === Direction.SendToLocal || d === Direction.SendToRouter) {
          this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'localudp/outputPortOne'), String(this.localPorts.outputPort))
          this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'localudp/inputPort'), String(this.localPorts.outputPort + 2))
        } else {
          this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'localudp/outputPortOne'), String(this.outputPortOne))
          this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'localudp/inputPort'), String(this.localPorts.inputPort))
        }
        break
      }
      case 'gui/direction/enableNatNet':
        // stored for future use
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
      case 'gui/monitor/monitorGate':
        this.handleMonitorGate(value === '1')
        break
      case 'gui/monitor/log':
        break
      default:
        this.handleNatNetConfig(subpath, value)
        break
    }
  }

  private handleNatNetConfig(subpath: string, value: string): void {
    if (!subpath.startsWith('gui/natnet/')) return
    const key = subpath.slice('gui/natnet/'.length) as keyof NatNetCliConfig
    if (key in this.cliConfig) {
      this.cliConfig = { ...this.cliConfig, [key]: value }
    }
  }

  private handleMonitorGate(on: boolean): void {
    if (on === this.monitorGateOn) return
    this.monitorGateOn = on
    if (on) this.replayMonitorLog()
  }

  private resetToDefaults(): void {
    this.localPorts = allocateMocapLocalPorts(this.channelIndex)
    this.outputPortOne = this.localPorts.inputPort
    this.outputPortTwo = this.localPorts.inputPort
    this.outputIPOne = this.localIP
    this.outputIPTwo = this.localIP
    this.listeningIP = this.localIP
    this.enableTwo = false
    this.cliConfig = defaultCliConfig(this.localIP)
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
      if (this.direction === Direction.SendToLocal || this.direction === Direction.SendToRouter) {
        this.enabled = true
        this.startCliProcess()
        return
      }
      // Unknown direction — refuse silently.
      console.warn(`[NatNet ch.${this.channelIndex}] unknown direction ${this.direction}; ignoring enable`)
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      return
    }
    this.enabled = false
    this.stopReceiveRelay()
    this.stopCliProcess()
    console.log(`[NatNet ch.${this.channelIndex}] enable=0`)
  }

  // -------------------------------------------------------------------------
  // Direction = 4 (SendToLocal) / 1 (SendToRouter) — NatNetFour2OSC CLI
  // -------------------------------------------------------------------------

  private startCliProcess(): void {
    const binary = this.resolveBinary()
    if (!binary) {
      this.logWarn('NatNetFour2OSC binary not found — check Settings')
      this.publishEnableOff()
      this.enabled = false
      return
    }

    // --oscSendIP/Port: where the CLI sends OSC data.
    // SendToLocal: user-configured IP (listeningIP) and port (outputPortOne, default base+0).
    // SendToRouter: proxy host and room output port (fixed, not user-configurable).
    const outputIP = this.direction === Direction.SendToRouter
      ? this.brokerHost
      : this.listeningIP
    const outputPort = this.direction === Direction.SendToRouter
      ? this.roomPorts.outputPort
      : this.outputPortOne

    const args = buildNatNetArgs(this.cliConfig, this.listeningIP, outputIP, outputPort)

    this.monitor.clear()
    const cliLine = `${binary} ${args.join(' ')}`
    console.log(`[NatNet ch.${this.channelIndex}] spawn: ${cliLine}`)
    const cliLogLine = `[CLI] ${cliLine}`
    this.monitor.append(cliLogLine)
    if (this.monitorGateOn) this.publishMonitorLine(cliLogLine)

    this.lifecycle = this.spawnFactory({
      binary,
      args,
      onStdout: (line) => this.handleLogLine(line),
      onStderr: (line) => this.handleLogLine(line),
      onExit: (reason, code) => this.handleCliExit(reason, code)
    })
    this.lifecycle.start()

    this.setRunningIndicator(true)
  }

  private stopCliProcess(): void {
    this.lifecycle?.stop()
    this.lifecycle = null
    this.setRunningIndicator(false)
  }

  private handleLogLine(line: string): void {
    this.monitor.append(line)
    if (this.monitorGateOn) this.publishMonitorLine(line)
    if (line.includes('Program terminated')) {
      this.logWarn('NatNet reported "Program terminated"; disabling')
      this.enabled = false
      this.stopCliProcess()
      this.publishEnableOff()
    }
  }

  private publishMonitorLine(line: string): void {
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'monitor/log'), line)
  }

  private replayMonitorLog(): void {
    for (const line of this.monitor.replay()) {
      this.publishMonitorLine(line)
    }
  }

  private handleCliExit(reason: ExitReason, code: number | null): void {
    this.lifecycle = null
    this.setRunningIndicator(false)
    if (reason === 'killed') return
    const label = reason === 'spawn-failure' ? 'NatNet spawn-failure' : 'NatNet crashed'
    this.logWarn(`${label} (code ${code}); disabling`)
    this.enabled = false
    this.publishEnableOff()
  }

  private logWarn(message: string): void {
    const line = `[NG] ${message}`
    this.monitor.append(line)
    if (this.monitorGateOn) this.publishMonitorLine(line)
    console.warn(`[NatNet ch.${this.channelIndex}] ${message}`)
  }

  private publishEnableOff(): void {
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  // -------------------------------------------------------------------------
  // Direction = 2 (ReceiveFromRouter) — pure UDP relay
  // -------------------------------------------------------------------------

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

  private setRunningIndicator(on: boolean): void {
    if (on === this.runningIndicatorOn) return
    this.runningIndicatorOn = on
    this.publishIndicators()
  }

  private publishIndicators(): void {
    const minor = this.minorIndicatorOn ? '1' : '0'
    const running = this.runningIndicatorOn ? '1' : '0'
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'indicators'), '0', minor, running)
  }

  private disableOnError(): void {
    this.stopReceiveRelay()
    this.enabled = false
    this.publishEnableOff()
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
    this.stopCliProcess()
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.enabled = false
    this.stopReceiveRelay()
    this.stopCliProcess()
  }
}
