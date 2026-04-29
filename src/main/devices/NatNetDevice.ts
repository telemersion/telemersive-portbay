import { topics } from '../../shared/topics'
import { allocateMocapLocalPorts, allocateMocapRoomPorts, type MocapPorts } from '../portAllocator'
import type { DeviceHandler } from './types'

type PublishFn = (retained: 0 | 1, topic: string, value: string) => void
type HasRetainedFn = (topic: string) => boolean

// direction/select values observed in Max dropdown:
//   0 = send to router          (requires NatNetThree2OSC CLI — Windows only)
//   1 = send to local           (requires NatNetThree2OSC CLI — Windows only)
//   2 = receive from router     (pure OSC relay — cross-platform)
export const enum Direction {
  SendToRouter = 0,
  SendToLocal = 1,
  ReceiveFromRouter = 2
}

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
  private localPorts: MocapPorts
  private roomPorts: MocapPorts
  private publishedTopics: string[] = []
  private publish: PublishFn
  private hasRetained: HasRetainedFn

  private enabled = false
  private enableTwo = false
  private direction: number = Direction.ReceiveFromRouter
  private enableNatNet = false
  private outputIPOne: string
  private outputIPTwo: string
  private listeningIP: string

  constructor(
    channelIndex: number,
    peerId: string,
    localIP: string,
    roomId: number,
    publish: PublishFn,
    hasRetained: HasRetainedFn = () => false
  ) {
    this.channelIndex = channelIndex
    this.peerId = peerId
    this.localIP = localIP
    this.localPorts = allocateMocapLocalPorts(channelIndex)
    this.roomPorts = allocateMocapRoomPorts(roomId, channelIndex)
    this.publish = publish
    this.hasRetained = hasRetained
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
      this.publish(1, topic, value)
    }

    pub('direction/select', String(Direction.ReceiveFromRouter))
    pub('direction/enableNatNet', '0')

    pub('localudp/inputPort', String(this.localPorts.inputPort))
    pub('localudp/listeningIP', this.localIP)
    pub('localudp/outputIPOne', this.localIP)
    pub('localudp/outputIPTwo', this.localIP)
    pub('localudp/outputPortOne', String(this.localPorts.outputPortOne))
    pub('localudp/outputPortTwo', String(this.localPorts.outputPortTwo))
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
        this.enableNatNet = value === '1'
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
    this.localPorts = allocateMocapLocalPorts(this.channelIndex)
    this.outputIPOne = this.localIP
    this.outputIPTwo = this.localIP
    this.listeningIP = this.localIP
    this.enableTwo = false
    this.emitDefaults(true)
  }

  private handleEnable(enable: boolean): void {
    if (enable === this.enabled) return
    this.enabled = enable
    if (enable) {
      // Stage 2 will wire the actual behavior:
      //   - direction = ReceiveFromRouter → UDP relay (cross-platform)
      //   - direction = SendToRouter/SendToLocal → spawn NatNetThree2OSC (Windows only)
      const mode = this.direction === Direction.ReceiveFromRouter ? 'receive-from-router'
        : this.direction === Direction.SendToLocal ? 'send-to-local' : 'send-to-router'
      console.log(`[NatNet ch.${this.channelIndex}] enable=1 (direction=${mode}) — handler not implemented yet`)
      // Echo back disable until the behavior is wired — prevents a stuck "on" state with no actual relay.
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
      this.enabled = false
    } else {
      console.log(`[NatNet ch.${this.channelIndex}] enable=0`)
    }
  }

  teardown(): string[] {
    return [...this.publishedTopics]
  }

  destroy(): void {
    this.enabled = false
  }
}
