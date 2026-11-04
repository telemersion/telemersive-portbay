import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UltraGridIndicatorParser, DEFAULT_IDLE_MS } from '../../../../src/main/devices/ultragrid/indicators'

describe('UltraGridIndicatorParser', () => {
  let published: Array<{ topic: string; value: string }> = []
  let parser: UltraGridIndicatorParser

  beforeEach(() => {
    published = []
    parser = new UltraGridIndicatorParser(
      (_, topic, ...values) => published.push({ topic, value: values.join(' ') }),
      'test/indicators'
    )
  })

  it('parses Syphon TX FPS line', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558496.525] [Syphon] sender] FPS 30/1 peak. 30/1')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringContaining('1 0 30') })
  })

  it('parses Syphon RX FPS line', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558496.525] [Syphon] display] FPS 60/1 peak')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringContaining('0 1') })
  })

  it('parses periodic FPS summary (float format)', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558496.525] [syphon cap.] 288 frames in 5.01423 seconds = 57.4366 FPS')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringContaining('1 0 57.4366') })
  })

  it('parses Audio TX Volume line', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558497.525] [Audio] sender] Volume: -18.5')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^1 0 0 -18\.5/) })
  })

  it('parses Audio RX Volume line', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558497.525] [Audio] display] Volume: -91.38')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^0 1 .* -91\.38$/) })
  })

  it('parses live UG 1.10.x receive-side audio line "[audio dec.] Volume:"', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[audio dec.] Volume: [0] -17.99/-14.75 dBFS RMS/peak')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^0 1 0 0 0 -17\.99$/) })
  })

  it('parses live UG 1.10.x GL display and audio sender lines', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[GL] 150 frames in 5.00021 seconds = 29.9987 FPS')
    parser.handleLogLine('[Audio sender] Volume: [0] -18.00/-14.99 dBFS RMS/peak')
    expect(published.at(-1)?.value).toBe('1 1 0 -18.00 29.9987 0')
  })

  it('parses Audio TX Volume line with channel prefix "[0] dB/peak" format', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558497.525] [Audio sender] Volume: [0] -46.77/-33.98 dBFS RMS/peak')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^1 0 0 -46\.77/) })
  })

  it('ignores lines without timestamp', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    const before = published.length
    parser.handleLogLine('no timestamp FPS 30/1')
    expect(published.length).toBe(before)
  })

  it('parses GL periodic FPS summary as RX (no direction token in real uv output)', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[GL] 301 frames in 5.01653 seconds = 60.0016 FPS')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^0 1 0 0 60\.0016/) })
  })

  it('parses testcard periodic FPS summary as TX (capture-priming, no direction token)', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[testcard] 6 frames in 5.99392 seconds = 1.00101 FPS')
    expect(published).toContainEqual({ topic: 'test/indicators', value: expect.stringMatching(/^1 0 1\.00101/) })
  })

  it('ignores lines without recognized source prefix', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    const before = published.length
    parser.handleLogLine('[1664558496.525] [Unknown] sender] FPS 30/1')
    expect(published.length).toBe(before)
  })

  it('ignores lines without direction token', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    const before = published.length
    parser.handleLogLine('[1664558496.525] [Syphon] FPS 30/1')
    expect(published.length).toBe(before)
  })

  it('suppresses duplicate publishes', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558496.525] [Syphon] sender] FPS 30/1')
    const first = published.length
    parser.handleLogLine('[1664558496.525] [Syphon] sender] FPS 30/1')
    expect(published.length).toBe(first) // no new publish on same value
  })

  it('resets all state on reset()', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    parser.handleLogLine('[1664558496.525] [Syphon] sender] FPS 30/1')
    const before = published.length
    parser.reset()
    expect(published[before]?.value).toBe('0 0 0 0 0 0')
  })

  describe('per-channel levels', () => {
    let levels: Array<{ topic: string; value: string }> = []
    let lp: UltraGridIndicatorParser

    beforeEach(() => {
      levels = []
      lp = new UltraGridIndicatorParser(
        (_, topic, ...values) => levels.push({ topic, value: values.join(' ') }),
        'ind',
        { tx: 'lv/tx', rx: 'lv/rx' }
      )
    })

    it('publishes every channel of an 8-channel sender line', () => {
      const line =
        '[Audio sender] Volume: ' +
        Array.from({ length: 8 }, (_, i) => `[${i}] -${18 + i}.00/-${15 + i}.00`).join(', ') +
        ' dBFS RMS/peak'
      lp.handleLogLine(line)
      expect(levels).toContainEqual({
        topic: 'lv/tx',
        value: '-18.00/-15.00 -19.00/-16.00 -20.00/-17.00 -21.00/-18.00 -22.00/-19.00 -23.00/-20.00 -24.00/-21.00 -25.00/-22.00'
      })
      // channel 0 still drives the 6-value indicators topic
      expect(levels.find((p) => p.topic === 'ind' && /^1 0 0 -18\.00/.test(p.value))).toBeTruthy()
    })

    it('routes the receive-side "[audio dec.]" line to the rx levels topic', () => {
      lp.handleLogLine('[audio dec.] Volume: [0] -17.99/-14.75, [1] -30.5/-20.1 dBFS RMS/peak')
      expect(levels).toContainEqual({ topic: 'lv/rx', value: '-17.99/-14.75 -30.5/-20.1' })
    })

    it('keeps -inf for silent channels', () => {
      lp.handleLogLine('[Audio sender] Volume: [0] -inf/-inf, [1] -20.0/-10.0 dBFS RMS/peak')
      expect(levels).toContainEqual({ topic: 'lv/tx', value: '-inf/-inf -20.0/-10.0' })
    })

    it('does not republish unchanged levels', () => {
      const line = '[Audio sender] Volume: [0] -18.00/-14.99 dBFS RMS/peak'
      lp.handleLogLine(line)
      lp.handleLogLine(line)
      expect(levels.filter((p) => p.topic === 'lv/tx')).toHaveLength(1)
    })

    it('publishes nothing for the legacy single-value form', () => {
      lp.handleLogLine('[Audio sender] Volume: -18.5')
      expect(levels.filter((p) => p.topic === 'lv/tx')).toHaveLength(0)
    })

    it('clears both levels topics on reset', () => {
      lp.handleLogLine('[Audio sender] Volume: [0] -18.00/-14.99 dBFS RMS/peak')
      lp.reset()
      expect(levels).toContainEqual({ topic: 'lv/tx', value: '' })
      expect(levels).toContainEqual({ topic: 'lv/rx', value: '' })
    })

    it('parses the real 8-channel 1.10.8 loopback line', () => {
      lp.handleLogLine(
        '[audio dec.] Volume: [0] -17.99/-14.49, [1] -17.99/-14.49, [2] -17.99/-14.49, [3] -17.99/-14.49, [4] -17.99/-14.49, [5] -17.99/-14.49, [6] -17.99/-14.49, [7] -17.99/-14.49 dBFS RMS/peak'
      )
      expect(levels.find((p) => p.topic === 'lv/rx')?.value.split(' ')).toHaveLength(8)
    })
  })

  describe('idle watchdog', () => {
    let out: Array<{ topic: string; value: string }> = []
    let wp: UltraGridIndicatorParser
    const last = (topic: string) => out.filter((p) => p.topic === topic).at(-1)?.value

    beforeEach(() => {
      vi.useFakeTimers()
      out = []
      wp = new UltraGridIndicatorParser(
        (_, topic, ...values) => out.push({ topic, value: values.join(' ') }),
        'ind',
        { tx: 'lv/tx', rx: 'lv/rx' }
      )
    })
    afterEach(() => {
      wp.dispose()
      vi.useRealTimers()
    })

    const rxLines = () => {
      wp.handleLogLine('[GL] 150 frames in 5.0 seconds = 30.0 FPS')
      wp.handleLogLine('[audio dec.] Volume: [0] -18.00/-14.00, [1] -20.00/-10.00 dBFS RMS/peak')
    }

    it('clears flag, fps, volume and levels of a direction after the idle window', () => {
      rxLines()
      expect(last('ind')).toBe('0 1 0 0 30 -18.00')
      expect(last('lv/rx')).toBe('-18.00/-14.00 -20.00/-10.00')
      vi.advanceTimersByTime(DEFAULT_IDLE_MS)
      expect(last('ind')).toBe('0 0 0 0 0 0')
      expect(last('lv/rx')).toBe('')
    })

    it('does not clear while lines keep arriving every 5s', () => {
      for (let i = 0; i < 6; i++) {
        rxLines()
        vi.advanceTimersByTime(5000)
      }
      expect(last('ind')).toBe('0 1 0 0 30 -18.00')
      expect(last('lv/rx')).toBe('-18.00/-14.00 -20.00/-10.00')
    })

    it('expires tx and rx independently', () => {
      wp.handleLogLine('[testcard] 150 frames in 5.0 seconds = 30.0 FPS')
      vi.advanceTimersByTime(10_000)
      rxLines()
      vi.advanceTimersByTime(5000) // tx idle for 15s, rx only 5s
      expect(last('ind')).toBe('0 1 0 0 30 -18.00')
      vi.advanceTimersByTime(10_000)
      expect(last('ind')).toBe('0 0 0 0 0 0')
    })

    it('recovers when the stream resumes after expiry', () => {
      rxLines()
      vi.advanceTimersByTime(DEFAULT_IDLE_MS)
      rxLines()
      expect(last('ind')).toBe('0 1 0 0 30 -18.00')
      expect(last('lv/rx')).toBe('-18.00/-14.00 -20.00/-10.00')
    })

    it('does not publish anything for a direction that was never active', () => {
      vi.advanceTimersByTime(60_000)
      expect(out).toHaveLength(0)
    })

    it('reset() and dispose() cancel pending expiry without extra publishes', () => {
      rxLines()
      wp.dispose()
      out.length = 0
      vi.advanceTimersByTime(60_000)
      expect(out).toHaveLength(0)
    })
  })
})
