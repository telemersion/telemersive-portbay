import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dgram', () => ({
  createSocket: vi.fn(() => ({
    bind: vi.fn((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      cb?.()
    }),
    close: vi.fn((cb?: () => void) => cb?.()),
    send: vi.fn(),
    on: vi.fn()
  }))
}))

vi.mock('dns', () => ({
  lookup: (_host: string, _opts: any, cb: (err: any, addr: string, family: number) => void) => {
    cb(null, '1.2.3.4', 4)
  }
}))

import { OscDevice } from '../../../src/main/devices/OscDevice'

async function flush() { await new Promise(r => setImmediate(r)) }

describe('OscDevice', () => {
  const mockPublish = vi.fn()
  let device: OscDevice

  beforeEach(() => {
    vi.clearAllMocks()
    device = new OscDevice(
      0,                  // channelIndex
      'testPeerId',       // peerId
      '192.168.1.100',    // localIP
      11,                 // roomId
      mockPublish         // publish function
    )
  })

  it('has device type 1 (OSC)', () => {
    expect(device.deviceType).toBe(1)
  })

  it('publishes defaults with local ports (always 10xxx)', () => {
    device.publishDefaults()

    const calls = mockPublish.mock.calls
    const topicValueMap = new Map(calls.map((c: any[]) => [c[1] as string, c[2] as string]))

    // Local ports use prefix 10 regardless of roomId=11
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/outputPortOne')).toBe('10008')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/outputPortTwo')).toBe('10007')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/inputPort')).toBe('10009')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/localudp/peerLocalIP')).toBe('192.168.1.100')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/enable')).toBe('0')
    expect(topicValueMap.get('/peer/testPeerId/rack/page_0/channel.0/device/gui/description')).toBe('OSC')
  })

  it('tracks published topics for teardown', () => {
    device.publishDefaults()
    const teardownTopics = device.teardown()
    expect(teardownTopics.length).toBeGreaterThan(10)
    expect(teardownTopics).toContain('/peer/testPeerId/rack/page_0/channel.0/device/gui/enable')
  })

  it('starts relay on enable 0→1', async () => {
    device.publishDefaults()
    device.onTopicChanged('gui/enable', '1')
    await flush()
    expect(device.isRunning).toBe(true)
  })

  it('stops relay on enable 1→0', async () => {
    device.publishDefaults()
    device.onTopicChanged('gui/enable', '1')
    await flush()
    device.onTopicChanged('gui/enable', '0')
    expect(device.isRunning).toBe(false)
  })
})
