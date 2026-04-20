import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseJack, parseWasapi } from '../../../../src/main/enumeration/parsers/genericAudio'

const fixture = (version: string, name: string) =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parseJack', () => {
  it('returns 0 when jack server unavailable (1.10.3)', () => {
    expect(parseJack(fixture('1.10.3', 'jack-cap.txt'))).toEqual({ range: '0', count: 0 })
  })

  it('returns 0 on 1.9.12 as well', () => {
    const path = join(__dirname, '../../../fixtures/ultragrid/1.9.12/jack-cap.txt')
    if (!existsSync(path)) return
    expect(parseJack(readFileSync(path, 'utf-8'))).toEqual({ range: '0', count: 0 })
  })

  it('parses hypothetical running-jack output', () => {
    const synth = [
      'Available devices:',
      '    jack:0 - system:capture_1',
      '    jack:1 - system:capture_2',
      'Exit'
    ].join('\n')
    const result = parseJack(synth)
    expect(result.count).toBe(2)
    expect(result.range).toBe('0 system:capture_1|1 system:capture_2')
  })
})

describe('parseWasapi', () => {
  it('returns 0 on macOS where wasapi is not a known driver', () => {
    expect(parseWasapi(fixture('1.10.3', 'wasapi-cap.txt'))).toEqual({ range: '0', count: 0 })
  })
})
