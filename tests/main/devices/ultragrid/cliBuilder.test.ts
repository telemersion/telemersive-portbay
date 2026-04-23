import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  buildUvArgs,
  extractMenuIndex,
  type ResolvedMenuIndexes
} from '../../../../src/main/devices/ultragrid/cliBuilder'
import { defaultUltraGridConfig, applyTopicChange } from '../../../../src/main/devices/ultragrid/config'
import { allocateUgPorts, allocateUgRxPorts } from '../../../../src/main/portAllocator'

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

  it('emits bare -r portaudio (no menu index) when audioReceive index is null', () => {
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
    const rIndex = actual.indexOf('-r')
    expect(rIndex).toBeGreaterThanOrEqual(0)
    expect(actual[rIndex + 1]).toBe('portaudio')
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
    c = applyTopicChange(c, 'audioVideo/videoReciever/texture/name', 'room_channel_0')
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
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '4')
    config = applyTopicChange(config, 'audioVideo/videoReciever/texture/name', 'room_channel_0')
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

describe('buildUvArgs — mode 2 (receive-from-router)', () => {
  it('matches the captured Max CLI for room 11, channel 0', () => {
    const config = configFromCapture('capture-mode2-room11-ch0-raw.txt')
    const ports = allocateUgRxPorts(11, 0)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: null,
      ndiCapture: null,
      audioCapture: null,
      audioReceive: 5
    }
    const actual = buildUvArgs({
      config,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'Studio2_channel_0',
      localOs: 'osx'
    })
    const expected = loadFixture('max-cli-mode2.txt')
    expect(actual).toEqual(expected)
  })

  it('transmission=0 (video-only): emits testcard-video + display, no audio block', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '2')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(config, 'audioVideo/videoReciever/texture/name', 'rx_channel_0')
    const ports = allocateUgRxPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: null },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'rx_channel_0',
      localOs: 'osx'
    })
    expect(actual).toContain('-t')
    expect(actual[actual.indexOf('-t') + 1]).toBe('testcard:80:60:1:UYVY')
    expect(actual).toContain('-d')
    expect(actual).not.toContain('-s')
    expect(actual).not.toContain('-r')
  })

  it('transmission=1 (audio-only): emits testcard-audio + receive, no video block', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '2')
    config = applyTopicChange(config, 'audioVideo/transmission', '1')
    const ports = allocateUgRxPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: 5 },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'rx_channel_0',
      localOs: 'osx'
    })
    expect(actual).toContain('-s')
    expect(actual[actual.indexOf('-s') + 1]).toBe('testcard:frequency=440')
    expect(actual).toContain('-r')
    expect(actual).not.toContain('-t')
    expect(actual).not.toContain('-d')
  })

  it('uses RX-side port slots 6/8 via allocateUgRxPorts', () => {
    const config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '2')
    const ports = allocateUgRxPorts(11, 0)
    expect(ports).toEqual({ videoPort: 11006, audioPort: 11008 })
    const actual = buildUvArgs({
      config,
      ports,
      indexes: { textureCapture: null, ndiCapture: null, audioCapture: null, audioReceive: 5 },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'rx_channel_0',
      localOs: 'osx'
    })
    expect(actual).toContain('-P11006:11006:11008:11008')
  })
})

