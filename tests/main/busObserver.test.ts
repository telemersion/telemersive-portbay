import { describe, it, expect, vi, beforeEach } from 'vitest'

const fake = vi.hoisted(() => ({ client: null as any, opts: null as any, url: '' }))

vi.mock('mqtt', async () => {
  const { EventEmitter } = await import('events')
  return {
    connect: (url: string, opts: any) => {
      const c: any = new EventEmitter()
      c.subscribe = vi.fn()
      c.end = vi.fn()
      fake.client = c
      fake.opts = opts
      fake.url = url
      return c
    }
  }
})

import { AllRoomsObserver, OBSERVER_TOPICS } from '../../src/main/busObserver'
import { getLogBuffer, clearLogBuffer } from '../../src/main/logBus'

const { PeerInfo } = require('telemersive-bus/lib/protos/BusMessages.js')
const config = { host: 'broker', port: 3883, username: 'peer', password: 'pw', localIP: '' }

describe('AllRoomsObserver', () => {
  beforeEach(() => clearLogBuffer())

  it('connects separately, subscribes on connect and skips the own room', () => {
    const obs = new AllRoomsObserver(() => 'lab')
    obs.start(config, 'abc')
    expect(fake.url).toBe('mqtt://broker:3883')
    expect(fake.opts.clientId).toBe('abc-observer')

    fake.client.emit('connect')
    expect(fake.client.subscribe).toHaveBeenCalledWith(OBSERVER_TOPICS, { qos: 0 })

    const payload = PeerInfo.encode(PeerInfo.create({ peerName: 'bob' })).finish()
    fake.client.emit('message', 'tBus/rooms/lab/peers/p1/joined', payload, { retain: true })
    fake.client.emit('message', 'tBus/rooms/other/peers/p2/joined', payload, { retain: true })

    const recv = getLogBuffer().filter(e => e.kind === 'recv')
    expect(recv).toHaveLength(1)
    expect(recv[0].summary).toBe("peer 'bob' joined room 'other'")
    expect(recv[0].retained).toBe(true)

    obs.stop()
    expect(fake.client.end).toHaveBeenCalledWith(true)
    expect(obs.running).toBe(false)
  })

  it('is idempotent and ignores an unconfigured broker', () => {
    const obs = new AllRoomsObserver(() => '')
    obs.start({ ...config, host: '' }, 'abc')
    expect(obs.running).toBe(false)
    obs.stop()
    expect(getLogBuffer()).toHaveLength(0)
  })
})
