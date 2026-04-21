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
