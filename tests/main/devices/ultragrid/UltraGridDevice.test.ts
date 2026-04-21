import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UltraGridDevice } from '../../../../src/main/devices/ultragrid/UltraGridDevice'
import type { LifecycleOptions, ChildProcessLifecycle } from '../../../../src/main/devices/ChildProcessLifecycle'

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

function makeDevice(overrides: {
  resolveBinary?: () => string | null
  getSetting?: (s: string) => string | null
  hasRetained?: (t: string) => boolean
} = {}) {
  const publish = vi.fn()
  const spawned: FakeLifecycle[] = []
  const spawnFactory = (opts: LifecycleOptions): ChildProcessLifecycle => {
    const fake = makeFakeLifecycle(opts)
    spawned.push(fake)
    return fake as unknown as ChildProcessLifecycle
  }
  const device = new UltraGridDevice({
    channelIndex: 0,
    peerId: 'p1',
    localIP: '192.168.1.1',
    roomId: 11,
    publish,
    hasRetained: overrides.hasRetained ?? (() => false),
    getSetting: overrides.getSetting ?? (() => null),
    resolveBinary: overrides.resolveBinary ?? (() => '/fake/uv'),
    host: 'telemersion.zhdk.ch',
    spawnFactory,
    osOverride: 'win'
  })
  return { device, publish, spawned }
}