describe('buildUvArgs — mode 7 (capture-to-local loopback)', () => {
  it('matches the captured Max CLI for room 11, channel 0', () => {
    const config = configFromCapture('capture-mode7-room11-ch0-raw.txt')
    const ports = allocateUgPorts(11, 0)
    const indexes: ResolvedMenuIndexes = {
      textureCapture: "app='Simple Server':name=''",
      ndiCapture: null,
      audioCapture: null,
      audioReceive: null
    }
    const actual = buildUvArgs({
      config,
      ports,
      indexes,
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'Studio2_channel_0',
      localOs: 'osx'
    })
    const expected = loadFixture('max-cli-mode7.txt')
    expect(actual).toEqual(expected)
  })

  it('ignores transmission/connection — only emits video capture + display', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '7')
    config = applyTopicChange(config, 'audioVideo/transmission', '2')
    config = applyTopicChange(config, 'audioVideo/connection', '1')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    config = applyTopicChange(config, 'audioVideo/videoReciever/texture/name', 'loop_channel_0')
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: 11
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'loop_channel_0',
      localOs: 'win'
    })
    expect(actual).toContain('-t')
    expect(actual).toContain('-d')
    expect(actual).not.toContain('-s')
    expect(actual).not.toContain('-r')
    expect(actual).not.toContain('-P11002')
    expect(actual).not.toContain('telemersion.zhdk.ch')
  })

  it('emits no -c flag (local loopback does not compress)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '7')
    config = applyTopicChange(config, 'audioVideo/videoCapture/advanced/compress/codec', '3')
    config = applyTopicChange(config, 'audioVideo/videoReciever/texture/name', 'loop_channel_0')
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: null,
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'x',
      textureReceiverName: 'loop_channel_0',
      localOs: 'osx'
    })
    expect(actual).not.toContain('-c')
  })

  it('supports NDI capture (type=1) when configured', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '7')
    config = applyTopicChange(config, 'audioVideo/videoCapture/type', '1')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/ndi/menu/selection',
      "url=http://example.local"
    )
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: null,
        ndiCapture: "url=http://example.local",
        audioCapture: null,
        audioReceive: null
      },
      host: 'x',
      textureReceiverName: 'loop_channel_0',
      localOs: 'osx'
    })
    const tIdx = actual.indexOf('-t')
    expect(tIdx).toBeGreaterThanOrEqual(0)
    expect(actual[tIdx + 1]).toBe('ndi:url=http://example.local')
  })
})

describe('buildUvArgs — top-level flags', () => {
  it('concatenates advanced/params into --param after log-color=no', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/advanced/advanced/params/params',
      'audio-buffer-len=100'
    )
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    const pIdx = actual.indexOf('--param')
    expect(pIdx).toBe(0)
    expect(actual[pIdx + 1]).toBe('log-color=no,audio-buffer-len=100')
  })

  it('tokenizes advanced/custom flags with single-quoted substrings preserved', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/advanced/custom/customFlags/flags',
      "--foo bar='baz qux' --quux"
    )
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    expect(actual).toContain('--foo')
    expect(actual).toContain("bar='baz qux'")
    expect(actual).toContain('--quux')
  })

  it('emits --encryption <key> when a key is set', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/advanced/advanced/encryption/key',
      'hunter2'
    )
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    const eIdx = actual.indexOf('--encryption')
    expect(eIdx).toBeGreaterThanOrEqual(0)
    expect(actual[eIdx + 1]).toBe('hunter2')
  })

  it('omits advanced fields when set to -none- (baseline mode 1 unchanged)', () => {
    // Regression guard: the captured mode 1 fixture has no --encryption / no
    // custom advanced flags. If we emitted them by default the mode-1 fixture
    // match test would break — but this test locks the sentinel behavior in
    // isolation so a future default-value change is caught here first.
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const actual = buildUvArgs({
      config,
      ports: allocateUgPorts(11, 0),
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
    expect(actual).not.toContain('--encryption')
    expect(actual.indexOf('--param')).toBe(0)
    expect(actual[1]).toBe('log-color=no')
  })
})

