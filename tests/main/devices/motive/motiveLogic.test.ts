import { describe, it, expect } from 'vitest'
import {
  MotiveDirection,
  findPortConflict,
  formatPortConflict,
  deriveHealthState,
  defaultsForDirection,
  defaultDescription,
  DEFAULT_CMD_PORT,
  DEFAULT_DATA_PORT,
  DEFAULT_MULTICAST_IP,
  HANDSHAKE_OK_WINDOW_MS,
  NO_DATA_TIMEOUT_MS,
  type MotiveSibling,
  type MotiveConfig
} from '../../../../src/main/devices/motive/motiveLogic'

const baseConfig: MotiveConfig = {
  direction: MotiveDirection.Source,
  multicastIP: DEFAULT_MULTICAST_IP,
  dataPort: DEFAULT_DATA_PORT,
  cmdPort: DEFAULT_CMD_PORT,
  interfaceName: 'en0'
}

function sibling(channel: number, enabled: boolean, overrides: Partial<MotiveConfig> = {}): MotiveSibling {
  return {
    channelIndex: channel,
    enabled,
    config: { ...baseConfig, ...overrides }
  }
}

describe('findPortConflict', () => {
  it('returns null when no siblings are loaded', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: []
    })
    expect(result).toBeNull()
  })

  it('returns null when sibling is disabled even with same multicast pair', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [sibling(8, false)]
    })
    expect(result).toBeNull()
  })

  it('detects multicast pair collision with another enabled sibling', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [sibling(8, true)]
    })
    expect(result).toEqual({ conflictingChannel: 8, reason: 'multicast_pair' })
  })

  it('detects cmd port collision on the same NIC', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [sibling(8, true, { multicastIP: '239.255.42.100' })]
    })
    expect(result).toEqual({ conflictingChannel: 8, reason: 'cmd_port' })
  })

  it('does not flag cmd port collision when interfaces differ', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [
        sibling(8, true, { multicastIP: '239.255.42.100', interfaceName: 'en1' })
      ]
    })
    expect(result).toBeNull()
  })

  it('skips self channel', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [sibling(5, true)]
    })
    expect(result).toBeNull()
  })

  it('multicast pair takes priority over cmd port reason', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [sibling(8, true)]
    })
    expect(result?.reason).toBe('multicast_pair')
  })

  it('finds the first conflicting sibling', () => {
    const result = findPortConflict({
      self: { channelIndex: 5, config: baseConfig },
      siblings: [
        sibling(8, false),
        sibling(9, true),
        sibling(10, true)
      ]
    })
    expect(result?.conflictingChannel).toBe(9)
  })
})

describe('formatPortConflict', () => {
  it('formats the multicast_pair message with channel and address', () => {
    const msg = formatPortConflict(
      { conflictingChannel: 8, reason: 'multicast_pair' },
      baseConfig
    )
    expect(msg).toContain('channel 8')
    expect(msg).toContain('239.255.42.99')
    expect(msg).toContain('1511')
  })

  it('formats the cmd_port message with channel and interface', () => {
    const msg = formatPortConflict(
      { conflictingChannel: 8, reason: 'cmd_port' },
      baseConfig
    )
    expect(msg).toContain('channel 8')
    expect(msg).toContain('1510')
    expect(msg).toContain('en0')
  })
})

describe('deriveHealthState', () => {
  const now = 1_000_000

  function input(overrides: Partial<Parameters<typeof deriveHealthState>[0]> = {}) {
    return {
      enabled: true,
      direction: MotiveDirection.Source,
      lastHandshakeReplyAt: now - 100,
      lastDataPacketAt: now - 100,
      lastConsumerCmdAt: now - 100,
      duplicateSourceDetected: false,
      interfaceMissing: false,
      portConflict: false,
      now,
      ...overrides
    }
  }

  it('returns ok when disabled regardless of other flags', () => {
    expect(deriveHealthState(input({ enabled: false, portConflict: true }))).toBe('ok')
  })

  it('returns port_conflict before all other failures', () => {
    expect(deriveHealthState(input({ portConflict: true, duplicateSourceDetected: true }))).toBe('port_conflict')
  })

  it('returns interface_missing before duplicate_source', () => {
    expect(deriveHealthState(input({ interfaceMissing: true, duplicateSourceDetected: true }))).toBe('interface_missing')
  })

  it('returns duplicate_source when set', () => {
    expect(deriveHealthState(input({ duplicateSourceDetected: true }))).toBe('duplicate_source')
  })

  it('returns no_proxy when handshake never received', () => {
    expect(deriveHealthState(input({ lastHandshakeReplyAt: null }))).toBe('no_proxy')
  })

  it('returns no_proxy when handshake older than window', () => {
    expect(deriveHealthState(input({ lastHandshakeReplyAt: now - HANDSHAKE_OK_WINDOW_MS - 1 }))).toBe('no_proxy')
  })

  it('Source returns waiting_motive when no recent data', () => {
    expect(deriveHealthState(input({
      direction: MotiveDirection.Source,
      lastDataPacketAt: now - NO_DATA_TIMEOUT_MS - 1
    }))).toBe('waiting_motive')
  })

  it('Source returns waiting_motive when no data ever received', () => {
    expect(deriveHealthState(input({
      direction: MotiveDirection.Source,
      lastDataPacketAt: null
    }))).toBe('waiting_motive')
  })

  it('Source returns ok when handshake and data are recent', () => {
    expect(deriveHealthState(input({ direction: MotiveDirection.Source }))).toBe('ok')
  })

  it('Sink returns waiting_consumer when no consumer cmd ever received', () => {
    expect(deriveHealthState(input({
      direction: MotiveDirection.Sink,
      lastConsumerCmdAt: null
    }))).toBe('waiting_consumer')
  })

  it('Sink returns ok once a consumer has connected', () => {
    expect(deriveHealthState(input({ direction: MotiveDirection.Sink }))).toBe('ok')
  })
})

describe('defaultsForDirection', () => {
  it('preserves direction in returned config', () => {
    const src = defaultsForDirection(MotiveDirection.Source, 'en0')
    const sink = defaultsForDirection(MotiveDirection.Sink, 'en0')
    expect(src.direction).toBe(MotiveDirection.Source)
    expect(sink.direction).toBe(MotiveDirection.Sink)
  })

  it('uses canonical Motive defaults regardless of direction', () => {
    const src = defaultsForDirection(MotiveDirection.Source, 'en0')
    expect(src.multicastIP).toBe(DEFAULT_MULTICAST_IP)
    expect(src.dataPort).toBe(DEFAULT_DATA_PORT)
    expect(src.cmdPort).toBe(DEFAULT_CMD_PORT)
  })

  it('uses provided fallback interface', () => {
    const cfg = defaultsForDirection(MotiveDirection.Source, 'en42')
    expect(cfg.interfaceName).toBe('en42')
  })
})

describe('defaultDescription', () => {
  it('returns "Motive Source" for Source direction', () => {
    expect(defaultDescription(MotiveDirection.Source)).toBe('Motive Source')
  })
  it('returns "Motive Sink" for Sink direction', () => {
    expect(defaultDescription(MotiveDirection.Sink)).toBe('Motive Sink')
  })
})
