import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  NatNetDevice,
  Direction,
  parseStreamInfoLine,
  DATA_STREAM_INFO_INTERVAL_MS
} from '../../../src/main/devices/NatNetDevice'
import type { LifecycleOptions, ChildProcessLifecycle } from '../../../src/main/devices/ChildProcessLifecycle'

interface FakeLifecycle {
  opts: LifecycleOptions
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  isRunning: ReturnType<typeof vi.fn>
}

function makeFakeLifecycle(opts: LifecycleOptions): FakeLifecycle {
  return {
    opts,
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => false)
  }
}

function makeDevice(overrides: { resolveBinary?: () => string | null } = {}) {
  const publish = vi.fn()
  const spawned: FakeLifecycle[] = []
  const spawnFactory = (opts: LifecycleOptions): ChildProcessLifecycle => {
    const fake = makeFakeLifecycle(opts)
    spawned.push(fake)
    return fake as unknown as ChildProcessLifecycle
  }
  const device = new NatNetDevice({
    channelIndex: 0,
    peerId: 'p1',
    localIP: '192.168.1.1',
    roomId: 11,
    publish,
    resolveBinary: overrides.resolveBinary ?? (() => '/fake/NatNetFour2OSC'),
    spawnFactory
  })
  return { device, publish, spawned }
}

function indicatorsOf(publish: ReturnType<typeof vi.fn>): string | undefined {
  const calls = publish.mock.calls.filter(
    (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/indicators'
  )
  const last = calls[calls.length - 1]
  return last ? [last[2], last[3], last[4]].join(' ') : undefined
}

describe('parseStreamInfoLine', () => {
  it('parses a full "streaminfo {data} {ctrl} {fps}" line', () => {
    expect(parseStreamInfoLine('streaminfo 1 0 59.94')).toEqual({
      dataActive: true,
      ctrlActive: false,
      fps: 59.94
    })
  })

  it('parses both flags active', () => {
    expect(parseStreamInfoLine('streaminfo 1 1 120')).toEqual({
      dataActive: true,
      ctrlActive: true,
      fps: 120
    })
  })

  it('parses the 2-token startup variant with no fps field', () => {
    expect(parseStreamInfoLine('streaminfo 0 0')).toEqual({
      dataActive: false,
      ctrlActive: false,
      fps: null
    })
  })

  it('returns null for unrelated log lines', () => {
    expect(parseStreamInfoLine('[CLI] /fake/NatNetFour2OSC --localIP 1.2.3.4')).toBeNull()
    expect(parseStreamInfoLine('Program terminated')).toBeNull()
    expect(parseStreamInfoLine('')).toBeNull()
  })
})

describe('NatNetDevice --dataStreamInfo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always passes --dataStreamInfo with a fixed interval (not user-configurable)', () => {
    const { device, spawned } = makeDevice()
    device.onTopicChanged('gui/direction/select', String(Direction.SendToLocal))
    device.onTopicChanged('gui/enable', '1')

    const args = spawned[0].opts.args
    const idx = args.indexOf('--dataStreamInfo')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe(String(DATA_STREAM_INFO_INTERVAL_MS))
  })

  it('drives the major indicator slot from streaminfo data flag, and keeps fps/ctrl off the visible monitor log', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/direction/select', String(Direction.SendToLocal))
    device.onTopicChanged('gui/monitor/monitorGate', '1')
    device.onTopicChanged('gui/enable', '1')

    expect(indicatorsOf(publish)).toBe('0 0 1') // running=1 on start; data not yet seen
    publish.mockClear()

    spawned[0].opts.onStdout('streaminfo 1 0 60')
    expect(indicatorsOf(publish)).toBe('1 0 1')

    // The diagnostic line itself must not leak into the visible monitor log.
    const monitorLines = publish.mock.calls
      .filter((c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/monitor/log')
      .map((c) => c[2])
    expect(monitorLines.some((l) => String(l).includes('streaminfo'))).toBe(false)

    spawned[0].opts.onStdout('streaminfo 0 0 0')
    expect(indicatorsOf(publish)).toBe('0 0 1')
  })

  it('resets the major indicator to 0 when the CLI is disabled', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/direction/select', String(Direction.SendToLocal))
    device.onTopicChanged('gui/enable', '1')
    spawned[0].opts.onStdout('streaminfo 1 0 60')
    expect(indicatorsOf(publish)).toBe('1 0 1')

    device.onTopicChanged('gui/enable', '0')
    expect(indicatorsOf(publish)).toBe('0 0 0')
  })

  it('resets the major indicator to 0 on an unexpected CLI crash', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/direction/select', String(Direction.SendToLocal))
    device.onTopicChanged('gui/enable', '1')
    spawned[0].opts.onStdout('streaminfo 1 0 60')
    expect(indicatorsOf(publish)).toBe('1 0 1')

    spawned[0].opts.onExit('crash', 1)
    expect(indicatorsOf(publish)).toBe('0 0 0')
  })
})
