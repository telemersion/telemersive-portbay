import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCoreaudio } from '../../../../src/main/enumeration/parsers/coreaudio'

const fixture = (version: string, name: string) =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parseCoreaudio', () => {
  it('parses 1.10.3 capture probe', () => {
    const result = parseCoreaudio(fixture('1.10.3', 'coreaudio-cap.txt'))
    expect(result.count).toBe(8)
    expect(result.range.split('|')).toEqual([
      '158 NDI Audio',
      '100 BlackHole 16ch',
      '116 BlackHole 2ch',
      '132 BlackHole 64ch',
      '95 MacBook Pro Microphone',
      '148 Microsoft Teams Audio',
      '175 ZoomAudioDevice',
      '61 Hauptgeraet'
    ])
  })

  it('parses 1.10.3 playback probe', () => {
    const result = parseCoreaudio(fixture('1.10.3', 'coreaudio-recv.txt'))
    expect(result.count).toBe(8)
    expect(result.range).toContain('88 MacBook Pro Speakers')
  })

  it('parses 1.9.12 capture probe identically', () => {
    const result = parseCoreaudio(fixture('1.9.12', 'coreaudio-cap.txt'))
    expect(result.count).toBe(8)
    expect(result.range).toContain('95 MacBook Pro Microphone')
  })

  it('skips the default pseudo-entry (no numeric id)', () => {
    const result = parseCoreaudio(fixture('1.10.3', 'coreaudio-cap.txt'))
    expect(result.range).not.toContain('Default CoreAudio')
  })

  it('returns 0 on unrecognized output', () => {
    expect(parseCoreaudio('garbage')).toEqual({ range: '0', count: 0 })
  })
})
