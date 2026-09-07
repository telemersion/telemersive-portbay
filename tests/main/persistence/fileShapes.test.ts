import { describe, it, expect } from 'vitest'
import { looksLikeRack, looksLikeSettings } from '../../../src/main/persistence/fileShapes'

const RACK_FILE = {
  'rack/page_0/channel.2/loaded': '2',
  'rack/page_0/channel.2/device/gui/network/ports/receiveChannel': '4'
}

const SETTINGS_FILE = {
  peerName: 'studio',
  brokerUrl: 'example.org',
  brokerPort: 3883,
  panelRowHeight: 320
}

describe('looksLikeRack', () => {
  it('accepts a flat topic-tail map of string values', () => {
    expect(looksLikeRack(RACK_FILE)).toBe(true)
  })

  it('rejects a settings file (non-string values)', () => {
    expect(looksLikeRack(SETTINGS_FILE)).toBe(false)
  })

  it('rejects an empty object — nothing to restore', () => {
    expect(looksLikeRack({})).toBe(false)
  })

  it('rejects arrays and non-objects', () => {
    expect(looksLikeRack([])).toBe(false)
    expect(looksLikeRack(null)).toBe(false)
    expect(looksLikeRack('rack')).toBe(false)
  })
})

describe('looksLikeSettings', () => {
  it('accepts a file carrying known settings keys', () => {
    expect(looksLikeSettings(SETTINGS_FILE)).toBe(true)
  })

  it('accepts a partial settings file with a single marker key', () => {
    expect(looksLikeSettings({ brokerUrl: 'example.org' })).toBe(true)
  })

  it('rejects a rack file', () => {
    expect(looksLikeSettings(RACK_FILE)).toBe(false)
  })

  it('rejects arrays and non-objects', () => {
    expect(looksLikeSettings([])).toBe(false)
    expect(looksLikeSettings(null)).toBe(false)
  })
})
