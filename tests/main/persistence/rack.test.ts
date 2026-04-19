import { describe, it, expect } from 'vitest'
import { isRackEligibleTail, buildRackSnapshot } from '../../../src/main/persistence/rack'

describe('isRackEligibleTail', () => {
  it('excludes settings/localMenus/*', () => {
    expect(isRackEligibleTail('settings/localMenus/portaudioCaptureRange')).toBe(false)
    expect(isRackEligibleTail('settings/localMenus/ndiRange')).toBe(false)
  })

  it('excludes settings/localProps/*', () => {
    expect(isRackEligibleTail('settings/localProps/ug_enable')).toBe(false)
    expect(isRackEligibleTail('settings/localProps/natnet_enable')).toBe(false)
  })

  it('includes other settings subpaths', () => {
    expect(isRackEligibleTail('settings/background/color')).toBe(true)
    expect(isRackEligibleTail('settings/lock/enable')).toBe(true)
  })

  it('includes rack/page_0/channel subpaths', () => {
    expect(isRackEligibleTail('rack/page_0/channel.0/loaded')).toBe(true)
    expect(isRackEligibleTail('rack/page_0/channel.3/device/gui/localudp/inputPort')).toBe(true)
  })
})

describe('buildRackSnapshot', () => {
  const peerId = 'peerABC'

  it('returns empty for empty peerId', () => {
    const topics = new Map([['/peer/x/settings/background/color', '0 0 0 1']])
    expect(buildRackSnapshot(topics, '')).toEqual({})
  })

  it('strips the /peer/{id}/ prefix and keeps the tail', () => {
    const topics = new Map([
      [`/peer/${peerId}/settings/background/color`, '0.5 0.5 0.5 1'],
      [`/peer/${peerId}/rack/page_0/channel.0/loaded`, '1']
    ])
    expect(buildRackSnapshot(topics, peerId)).toEqual({
      'settings/background/color': '0.5 0.5 0.5 1',
      'rack/page_0/channel.0/loaded': '1'
    })
  })

  it('omits topics belonging to other peers', () => {
    const topics = new Map([
      [`/peer/${peerId}/settings/background/color`, '0.5 0.5 0.5 1'],
      ['/peer/otherPeer/settings/background/color', '1 0 0 1']
    ])
    expect(buildRackSnapshot(topics, peerId)).toEqual({
      'settings/background/color': '0.5 0.5 0.5 1'
    })
  })

  it('excludes settings/localMenus/* from the snapshot', () => {
    const topics = new Map([
      [`/peer/${peerId}/settings/localMenus/portaudioCaptureRange`, 'Built-in Microphone,USB Mic'],
      [`/peer/${peerId}/settings/localMenus/ndiRange`, 'NDI Source A'],
      [`/peer/${peerId}/settings/background/color`, '0.5 0.5 0.5 1']
    ])
    const snap = buildRackSnapshot(topics, peerId)
    expect(snap).toEqual({ 'settings/background/color': '0.5 0.5 0.5 1' })
    expect(snap['settings/localMenus/portaudioCaptureRange']).toBeUndefined()
    expect(snap['settings/localMenus/ndiRange']).toBeUndefined()
  })

  it('excludes settings/localProps/* from the snapshot', () => {
    const topics = new Map([
      [`/peer/${peerId}/settings/localProps/ug_enable`, '1'],
      [`/peer/${peerId}/settings/localProps/natnet_enable`, '0'],
      [`/peer/${peerId}/rack/page_0/channel.0/loaded`, '1']
    ])
    const snap = buildRackSnapshot(topics, peerId)
    expect(snap).toEqual({ 'rack/page_0/channel.0/loaded': '1' })
  })
})
