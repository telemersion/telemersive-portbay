import { describe, it, expect, beforeEach } from 'vitest'
import { DeviceRouter } from '../../src/main/deviceRouter'
import type { DeviceHandler } from '../../src/main/devices/types'
import { topics } from '../../src/shared/topics'

const OWN = 'ownPeer'
const OTHER = 'otherPeer'

function loadedTopic(peerId: string, channel: number): string {
  return topics.channelLoaded(peerId, channel)
}

function deviceTopic(peerId: string, channel: number, tail: string): string {
  return `/peer/${peerId}/rack/page_0/channel.${channel}/device/${tail}`
}

class FakeHandler implements DeviceHandler {
  publishDefaultsCalls = 0
  teardownCalls = 0
  destroyCalls = 0
  topicCalls: Array<{ subpath: string; value: string }> = []
  publishedTopics: string[]

  constructor(
    readonly channelIndex: number,
    readonly deviceType: number,
    publishedTopics: string[] = []
  ) {
    this.publishedTopics = publishedTopics
  }

  onTopicChanged(subpath: string, value: string): void {
    this.topicCalls.push({ subpath, value })
  }
  publishDefaults(): void {
    this.publishDefaultsCalls += 1
  }
  teardown(): string[] {
    this.teardownCalls += 1
    return this.publishedTopics
  }
  destroy(): void {
    this.destroyCalls += 1
  }
}

interface Harness {
  router: DeviceRouter
  subs: string[]
  unsubs: string[]
  publishes: Array<{ retained: 0 | 1; topic: string; value: string }>
  createdHandlers: FakeHandler[]
}

function makeHarness(
  factory?: (type: number, channel: number) => DeviceHandler | null
): Harness {
  const subs: string[] = []
  const unsubs: string[] = []
  const publishes: Array<{ retained: 0 | 1; topic: string; value: string }> = []
  const createdHandlers: FakeHandler[] = []

  const fakeBus: any = {
    subscribe(t: string) { subs.push(t) },
    unsubscribe(t: string) { unsubs.push(t) }
  }

  const defaultFactory = (type: number, channel: number): DeviceHandler | null => {
    const h = new FakeHandler(channel, type, [
      deviceTopic(OWN, channel, 'gui/localudp/inputPort'),
      deviceTopic(OWN, channel, 'gui/enable')
    ])
    createdHandlers.push(h)
    return h
  }

  const router = new DeviceRouter(
    fakeBus,
    OWN,
    factory ?? defaultFactory,
    (retained, topic, value) => publishes.push({ retained, topic, value })
  )

  return { router, subs, unsubs, publishes, createdHandlers }
}

