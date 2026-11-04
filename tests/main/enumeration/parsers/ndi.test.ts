import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseNdi } from '../../../../src/main/enumeration/parsers/ndi'

const fixture = (version: string, name = 'ndi.txt') =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parseNdi', () => {
  it('parses a single live source (1.10.3)', () => {
    const result = parseNdi(fixture('1.10.3'))
    expect(result.count).toBe(1)
    expect(result.range).toBe('NX-41545 (Test Patterns)')
  })

  it('parses a single live source (1.10.8)', () => {
    const result = parseNdi(fixture('1.10.8'))
    expect(result.count).toBe(1)
    expect(result.range).toBe('MB-41545 (Test Patterns)')
  })

  it('lists a self-generated NDI source (1.10.8, scripts/capture-uv-live-sources.sh)', () => {
    const names = parseNdi(fixture('1.10.8', 'ndi-live.txt')).range.split('|')
    expect(names).toContain('MB-41545 (UGFixtureNDI)')
  })

  it('returns -default- when 1.10.8 reports no sources', () => {
    const out = 'available sources (tentative, format: name - url):\n[NDI cap.] No sources found!\n[NDI cap.] You can pass "extra_ips" if mDNS is not operable.\n\nExit\n'
    expect(parseNdi(out)).toEqual({ range: '-default-', count: 0 })
  })

  it('returns -default- on 1.9.12 (no sources in fixture)', () => {
    expect(parseNdi(fixture('1.9.12'))).toEqual({ range: '-default-', count: 0 })
  })

  it('extracts source names before " - url"', () => {
    const synth = [
      'available sources (tentative, format: name - url):',
      '  MACHINE_A (SOURCE_1) - 192.168.1.5:5961',
      '  MACHINE_B (SOURCE_2) - 192.168.1.6:5962',
      'Exit'
    ].join('\n')
    const result = parseNdi(synth)
    expect(result.count).toBe(2)
    expect(result.range).toBe('MACHINE_A (SOURCE_1)|MACHINE_B (SOURCE_2)')
  })

  it('returns -default- on unrelated output', () => {
    expect(parseNdi('nothing about ndi here')).toEqual({ range: '-default-', count: 0 })
  })
})
