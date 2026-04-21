import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enumerate, registerBackend, resetRegistry } from '../../../src/main/enumeration'
import { applicableBackends, backendFallback, backendTopic } from '../../../src/main/enumeration/topics'

describe('enumerate — no UV binary', () => {
  let originalUgPath: string | undefined

  beforeEach(() => {
    originalUgPath = process.env.UG_PATH
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    resetRegistry()
  })

  afterEach(() => {
    if (originalUgPath === undefined) delete process.env.UG_PATH
    else process.env.UG_PATH = originalUgPath
  })

  it('is a no-op when peerId is empty', async () => {
    const calls: string[] = []
    await enumerate('', (_r, topic) => { calls.push(topic) })
    expect(calls).toEqual([])
  })

  it('publishes ug_enable=0 and fallback for every applicable backend when UV is absent', async () => {
    const published = new Map<string, string>()
    await enumerate('peerXYZ', (retained, topic, value) => {
      expect(retained).toBe(1)
      published.set(topic, value)
    })

    expect(published.get('/peer/peerXYZ/settings/localProps/ug_enable')).toBe('0')

    for (const backend of applicableBackends()) {
      const topic = backendTopic('peerXYZ', backend)
      expect(published.get(topic)).toBe(backendFallback(backend))
    }
  })
})

describe('enumerate — backend registry', () => {
  beforeEach(() => { resetRegistry() })

  it('skips backends with no registered parser and publishes fallback', async () => {
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    const published = new Map<string, string>()
    await enumerate('peerA', (_r, t, v) => { published.set(t, v) })

    for (const backend of applicableBackends()) {
      expect(published.get(backendTopic('peerA', backend))).toBe(backendFallback(backend))
    }
  })
})

describe('enumerate — only filter', () => {
  beforeEach(() => {
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    resetRegistry()
  })

  it('publishes only the requested backend when `only` is passed, plus ug_enable=0', async () => {
    const published = new Map<string, string>()
    await enumerate('peerA', (_r, t, v) => { published.set(t, v) }, {
      only: ['portaudioCapture']
    })

    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    expect(published.get(backendTopic('peerA', 'portaudioCapture')))
      .toBe(backendFallback('portaudioCapture'))

    for (const backend of applicableBackends()) {
      if (backend === 'portaudioCapture') continue
      expect(published.has(backendTopic('peerA', backend))).toBe(false)
    }
  })

  it('ignores entries in `only` that are not in applicableBackends()', async () => {
    const published = new Map<string, string>()
    await enumerate('peerA', (_r, t, v) => { published.set(t, v) }, {
      only: ['wasapiCapture'] // not applicable on darwin/linux CI hosts
    })

    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    if (process.platform === 'win32') {
      expect(published.get(backendTopic('peerA', 'wasapiCapture')))
        .toBe(backendFallback('wasapiCapture'))
    } else {
      expect(published.has(backendTopic('peerA', 'wasapiCapture'))).toBe(false)
    }
  })
})
