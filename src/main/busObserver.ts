import { connect, type MqttClient } from 'mqtt'
import type { BrokerConfig } from '../shared/types'
import { logEvent } from './logBus'
import { classifyBusTopic, describeBusMessage } from './busTap'

// Read-only view of the manager's activity in *other* rooms: housekeeping pings
// and peers joining/leaving, everything the broker ACL lets the shared `peer`
// account read. Room creation/removal (tBus/rooms/+/info) is already received
// for all rooms by the bus client itself.
//
// This deliberately uses its own MQTT connection. Subscribing these wildcards
// on the bus client's connection would overlap the library's own-room
// subscriptions; a broker that delivers overlapping matches twice would make
// the library answer a housekeeping ping twice, and the manager rejects the
// second answer with "not joined anymore" — kicking us out of the room.
export const OBSERVER_TOPICS = [
  'tBus/rooms/+/alive',
  'tBus/rooms/+/peers/+/joined',
  'tBus/rooms/+/peers/+/left'
]

export class AllRoomsObserver {
  private client: MqttClient | null = null
  private errorLogged = false

  // `ownRoom` returns the joined room's name ('' when not joined). Its traffic
  // is skipped — the bus tap already logs it.
  constructor(private readonly ownRoom: () => string) {}

  get running(): boolean {
    return this.client !== null
  }

  start(config: BrokerConfig, peerId: string): void {
    if (this.client || !config.host) return
    this.errorLogged = false
    const client = connect(`mqtt://${config.host}:${config.port}`, {
      clientId: `${peerId || 'portbay'}-observer`,
      username: config.username || undefined,
      password: config.password || undefined,
      clean: true,
      reconnectPeriod: 5000
    })
    this.client = client

    client.on('connect', () => {
      this.errorLogged = false
      logEvent({ source: 'bus', kind: 'event', topic: 'all-rooms observer connected' })
      client.subscribe(OBSERVER_TOPICS, { qos: 0 })
    })
    client.on('error', (err) => {
      if (this.errorLogged) return
      this.errorLogged = true
      logEvent({ source: 'bus', kind: 'warn', topic: 'all-rooms observer error', value: err.message })
    })
    client.on('message', (topic, payload, packet) => {
      try {
        const room = topic.split('/')[2]
        if (room && room === this.ownRoom()) return
        const { value, summary } = describeBusMessage('recv', topic, payload)
        logEvent({ source: classifyBusTopic(topic), kind: 'recv', topic, value, summary, retained: packet.retain })
      } catch { /* never let logging break the observer */ }
    })
  }

  stop(): void {
    if (!this.client) return
    this.client.end(true)
    this.client = null
    logEvent({ source: 'bus', kind: 'event', topic: 'all-rooms observer stopped' })
  }
}
