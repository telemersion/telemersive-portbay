import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseTextureSender } from '../../../../src/main/enumeration/parsers/textureSender'

const fixture = (version: string, name: string) =>
  readFileSync(join(__dirname, '../../../fixtures/ultragrid', version, name), 'utf-8')

describe('parseTextureSender', () => {
  describe('syphon (macOS)', () => {
    it('parses a single server with blank name (1.10.8)', () => {
      expect(parseTextureSender(fixture('1.10.8', 'syphon.txt'), 'syphon')).toEqual({
        range: "app='Simple Server'",
        count: 1
      })
    })

    it('lists a self-generated named server (1.10.8, scripts/capture-uv-live-sources.sh)', () => {
      const entries = parseTextureSender(fixture('1.10.8', 'syphon-live.txt'), 'syphon').range.split('|')
      expect(entries).toContain("app='uv-real':name='UGFixtureSyphon'")
    })

    it('returns -default- when 1.10.8 reports no servers', () => {
      const out = 'Available servers:\n[syphon cap.] \tNo Syphon servers found.\n\nExit\n'
      expect(parseTextureSender(out, 'syphon')).toEqual({ range: '-default-', count: 0 })
    })

    it('parses a single server with blank name (1.10.3)', () => {
      const result = parseTextureSender(fixture('1.10.3', 'syphon.txt'), 'syphon')
      expect(result.count).toBe(1)
      expect(result.range).toBe("app='Simple Server'")
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
      const result = parseTextureSender(synth, 'syphon')
      expect(result.count).toBe(3)
      expect(result.range.split('|')).toEqual([
        "app='Simple Server'",
        "app='OtherApp':name='channel_2'",
        "app='Renderer':name='main_out'"
      ])
    })

    it('returns -default- when header present but list empty', () => {
      const synth = 'Available servers:\n\nExit\n'
      expect(parseTextureSender(synth, 'syphon')).toEqual({ range: '-default-', count: 0 })
    })
  })

  describe('spout (Windows)', () => {
    it('returns -default- on the "not found" sentinel (probed on macOS)', () => {
      expect(parseTextureSender(fixture('1.10.3', 'spout.txt'), 'spout')).toEqual({
        range: '-default-',
        count: 0
      })
    })

    it('parses real-world Spout sender list (UG 1.10.3 Windows format)', () => {
      const synth = [
        'Servers:',
        '\tIO (OBS_Motive)) width: 1920, height: 1080',
        '',
        'Exit'
      ].join('\n')
      const result = parseTextureSender(synth, 'spout')
      expect(result.count).toBe(1)
      expect(result.range).toBe("name='IO (OBS_Motive)'")
    })

    it('parses multiple Spout senders', () => {
      const synth = [
        'Servers:',
        '\tSpoutSender1) width: 1280, height: 720',
        '\tIO (OBS_Motive)) width: 1920, height: 1080',
        '',
        'Exit'
      ].join('\n')
      const result = parseTextureSender(synth, 'spout')
      expect(result.count).toBe(2)
      expect(result.range.split('|')).toEqual([
        "name='SpoutSender1'",
        "name='IO (OBS_Motive)'"
      ])
    })
  })

  it('returns -default- on garbage output', () => {
    expect(parseTextureSender('random noise')).toEqual({ range: '-default-', count: 0 })
  })
})
