import { describe, it, expect } from 'vitest'
import {
  refreshTopic,
  backendFromRefreshTopic
} from '../../../src/shared/topics'

describe('refreshTopic', () => {
  it('builds the ug_refresh_<backend> topic for a peer', () => {
    expect(refreshTopic('peerA', 'portaudioCapture'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_portaudioCapture')
    expect(refreshTopic('peerA', 'textureCapture'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_textureCapture')
    expect(refreshTopic('peerA', 'ndi'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_ndi')
  })
})

describe('backendFromRefreshTopic', () => {
  it('returns the backend for a matching peer + trigger topic', () => {
    const t = '/peer/peerA/settings/localProps/ug_refresh_portaudioCapture'
    expect(backendFromRefreshTopic('peerA', t)).toBe('portaudioCapture')
  })

  it('returns null when topic belongs to a different peer', () => {
    const t = '/peer/peerB/settings/localProps/ug_refresh_portaudioCapture'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for non-refresh settings topics', () => {
    const t = '/peer/peerA/settings/localMenus/portaudioCaptureRange'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for unrelated topics', () => {
    const t = '/peer/peerA/rack/page_0/channel.0/loaded'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for a malformed topic', () => {
    expect(backendFromRefreshTopic('peerA', '')).toBeNull()
    expect(backendFromRefreshTopic('peerA', 'garbage')).toBeNull()
  })
})
