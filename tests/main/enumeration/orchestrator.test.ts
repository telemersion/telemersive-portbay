import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enumerate, handleRefreshTrigger, registerBackend, resetRegistry } from '../../../src/main/enumeration'
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

describe('handleRefreshTrigger', () => {
  beforeEach(() => {
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    resetRegistry()
  })

  it('returns false for topics that do not match a refresh trigger', async () => {
    const calls: string[] = []
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerA/settings/localMenus/portaudioCaptureRange',
      (_r, t) => { calls.push(t) }
    )
    expect(handled).toBe(false)
    expect(calls).toEqual([])
  })

  it('returns false for refresh triggers aimed at a different peer', async () => {
    const calls: string[] = []
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerB/settings/localProps/ug_refresh_portaudioCapture',
      (_r, t) => { calls.push(t) }
    )
    expect(handled).toBe(false)
    expect(calls).toEqual([])
  })

  it('runs single-backend enumeration when the trigger matches', async () => {
    const published = new Map<string, string>()
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerA/settings/localProps/ug_refresh_portaudioCapture',
      (_r, t, v) => { published.set(t, v) }
    )
    expect(handled).toBe(true)
    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    expect(published.get(backendTopic('peerA', 'portaudioCapture')))
      .toBe(backendFallback('portaudioCapture'))
    // Other backends not republished
    for (const backend of applicableBackends()) {
      if (backend === 'portaudioCapture') continue
      expect(published.has(backendTopic('peerA', backend))).toBe(false)
    }
  })
})
