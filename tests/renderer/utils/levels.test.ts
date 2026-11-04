import { describe, it, expect } from 'vitest'
import { parseLevels, levelToFraction, formatDb } from '../../../src/renderer/utils/levels'

describe('levels utils', () => {
  it('parses rms/peak tokens per channel', () => {
    expect(parseLevels('-18.00/-14.99 -20/-12')).toEqual([
      { rms: -18, peak: -14.99 },
      { rms: -20, peak: -12 }
    ])
  })

  it('handles rms-only tokens, -inf and empty input', () => {
    expect(parseLevels('-18.5')).toEqual([{ rms: -18.5, peak: null }])
    expect(parseLevels('-inf/-inf')).toEqual([{ rms: -Infinity, peak: -Infinity }])
    expect(parseLevels('')).toEqual([])
    expect(parseLevels(undefined)).toEqual([])
  })

  it('maps dBFS onto the -60..0 scale and clamps', () => {
    expect(levelToFraction(0)).toBe(1)
    expect(levelToFraction(-30)).toBe(0.5)
    expect(levelToFraction(-60)).toBe(0)
    expect(levelToFraction(-90)).toBe(0)
    expect(levelToFraction(6)).toBe(1)
    expect(levelToFraction(-Infinity)).toBe(0)
  })

  it('formats dB for tooltips', () => {
    expect(formatDb(-17.994)).toBe('-18.0')
    expect(formatDb(-Infinity)).toBe('-inf')
  })
})
