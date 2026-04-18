import { TBusClient } from './busClient'
import { topics, parseTopic } from '../shared/topics'
import type { DeviceHandler } from './devices/types'

export class DeviceRouter {
  private handlers = new Map<number, DeviceHandler>()
  private ownPeerId: string
  private bus: TBusClient
  private handlerFactory: (type: number, channel: number) => DeviceHandler | null

  constructor(
    bus: TBusClient,
    ownPeerId: string,
    handlerFactory: (type: number, channel: number) => DeviceHandler | null
  ) {
    this.bus = bus
    this.ownPeerId = ownPeerId
    this.handlerFactory = handlerFactory
  }

  onMqttMessage(topic: string, value: string): void {
    const parsed = parseTopic(topic)
    if (!parsed) return
    if (parsed.peerId !== this.ownPeerId) return

    if (parsed.type === 'loaded') {
      this.handleLoaded(parsed.channelIndex, parseInt(value, 10) || 0)
    } else if (parsed.type === 'device') {
      const handler = this.handlers.get(parsed.channelIndex)
      if (handler) {
        handler.onTopicChanged(parsed.subpath, value)
      }
    }
  }

  private handleLoaded(channel: number, deviceType: number): void {
    const existing = this.handlers.get(channel)

    if (deviceType === 0) {
      if (existing) {
        this.unloadChannel(channel)
      }
      return
    }

    if (existing) {
      if (existing.deviceType === deviceType) return
      this.unloadChannel(channel)
    }

    const handler = this.handlerFactory(deviceType, channel)
    if (!handler) return

    this.handlers.set(channel, handler)
    handler.publishDefaults()
    this.bus.subscribe(topics.deviceSubscribe(this.ownPeerId, channel))
  }

  private unloadChannel(channel: number): void {
    const handler = this.handlers.get(channel)
    if (!handler) return

    this.bus.unsubscribe(topics.deviceSubscribe(this.ownPeerId, channel))

    const publishedTopics = handler.teardown()
    for (const t of publishedTopics) {
      this.bus.publish(1, t, '')
    }

    handler.destroy()
    this.handlers.delete(channel)
  }

  destroyAll(): void {
    for (const channel of [...this.handlers.keys()]) {
      this.unloadChannel(channel)
    }
  }
}
