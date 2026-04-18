import * as dgram from 'dgram'
import { topics } from '../../shared/topics'
import { allocateLocalPorts, allocateRoomPorts, type OscPorts } from '../portAllocator'
import type { DeviceHandler } from './types'

type PublishFn = (retained: 0 | 1, topic: string, value: string) => void

export class OscDevice implements DeviceHandler {
  readonly channelIndex: number
  readonly deviceType: number
  private peerId: string
  private localIP: string
  private localPorts: OscPorts
  private roomPorts: OscPorts
  private publishedTopics: string[] = []
  private publish: PublishFn

  private enabled = false
  private enableTwo = false
  private outputIPOne: string
  private outputIPTwo: string

  // local→room: binds on local inputPort, forwards to room proxy inputPort
  private sendSocket: dgram.Socket | null = null
  // room→local: binds on room outputPortOne, forwards to local outputPortOne/Two
  private recvSocket: dgram.Socket | null = null

  private _isRunning = false
  get isRunning(): boolean { return this._isRunning }

  constructor(
    channelIndex: number,
    peerId: string,
    localIP: string,
    roomId: number,
    publish: PublishFn,
    deviceType: number = 1
  ) {
    this.channelIndex = channelIndex
    this.deviceType = deviceType
    this.peerId = peerId
    this.localIP = localIP
    this.localPorts = allocateLocalPorts(channelIndex)
    this.roomPorts = allocateRoomPorts(roomId, channelIndex)
    this.publish = publish
    this.outputIPOne = localIP
    this.outputIPTwo = localIP
  }

  publishDefaults(): void {
    const pub = (field: string, value: string) => {
      const topic = this.isLocaludp(field)
        ? topics.localudp(this.peerId, this.channelIndex, field)
        : this.isMonitor(field)
          ? topics.monitor(this.peerId, this.channelIndex, field)
          : topics.deviceGui(this.peerId, this.channelIndex, field)

      this.publishedTopics.push(topic)
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
        this.outputIPOne = value
        break
      case 'gui/localudp/outputIPTwo':
        this.outputIPTwo = value
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
          // Reset to defaults — deferred
        }
        break
    }
  }

  private handleEnable(enable: boolean): void {
    if (enable && !this.enabled) {
      this.enabled = true
      this.startRelay()
    } else if (!enable && this.enabled) {
      this.enabled = false
      this.stopRelay()
    }
  }

  private startRelay(): void {
    try {
      // Send socket: local app sends OSC to local inputPort → we forward to room proxy
      this.sendSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      this.sendSocket.on('message', (msg) => {
        // Forward to room proxy input port
        this.sendSocket!.send(msg, 0, msg.length, this.roomPorts.inputPort, this.localIP)
      })
      this.sendSocket.bind(this.localPorts.inputPort, this.localIP)
      this.sendSocket.on('error', (err) => {
        console.error(`[OSC ch.${this.channelIndex}] send socket error:`, err.message)
        this.disableOnError()
      })

      // Receive socket: room proxy sends to room outputPortOne → we forward to local app
      this.recvSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      this.recvSocket.on('message', (msg) => {
        // Forward to local output port(s)
        this.recvSocket!.send(msg, 0, msg.length, this.localPorts.outputPortOne, this.outputIPOne)
        if (this.enableTwo) {
          this.recvSocket!.send(msg, 0, msg.length, this.localPorts.outputPortTwo, this.outputIPTwo)
        }
      })
      this.recvSocket.bind(this.roomPorts.outputPortOne, this.localIP, () => {
        this._isRunning = true
      })
      this.recvSocket.on('error', (err) => {
        console.error(`[OSC ch.${this.channelIndex}] recv socket error:`, err.message)
        this.disableOnError()
      })
    } catch (err: any) {
      console.error(`[OSC ch.${this.channelIndex}] failed to start relay:`, err.message)
      this.disableOnError()
    }
  }

  private disableOnError(): void {
    this.stopRelay()
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, 'enable'), '0')
  }

  private stopRelay(): void {
    if (this.sendSocket) {
      try { this.sendSocket.close() } catch {}
      this.sendSocket = null
    }
    if (this.recvSocket) {
      try { this.recvSocket.close() } catch {}
      this.recvSocket = null
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
