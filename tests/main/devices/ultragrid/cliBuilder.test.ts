import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  buildUvArgs,
  extractMenuIndex,
  type ResolvedMenuIndexes
} from '../../../../src/main/devices/ultragrid/cliBuilder'
import { defaultUltraGridConfig, applyTopicChange } from '../../../../src/main/devices/ultragrid/config'
import { allocateUgPorts } from '../../../../src/main/portAllocator'

function shellTokenize(line: string): string[] {
  // Split on whitespace at the top level, keeping single-quoted substrings
  // intact (including the quotes themselves). Max emits selections like
  // `spout:name='Spout Sender'` where the quotes are part of the argv element
  // that UV receives. `child_process.spawn` passes argv verbatim, so our
  // builder must also emit the quotes; this tokenizer matches that shape.
  const tokens: string[] = []
  let acc = ''
  let inSingle = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'") {
      inSingle = !inSingle
      acc += ch
      continue
    }
    if (!inSingle && /\s/.test(ch)) {
      if (acc) { tokens.push(acc); acc = '' }
      continue
    }
    acc += ch
  }
  if (acc) tokens.push(acc)
  return tokens
}

function loadFixture(name: string): string[] {
  const raw = readFileSync(
    join(__dirname, '../../../../tests/fixtures/ultragrid', name),
    'utf8'
  ).trim()
  return shellTokenize(raw)
}

function configFromCapture(captureFile: string): ReturnType<typeof defaultUltraGridConfig> {
  const capture = readFileSync(
    join(__dirname, '../../../../tests/fixtures/ultragrid', captureFile),
    'utf8'
  )
  let config = defaultUltraGridConfig()
  for (const line of capture.split('\n')) {
    const match = line.match(/RECV\s+\S+\/device\/gui\/(\S+)\s+(.*)$/)
    if (!match) continue
    config = applyTopicChange(config, match[1], match[2])
  }
  return config
}

describe('extractMenuIndex', () => {
  it('finds a numeric prefix for an exact match', () => {
    const range = '0 Foo|12 Primary Sound Capture Driver (out: 0 in: 2 Windows DirectSound)|13 Bar'
    expect(extractMenuIndex(range, 'Primary Sound Capture Driver (out: 0 in: 2 Windows DirectSound)')).toBe(12)
  })

  it('handles a selection truncated to ~40 chars by Max', () => {
    const range = '6 Microsoft Sound Mapper Output (out: 2 in: 0 MME)|11 DELL U2413 (NVIDIA High Definition Audio) (out: 2 in: 0 MME)'
    expect(extractMenuIndex(range, 'DELL U2413 (NVIDIA High Definit (out: 2 in: 0 MME)')).toBe(11)
  })

  it('returns null for empty inputs', () => {
    expect(extractMenuIndex('', 'anything')).toBeNull()
    expect(extractMenuIndex('0 Foo|1 Bar', '')).toBeNull()
  })

  it('returns null when selection not found', () => {
    expect(extractMenuIndex('0 Foo|1 Bar', 'Baz')).toBeNull()
  })
})

describe('buildUvArgs — mode 1 (send-to-router)', () => {
  it('matches the captured Max CLI for room 11, channel 0', () => {
    const config = configFromCapture('capture-mode4-room11-ch0-raw.txt')
    const withMode1 = applyTopicChange(config, 'network/mode', '1')
    const ports = allocateUgPorts(11, 0)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: "name='Spout Sender'",
      ndiCapture: null,
      audioCapture: 44,
      audioReceive: null
    }
    const actual = buildUvArgs({
      config: withMode1,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    const expected = loadFixture('max-cli-mode1.txt')
    expect(actual).toEqual(expected)
  })

  it('uses channel-5 ports when channel=5', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    const withSource = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='room_channel_0'"
    )
    const ports = allocateUgPorts(11, 5)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: "name='room_channel_0'",
      ndiCapture: null,
      audioCapture: 12,
      audioReceive: null
    }
    const actual = buildUvArgs({
      config: withSource,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    const expected = loadFixture('max-cli-mode1-ch5.txt')
    expect(actual).toEqual(expected)
  })
})

describe('buildUvArgs — mode 1 transmission gating', () => {
  it('emits video-only when transmission=0 (no audio flags, -P uses single port)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      `-P${ports.videoPort}`,
      'telemersion.zhdk.ch'
    ])
    expect(actual).not.toContain('-s')
    expect(actual).not.toContain('--audio-codec')
    expect(actual).not.toContain('--audio-capture-format')
  })

  it('emits audio-only when transmission=1 (no video flags, -P uses single video port)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '1')
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:44',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      `-P${ports.videoPort}`,
      'telemersion.zhdk.ch'
    ])
    expect(actual).not.toContain('-t')
    expect(actual).not.toContain('-c')
  })

  it('emits both + dual-port -P when transmission=2 (unchanged behavior, regression guard)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '2')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toContain('-t')
    expect(actual).toContain('-s')
    expect(actual).toContain(
      `-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`
    )
  })
})