describe('DeviceRouter', () => {
  let h: Harness

  beforeEach(() => { h = makeHarness() })

  describe('ownership filtering', () => {
    it('ignores loaded messages for other peers', () => {
      h.router.onMqttMessage(loadedTopic(OTHER, 0), '1')
      expect(h.createdHandlers).toHaveLength(0)
      expect(h.subs).toEqual([])
    })

    it('ignores device messages for other peers', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.createdHandlers[0].topicCalls = []
      h.router.onMqttMessage(deviceTopic(OTHER, 0, 'gui/enable'), '1')
      expect(h.createdHandlers[0].topicCalls).toEqual([])
    })

    it('ignores topics that fail parseTopic (settings, unrelated)', () => {
      h.router.onMqttMessage(`/peer/${OWN}/settings/lock/enable`, '1')
      h.router.onMqttMessage('/random/unrelated', 'x')
      expect(h.createdHandlers).toHaveLength(0)
    })
  })

  describe('load', () => {
    it('on loaded>0 creates handler, publishes defaults, subscribes to device subtree', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 3), '1')
      expect(h.createdHandlers).toHaveLength(1)
      expect(h.createdHandlers[0].deviceType).toBe(1)
      expect(h.createdHandlers[0].channelIndex).toBe(3)
      expect(h.createdHandlers[0].publishDefaultsCalls).toBe(1)
      expect(h.subs).toEqual([topics.deviceSubscribe(OWN, 3)])
    })

    it('on loaded=0 with no existing handler does nothing', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 2), '0')
      expect(h.createdHandlers).toHaveLength(0)
      expect(h.subs).toEqual([])
      expect(h.unsubs).toEqual([])
    })

    it('same deviceType re-published is a no-op (no re-init)', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      expect(h.createdHandlers).toHaveLength(1)
      expect(h.createdHandlers[0].publishDefaultsCalls).toBe(1)
      expect(h.subs).toEqual([topics.deviceSubscribe(OWN, 0)])
    })

    it('skips channel when factory returns null', () => {
      const harness = makeHarness(() => null)
      harness.router.onMqttMessage(loadedTopic(OWN, 0), '6')
      expect(harness.subs).toEqual([])
      expect(harness.publishes).toEqual([])
    })

    it('routes device-subtree messages to the matching handler only', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 1), '1')
      h.router.onMqttMessage(loadedTopic(OWN, 2), '4')
      h.router.onMqttMessage(deviceTopic(OWN, 1, 'gui/enable'), '1')
      h.router.onMqttMessage(deviceTopic(OWN, 2, 'gui/localudp/inputPort'), '10020')

      const [h1, h2] = h.createdHandlers
      expect(h1.topicCalls).toEqual([{ subpath: 'gui/enable', value: '1' }])
      expect(h2.topicCalls).toEqual([{ subpath: 'gui/localudp/inputPort', value: '10020' }])
    })

    it('silently drops device messages for an unloaded channel', () => {
      h.router.onMqttMessage(deviceTopic(OWN, 5, 'gui/enable'), '1')
      expect(h.createdHandlers).toHaveLength(0)
    })
  })

  describe('unload (loaded=0)', () => {
    it('unsubscribes, empty-publishes every tracked topic, then destroys', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.publishes.length = 0

      h.router.onMqttMessage(loadedTopic(OWN, 0), '0')

      const handler = h.createdHandlers[0]
      expect(handler.teardownCalls).toBe(1)
      expect(handler.destroyCalls).toBe(1)
      expect(h.unsubs).toEqual([topics.deviceSubscribe(OWN, 0)])
      expect(h.publishes).toEqual([
        { retained: 1, topic: deviceTopic(OWN, 0, 'gui/localudp/inputPort'), value: '' },
        { retained: 1, topic: deviceTopic(OWN, 0, 'gui/enable'), value: '' }
      ])
    })

    it('after unload, device messages on the same channel are ignored', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.router.onMqttMessage(loadedTopic(OWN, 0), '0')
      const handler = h.createdHandlers[0]
      handler.topicCalls = []

      h.router.onMqttMessage(deviceTopic(OWN, 0, 'gui/enable'), '1')
      expect(handler.topicCalls).toEqual([])
    })
  })

  describe('swap (different deviceType)', () => {
    it('unloads old handler then loads new one', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.publishes.length = 0
      h.subs.length = 0

      h.router.onMqttMessage(loadedTopic(OWN, 0), '4')

      const [first, second] = h.createdHandlers
      expect(first.teardownCalls).toBe(1)
      expect(first.destroyCalls).toBe(1)
      expect(second.deviceType).toBe(4)
      expect(second.publishDefaultsCalls).toBe(1)
      expect(h.unsubs).toContain(topics.deviceSubscribe(OWN, 0))
      expect(h.subs).toEqual([topics.deviceSubscribe(OWN, 0)])
      expect(h.publishes.filter(p => p.value === '')).toHaveLength(2)
    })
  })

  describe('destroyAll', () => {
    it('unloads every active channel', () => {
      h.router.onMqttMessage(loadedTopic(OWN, 0), '1')
      h.router.onMqttMessage(loadedTopic(OWN, 5), '4')

      h.router.destroyAll()

      expect(h.createdHandlers.every(x => x.destroyCalls === 1)).toBe(true)
      expect(h.unsubs).toEqual(
        expect.arrayContaining([
          topics.deviceSubscribe(OWN, 0),
          topics.deviceSubscribe(OWN, 5)
        ])
      )
    })

    it('is a no-op when no channels are active', () => {
      h.router.destroyAll()
      expect(h.unsubs).toEqual([])
      expect(h.publishes).toEqual([])
    })
  })
})
