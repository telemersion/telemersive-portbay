import { describe, it, expect, beforeEach } from 'vitest'
import { UltraGridIndicatorParser } from '../../../../src/main/devices/ultragrid/indicators'

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

  it('ignores lines without timestamp', (ctx) => {
    ctx.onTestFinished(() => parser.reset())
    const before = published.length
    parser.handleLogLine('no timestamp FPS 30/1')
    expect(published.length).toBe(before)
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
})
