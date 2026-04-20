import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseTextureSender } from '../../../../src/main/enumeration/parsers/textureSender'

const fixture = (version: string, name: string) =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parseTextureSender', () => {
  describe('syphon (macOS)', () => {
    it('parses a single server with blank name (1.10.3)', () => {
      const result = parseTextureSender(fixture('1.10.3', 'syphon.txt'))
      expect(result.count).toBe(1)
      expect(result.range).toBe("name='Simple Server'")
    })

    it('parses multiple servers with app/name pairs', () => {
      const synth = [
        'Available servers:',
        '\t1) app: Simple Server name: ',
        '\t2) app: OtherApp name: channel_2',
        '\t3) app: Renderer name: main_out',
        '',
        'Exit'
      ].join('\n')
      const result = parseTextureSender(synth)
      expect(result.count).toBe(3)
      expect(result.range.split('|')).toEqual([
        "name='Simple Server'",
        "name='OtherApp/channel_2'",
        "name='Renderer/main_out'"
      ])
    })

    it('returns -default- when header present but list empty', () => {
      const synth = 'Available servers:\n\nExit\n'
      expect(parseTextureSender(synth)).toEqual({ range: '-default-', count: 0 })
    })
  })

  describe('spout (unavailable on macOS)', () => {
    it('returns -default- on the "not found" sentinel', () => {
      expect(parseTextureSender(fixture('1.10.3', 'spout.txt'))).toEqual({
        range: '-default-',
        count: 0
      })
    })
  })

  it('returns -default- on garbage output', () => {
    expect(parseTextureSender('random noise')).toEqual({ range: '-default-', count: 0 })
  })
})