describe('buildUvArgs — mode 5 (peer-to-peer manual)', () => {
  function mode5Config(connection: string, transmission: string, customSending: string) {
    let c = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '5')
    c = applyTopicChange(c, 'audioVideo/connection', connection)
    c = applyTopicChange(c, 'audioVideo/transmission', transmission)
    c = applyTopicChange(c, 'network/local/customSending', customSending)
    c = applyTopicChange(
      c,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    c = applyTopicChange(c, 'audioVideo/videoReciever/texture/name', 'room_channel_0')
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

  it('connection=2, transmission=2: -P<p>:<p>:<p+2>:<p+2>, receive then send, LAN IP at tail', () => {
    const actual = buildUvArgs({
      config: mode5Config('2', '2', '192.168.1.50:11002'),
      ...commonInputs
    })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-P11002:11002:11004:11004',
      '-d', "gl:spout='room_channel_0'",
      '-r', 'portaudio:11',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      '192.168.1.50'
    ])
  })

  it('connection=0, transmission=0: send-only video, single -P, LAN IP at tail', () => {
    const actual = buildUvArgs({
      config: mode5Config('0', '0', '10.0.0.7:11002'),
      ...commonInputs
    })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-P11002',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '10.0.0.7'
    ])
  })

  it('connection=0, transmission=1: send-only audio, no -t, LAN IP at tail', () => {
    const actual = buildUvArgs({
      config: mode5Config('0', '1', '10.0.0.7:11002'),
      ...commonInputs
    })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-P11002',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      '10.0.0.7'
    ])
  })

  it('connection=1, transmission=0: receive-only video, no LAN IP tail, no -s/-r', () => {
    const actual = buildUvArgs({
      config: mode5Config('1', '0', '10.0.0.7:11002'),
      ...commonInputs
    })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-P11002',
      '-d', "gl:spout='room_channel_0'"
    ])
    expect(actual).not.toContain('10.0.0.7')
  })

  it('connection=1, transmission=1: receive-only audio, no LAN IP tail', () => {
    const actual = buildUvArgs({
      config: mode5Config('1', '1', '10.0.0.7:11002'),
      ...commonInputs
    })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-P11002',
      '-r', 'portaudio:11'
    ])
  })

  it('dual -P uses customSending port (not the allocator port)', () => {
    const actual = buildUvArgs({
      config: mode5Config('2', '2', '10.0.0.7:22000'),
      ...commonInputs
    })
    expect(actual).toContain('-P22000:22000:22002:22002')
    // Allocator port 11002 must not leak in.
    expect(actual.find((a) => a.startsWith('-P11'))).toBeUndefined()
  })

  it('emits no router/host (mode 5 is peer-to-peer, not via a server)', () => {
    const actual = buildUvArgs({
      config: mode5Config('2', '2', '10.0.0.7:11002'),
      ...commonInputs
    })
    expect(actual).not.toContain('telemersion.zhdk.ch')
  })

  it('throws on malformed customSending', () => {
    expect(() =>
      buildUvArgs({
        config: mode5Config('0', '0', 'not-a-valid-value'),
        ...commonInputs
      })
    ).toThrow(/customSending/)
  })
})

describe('buildUvArgs — video codec table', () => {
  function buildMode1VideoOnly(videoCodecIndex: string): string[] {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/advanced/compress/codec',
      videoCodecIndex
    )
    const ports = allocateUgPorts(11, 0)
    return buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: null,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
  }

  it.each([
    ['1', 'JPEG'],    // Max label "MJPEG" → UG-accepted "JPEG"
    ['2', 'H.264'],
    ['3', 'H.265'],
    ['4', 'J2K'],
    ['5', 'AV1'],
    ['6', 'VP8'],
    ['7', 'VP9'],
    ['8', 'HFYU'],
    ['9', 'FFV1']
  ])('codec index %s → libavcodec:codec=%s:bitrate=10M', (idx, name) => {
    const args = buildMode1VideoOnly(idx)
    expect(args).toContain('-c')
    const cIndex = args.indexOf('-c')
    expect(args[cIndex + 1]).toBe(`libavcodec:codec=${name}:bitrate=10M`)
  })

  it('codec index 0 (-none-) omits the -c flag entirely', () => {
    const args = buildMode1VideoOnly('0')
    expect(args).not.toContain('-c')
  })

  it('unknown codec index throws a descriptive error', () => {
    expect(() => buildMode1VideoOnly('42')).toThrow(/unsupported video codec id: 42/)
  })
})

describe('buildUvArgs — audio codec table', () => {
  function buildMode1AudioOnly(audioCodecIndex: string): string[] {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '1')
    config = applyTopicChange(
      config,
      'audioVideo/audioCapture/advanced/compress/codec',
      audioCodecIndex
    )
    const ports = allocateUgPorts(11, 0)
    return buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: null,
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })
  }

  it.each([
    ['1', 'OPUS'],
    ['3', 'FLAC'],
    ['4', 'AAC'],
    ['5', 'MP3'],
    ['6', 'G.722'],
    ['7', 'u-law'],
    ['8', 'A-law'],
    ['9', 'PCM']
  ])('codec index %s → --audio-codec %s:bitrate=64000', (idx, name) => {
    const args = buildMode1AudioOnly(idx)
    expect(args).toContain('--audio-codec')
    const cIndex = args.indexOf('--audio-codec')
    expect(args[cIndex + 1]).toBe(`${name}:bitrate=64000`)
  })

  it('codec index 0 (-none-) omits the --audio-codec flag entirely', () => {
    const args = buildMode1AudioOnly('0')
    expect(args).not.toContain('--audio-codec')
  })

  it('codec index 2 (speex) throws because UG 1.10.3 cannot encode it', () => {
    expect(() => buildMode1AudioOnly('2')).toThrow(/speex/)
  })

  it('unknown audio codec index throws a descriptive error', () => {
    expect(() => buildMode1AudioOnly('99')).toThrow(/unsupported audio codec id: 99/)
  })
})
