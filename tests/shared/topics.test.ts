import { describe, it, expect } from 'vitest'
import { topics, parseTopic } from '../../src/shared/topics'

describe('topics', () => {
  it('builds a channel loaded topic', () => {
    expect(topics.channelLoaded('abc123', 0))
      .toBe('/peer/abc123/rack/page_0/channel.0/loaded')
  })

  it('builds a device gui topic', () => {
    expect(topics.deviceGui('abc123', 3, 'enable'))
      .toBe('/peer/abc123/rack/page_0/channel.3/device/gui/enable')
  })

  it('builds a localudp topic', () => {
    expect(topics.localudp('abc123', 0, 'outputPortOne'))
      .toBe('/peer/abc123/rack/page_0/channel.0/device/gui/localudp/outputPortOne')
  })

  it('builds a settings topic', () => {
    expect(topics.settings('abc123', 'lock/enable'))
      .toBe('/peer/abc123/settings/lock/enable')
  })

  it('builds a device wildcard subscribe topic', () => {
    expect(topics.deviceSubscribe('abc123', 5))
      .toBe('/peer/abc123/rack/page_0/channel.5/device/#')
  })

  it('builds the loaded wildcard subscribe topic', () => {
    expect(topics.loadedSubscribe('abc123'))
      .toBe('/peer/abc123/rack/+/+/loaded')
  })

  it('builds the settings wildcard subscribe topic', () => {
    expect(topics.settingsSubscribe('abc123'))
      .toBe('/peer/abc123/settings/#')
  })
})

describe('parseTopic', () => {
  it('parses a channel loaded topic', () => {
    const result = parseTopic('/peer/abc123/rack/page_0/channel.3/loaded')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'loaded',
      channelIndex: 3,
      value: undefined
    })
  })

  it('parses a device gui topic', () => {
    const result = parseTopic('/peer/abc123/rack/page_0/channel.0/device/gui/enable')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'device',
      channelIndex: 0,
      subpath: 'gui/enable'
    })
  })

  it('parses a settings topic', () => {
    const result = parseTopic('/peer/abc123/settings/lock/enable')
    expect(result).toEqual({
      peerId: 'abc123',
      type: 'settings',
      subpath: 'lock/enable'
    })
  })
})
