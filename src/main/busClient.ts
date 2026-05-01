import { EventEmitter } from 'events'
import type { BrokerConfig, RemotePeerInfo } from '../shared/types'
import { logEvent } from './logBus'

const APPVERSION = 'TeGateway_v0612'

let BusClientClass: any
try {
  const telemersion = require('telemersive-bus')
  BusClientClass = telemersion.BusClient
} catch (err) {
  console.error('Failed to load telemersive-bus:', err)
}

export class TBusClient extends EventEmitter {
  private client: any

  constructor() {
    super()
    if (!BusClientClass) {
      throw new Error('telemersive-bus module not available')
    }
    this.client = new BusClientClass(APPVERSION)
    this.client.setCallback((message: string, content: any[]) => {
      this.handleCallback(message, content)
    })
  }

  get peerId(): string {
    return this.client.peerId
  }

  async init(): Promise<Record<string, string>> {
    return this.client.init()
  }

  configure(config: BrokerConfig): void {
    const brokerUrl = 'mqtt://' + config.host
    this.client.configureServer(brokerUrl, config.port, config.username, config.password, config.localIP)
  }

  connect(): void {
    this.client.connectServer()
  }

  disconnect(): void {
    this.client.disconnectServer()
  }

  join(peerName: string, roomName: string, roomPwd: string): void {
    this.client.join(peerName, roomName, roomPwd)
  }

  leave(): void {
    this.client.leave()
  }

  publish(retained: 0 | 1, topic: string, ...values: any[]): void {
    this.client.peer.mqttClient.publish(retained, topic, values)
  }

  subscribe(topic: string): void {
    this.client.peer.mqttClient.subscribe(topic)
    logEvent({ kind: 'sub', topic })
  }

  unsubscribe(topic: string): void {
    this.client.peer.mqttClient.unsubscribe(topic)
    logEvent({ kind: 'unsub', topic })
  }

  private handleCallback(message: string, content: any[]): void {
    if (message === 'bus') {
      this.parseBusEvent(content)
    } else if (message === 'mqtt') {
      const [topic, ...rest] = content
      const payload = rest.join(' ')
      logEvent({ kind: 'recv', topic, value: payload })
      this.emit('mqtt:message', { topic, payload })
    } else if (message === 'chat') {
      this.emit('chat', content)
    }
  }

  private parseBusEvent(content: any[]): void {
    if (content.length === 0) return

    // Observed bus event content arrays:
    //   ['broker', 'connected', 0|1]
    //   ['peer', 'joined', 0|1]
    //   ['peer', 'id'|'name'|'localIP'|'publicIP', value]
    //   ['peer', 'room', 'name'|'id'|'uuid', value]
    //   ['peers', 'remote', 'joined', name, id, localIP, publicIP]
    //   ['peers', 'remote', 'left', name, id]
    //   ['peers', 'menu', 'clear']
    //   ['peers', 'menu', 'append', name, id, localIP, publicIP]
    //   ['peers', 'done']
    //   ['rooms', 'menu', 'clear']
    //   ['rooms', 'menu', 'append', roomName]
    //   ['rooms', 'listing', roomName]
    //   ['rooms', 'done']
    //   ['ready']

    const c = content

    if (c[0] === 'error') {
      // ['error', scope, message] — scope is 'broker' or 'peer'.
      const scope = String(c[1] ?? 'unknown')
      const message = typeof c[2] === 'string' ? c[2] : JSON.stringify(c[2])
      this.emit('bus:error', { scope, message })
      return
    }

    if (c[0] === 'broker' && c[1] === 'connected') {
      this.emit('broker:connected', c[2] === 1)
      return
    }

    if (c[0] === 'peer') {
      switch (c[1]) {
        case 'joined': this.emit('peer:joined', c[2] === 1); break
        case 'id': this.emit('peer:id', String(c[2])); break
        case 'name': this.emit('peer:name', String(c[2])); break
        case 'localIP': this.emit('peer:localIP', String(c[2])); break
        case 'publicIP': this.emit('peer:publicIP', String(c[2])); break
        case 'room':
          if (c[2] === 'name') this.emit('peer:room:name', String(c[3]))
          else if (c[2] === 'id') this.emit('peer:room:id', Number(c[3]))
          else if (c[2] === 'uuid') this.emit('peer:room:uuid', String(c[3]))
          break
      }
      return
    }

    if (c[0] === 'peers') {
      if (c[1] === 'remote') {
        if (c[2] === 'joined') {
          const info: RemotePeerInfo = {
            peerName: String(c[3]),
            peerId: String(c[4]),
            localIP: String(c[5]),
            publicIP: String(c[6])
          }
          this.emit('peers:remote:joined', info)
        } else if (c[2] === 'left') {
          this.emit('peers:remote:left', { peerName: String(c[3]), peerId: String(c[4]) })
        }
      } else if (c[1] === 'menu') {
        if (c[2] === 'clear') this.emit('peers:clear')
        else if (c[2] === 'append') {
          const info: RemotePeerInfo = {
            peerName: String(c[3]),
            peerId: String(c[4]),
            localIP: String(c[5]),
            publicIP: String(c[6])
          }
          this.emit('peers:append', info)
        }
      } else if (c[1] === 'done') {
        this.emit('peers:done')
      }
      return
    }

    if (c[0] === 'rooms') {
      if (c[1] === 'menu') {
        if (c[2] === 'clear') this.emit('rooms:clear')
        else if (c[2] === 'append') this.emit('rooms:append', String(c[3]))
      } else if (c[1] === 'listing') {
        this.emit('rooms:listing', c.length > 2 ? String(c[2]) : null)
      } else if (c[1] === 'done') {
        this.emit('rooms:done')
      }
      return
    }

    if (c[0] === 'ready') {
      this.emit('ready')
      return
    }
  }
}