describe('UltraGridDevice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('has device type 2', () => {
    const { device } = makeDevice()
    expect(device.deviceType).toBe(2)
  })

  it('publishDefaults publishes description=UG and enable=0', () => {
    const { device, publish } = makeDevice()
    device.publishDefaults()
    const map = new Map(publish.mock.calls.map((c) => [c[1] as string, c[2] as string]))
    expect(map.get('/peer/p1/rack/page_0/channel.0/device/gui/description')).toBe('UG')
    expect(map.get('/peer/p1/rack/page_0/channel.0/device/gui/enable')).toBe('0')
    expect(map.get('/peer/p1/rack/page_0/channel.0/device/gui/network/mode')).toBe('1')
  })

  it('teardown returns the set of published topics', () => {
    const { device } = makeDevice()
    device.publishDefaults()
    const topics = device.teardown()
    expect(topics).toContain('/peer/p1/rack/page_0/channel.0/device/gui/enable')
    expect(topics.length).toBeGreaterThan(30)
  })

  it('starts lifecycle on enable 0→1 with correct args for mode 4', () => {
    const { device, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/audioVideo/videoCapture/texture/menu/selection', "name='Spout Sender'")
    device.onTopicChanged('gui/audioVideo/videoReciever/texture/name', 'room_channel_0')
    device.onTopicChanged('gui/enable', '1')

    expect(spawned).toHaveLength(1)
    expect(spawned[0].start).toHaveBeenCalled()
    expect(spawned[0].opts.binary).toBe('/fake/uv')
    expect(spawned[0].opts.args).toContain("gl:spout='room_channel_0'")
    expect(spawned[0].opts.args).toContain('-t')
  })

  it('mode 1 builds -P port flag glued with no space', () => {
    const { device, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '1')
    device.onTopicChanged('gui/enable', '1')
    expect(spawned[0].opts.args).toContain('-P11002:11002:11004:11004')
    expect(spawned[0].opts.args).toContain('telemersion.zhdk.ch')
  })

  it('stops lifecycle on enable 1→0', () => {
    const { device, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    device.onTopicChanged('gui/enable', '0')
    expect(spawned[0].stop).toHaveBeenCalled()
  })

  it('publishes enable=0 on crash exit', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    publish.mockClear()
    spawned[0].opts.onExit?.('crash', 1)
    const enableCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable'
    )
    expect(enableCalls.some((c) => c[2] === '0')).toBe(true)
  })

  it('publishes enable=0 on spawn-failure exit', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    publish.mockClear()
    spawned[0].opts.onExit?.('spawn-failure', 127)
    const enableOff = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable' && c[2] === '0'
    )
    expect(enableOff.length).toBeGreaterThan(0)
  })

  it('does not publish enable=0 on killed exit', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    device.onTopicChanged('gui/enable', '0')
    publish.mockClear()
    spawned[0].opts.onExit?.('killed', 0)
    const enableCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable'
    )
    expect(enableCalls).toHaveLength(0)
  })

  it('fails soft when binary is not resolvable', () => {
    const { device, publish, spawned } = makeDevice({ resolveBinary: () => null })
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    expect(spawned).toHaveLength(0)
    const enableOff = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable' && c[2] === '0'
    )
    expect(enableOff.length).toBeGreaterThan(0)
  })

  it('throws-handled for unsupported mode 2 (fails soft with enable=0)', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '2')
    device.onTopicChanged('gui/enable', '1')
    expect(spawned).toHaveLength(0)
    const enableOff = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable' && c[2] === '0'
    )
    expect(enableOff.length).toBeGreaterThan(0)
  })

  it('resolves portaudio capture index from settings range', () => {
    const getSetting = (s: string) =>
      s === 'localMenus/portaudioCaptureRange'
        ? '0 Foo|12 Primary Sound Capture Driver (out: 0 in: 2 Windows DirectSound)|13 Bar'
        : null
    const { device, spawned } = makeDevice({ getSetting })
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/audioVideo/audioCapture/type', '0')
    device.onTopicChanged(
      'gui/audioVideo/audioCapture/portaudio/menu/selection',
      'Primary Sound Capture Driver (out: 0 in: 2 Windows DirectSound)'
    )
    device.onTopicChanged('gui/enable', '1')
    expect(spawned[0].opts.args).toContain('portaudio:12')
  })

  it('ignores non-gui subpaths and unknown config subpaths', () => {
    const { device } = makeDevice()
    expect(() => {
      device.onTopicChanged('something/else', 'x')
      device.onTopicChanged('gui/not/a/real/path', 'x')
    }).not.toThrow()
  })

  it('does not publish monitor/log while monitorGate=0', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    publish.mockClear()
    spawned[0].opts.onStdout?.('hello from UV')
    const logCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/monitor/log'
    )
    expect(logCalls).toHaveLength(0)
  })

  it('publishes monitor/log per-line when monitorGate flips 0→1 and on subsequent log lines', () => {
    const { device, publish, spawned } = makeDevice()
    device.onTopicChanged('gui/network/mode', '4')
    device.onTopicChanged('gui/enable', '1')
    spawned[0].opts.onStdout?.('line A')
    spawned[0].opts.onStdout?.('line B')
    publish.mockClear()

    device.onTopicChanged('gui/monitor/monitorGate', '1')
    let logCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/monitor/log'
    )
    const replayValues = logCalls.map((c) => c[2])
    expect(replayValues).toContain('line A')
    expect(replayValues).toContain('line B')
    expect(replayValues.every((v) => !v.includes('\n'))).toBe(true)

    publish.mockClear()
    spawned[0].opts.onStdout?.('line C')
    logCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/monitor/log'
    )
    expect(logCalls).toHaveLength(1)
    expect(logCalls[0][2]).toBe('line C')

    publish.mockClear()
    device.onTopicChanged('gui/monitor/monitorGate', '0')
    spawned[0].opts.onStdout?.('line D')
    const afterGateOff = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/monitor/log'
    )
    expect(afterGateOff).toHaveLength(0)
  })

  it('respects hasRetained to skip defaults already present', () => {
    const retained = new Set<string>([
      '/peer/p1/rack/page_0/channel.0/device/gui/enable'
    ])
    const { device, publish } = makeDevice({ hasRetained: (t) => retained.has(t) })
    device.publishDefaults()
    const enableCalls = publish.mock.calls.filter(
      (c) => c[1] === '/peer/p1/rack/page_0/channel.0/device/gui/enable'
    )
    expect(enableCalls).toHaveLength(0)
  })
})