describe('buildUvArgs — mode 4 (peer-to-peer-automatic)', () => {
  it('matches the captured Max CLI for room 11, channel 0', () => {
    const config = configFromCapture('capture-mode4-room11-ch0-raw.txt')
    const ports = allocateUgPorts(11, 0)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: "name='Spout Sender'",
      ndiCapture: null,
      audioCapture: 12,
      audioReceive: 11
    }
    const actual = buildUvArgs({
      config,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    const expected = loadFixture('max-cli-mode4.txt')
    expect(actual).toEqual(expected)
  })

  it('omits -r when audioReceive index is null', () => {
    const config = configFromCapture('capture-mode4-room11-ch0-raw.txt')
    const ports = allocateUgPorts(11, 0)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: "name='Spout Sender'",
      ndiCapture: null,
      audioCapture: 12,
      audioReceive: null
    }
    const actual = buildUvArgs({
      config,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    expect(actual).not.toContain('-r')
  })
})

describe('buildUvArgs — mode 4 connection × transmission gating', () => {
  function mode4Config(connection: string, transmission: string) {
    let c = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '4')
    c = applyTopicChange(c, 'audioVideo/connection', connection)
    c = applyTopicChange(c, 'audioVideo/transmission', transmission)
    c = applyTopicChange(
      c,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    return c
  }

  const defaultIndexes: ResolvedMenuIndexes = {
    textureCapture: "name='Spout Sender'",
    ndiCapture: null,
    audioCapture: 12,
    audioReceive: 11
  }

  const commonInputs = {
    ports: allocateUgPorts(11, 0),
    indexes: defaultIndexes,
    host: 'telemersion.zhdk.ch',
    textureReceiverName: 'room_channel_0',
    localOs: 'win' as const
  }

  it('connection=0, transmission=0: send-only, video-only (no -s, no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M'
    ])
  })

  it('connection=0, transmission=1: send-only, audio-only (no -t/-c, no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1'
    ])
  })

  it('connection=0, transmission=2: send-only, both (no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '2'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1'
    ])
  })

  it('connection=1, transmission=0: receive-only, video-only (only -d)', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-d', "gl:spout='room_channel_0'"
    ])
  })

  it('connection=1, transmission=1: receive-only, audio-only (only -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-r', 'portaudio:11'
    ])
  })

  it('connection=1, transmission=2: receive-only, both', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '2'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-d', "gl:spout='room_channel_0'",
      '-r', 'portaudio:11'
    ])
  })

  it('connection=2, transmission=0: both sides, video-only', () => {
    const actual = buildUvArgs({ config: mode4Config('2', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '-d', "gl:spout='room_channel_0'"
    ])
  })

  it('connection=2, transmission=1: both sides, audio-only', () => {
    const actual = buildUvArgs({ config: mode4Config('2', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      '-r', 'portaudio:11'
    ])
  })

  it('connection=2, transmission=2: both sides, both kinds (regression for existing fixture)', () => {
    const actual = buildUvArgs({ config: mode4Config('2', '2'), ...commonInputs })
    expect(actual).toContain('-t')
    expect(actual).toContain('-s')
    expect(actual).toContain('-d')
    expect(actual).toContain('-r')
  })
})

describe('buildUvArgs — OS-dependent texture backend', () => {
  it('uses syphon on osx for mode 1 capture', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    const withSel = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Simple Server'"
    )
    const actual = buildUvArgs({
      config: withSel,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Simple Server'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 's_channel_0',
      localOs: 'osx'
    })
    expect(actual).toContain("syphon:name='Simple Server'")
    expect(actual).not.toContain("spout:name='Simple Server'")
  })

  it('uses gl:syphon= on osx for mode 4 display', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '4')
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: null },
      host: 'x',
      textureReceiverName: 'room_channel_0',
      localOs: 'osx'
    })
    expect(actual).toContain("gl:syphon='room_channel_0'")
    expect(actual).not.toContain("gl:spout='room_channel_0'")
  })
})

describe('buildUvArgs — unsupported modes', () => {
  it('throws for mode 2', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '2')
    expect(() =>
      buildUvArgs({
        config,
        ports: allocateUgPorts(11, 0),
        indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: null },
        host: 'x',
        textureReceiverName: 'y',
        localOs: 'win'
      })
    ).toThrow(/M2c/)
  })

  it('throws for mode 5', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '5')
    expect(() =>
      buildUvArgs({
        config,
        ports: allocateUgPorts(11, 0),
        indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: null },
        host: 'x',
        textureReceiverName: 'y',
        localOs: 'win'
      })
    ).toThrow()
  })

  it('throws for mode 7', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '7')
    expect(() =>
      buildUvArgs({
        config,
        ports: allocateUgPorts(11, 0),
        indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: null },
        host: 'x',
        textureReceiverName: 'y',
        localOs: 'win'
      })
    ).toThrow()
  })
})
