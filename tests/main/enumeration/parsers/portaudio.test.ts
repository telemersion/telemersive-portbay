import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parsePortaudio } from '../../../../src/main/enumeration/parsers/portaudio'

const fixture = (version: string, name: string) =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parsePortaudio', () => {
  describe('1.10.3 (terse format)', () => {
    it('parses capture probe', () => {
      const result = parsePortaudio(fixture('1.10.3', 'portaudio-cap.txt'))
      expect(result.count).toBe(4)
      expect(result.range.split('|')).toEqual([
        '0 NDI Audio (2; Core Audio)',
        '4 MacBook Pro Microphone (1; Core Audio)',
        '5 MacBook Pro Speakers (0; Core Audio)',
        '7 NDI Audio (0; Core Audio)'
      ])
    })

    it('parses playback probe', () => {
      const result = parsePortaudio(fixture('1.10.3', 'portaudio-recv.txt'))
      expect(result.count).toBe(2)
      expect(result.range.split('|')).toEqual([
        '0 NDI Audio (0; Core Audio)',
        '4 MacBook Pro Microphone (0; Core Audio)'
      ])
    })
  })

  describe('1.9.12 (verbose format)', () => {
    it('parses capture probe with output/input channels', () => {
      const result = parsePortaudio(fixture('1.9.12', 'portaudio-cap.txt'))
      expect(result.count).toBe(8)
      const first = result.range.split('|')[0]
      expect(first).toBe('0 NDI Audio (output channels: 0; input channels: 2; Core Audio)')
    })

    it('strips (*) marker from the starred default', () => {
      const result = parsePortaudio(fixture('1.9.12', 'portaudio-cap.txt'))
      expect(result.range).toContain('4 MacBook Pro Microphone')
      expect(result.range).not.toContain('(*)')
    })
  })

  it('returns 0 on unrecognized output', () => {
    expect(parsePortaudio('garbage')).toEqual({ range: '0', count: 0 })
  })
})
