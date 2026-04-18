import { describe, it, expect } from 'vitest'
import { createPeerState } from '../../../src/renderer/state/peerState'

describe('peerState', () => {
  it('sets a loaded value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/loaded', '1')
    expect(state.peers.abc.rack.page_0['channel.0'].loaded).toBe('1')
  })

  it('sets a device gui value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '0')
    expect(state.peers.abc.rack.page_0['channel.0'].device.gui.enable).toBe('0')
  })

  it('sets a settings value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/settings/lock/enable', '0')
    expect(state.peers.abc.settings.lock.enable).toBe('0')
  })

  it('sets a localudp value', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.2/device/gui/localudp/outputPortOne', '10028')
    expect(state.peers.abc.rack.page_0['channel.2'].device.gui.localudp.outputPortOne).toBe('10028')
  })

  it('clears a topic when value is empty string', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '1')
    state.applyTopic('/peer/abc/rack/page_0/channel.0/device/gui/enable', '')
    expect(state.peers.abc.rack.page_0['channel.0'].device.gui.enable).toBe('')
  })

  it('removes a peer subtree', () => {
    const state = createPeerState()
    state.applyTopic('/peer/abc/settings/lock/enable', '0')
    state.removePeer('abc')
    expect(state.peers.abc).toBeUndefined()
  })
})
