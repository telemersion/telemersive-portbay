import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  defaultUltraGridConfig,
  applyTopicChange,
  snapshotTopics,
  isConfigSubpath,
  isTransientSubpath
} from '../../../../src/main/devices/ultragrid/config'

describe('UltraGridConfig', () => {
  it('snapshot of defaults round-trips through applyTopicChange', () => {
    const defaults = defaultUltraGridConfig()
    const topics = snapshotTopics(defaults)
    let config = defaultUltraGridConfig()
    for (const { subpath, value } of topics) {
      config = applyTopicChange(config, subpath, value)
    }
    expect(config).toEqual(defaults)
  })

  it('applyTopicChange does not mutate the input config', () => {
    const before = defaultUltraGridConfig()
    const frozen = structuredClone(before)
    applyTopicChange(before, 'network/mode', '4')
    expect(before).toEqual(frozen)
  })

  it('applyTopicChange updates a nested leaf', () => {
    const cfg = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '4')
    expect(cfg.network.mode).toBe('4')
  })

  it('applyTopicChange updates a deeply nested leaf', () => {
    const cfg = applyTopicChange(
      defaultUltraGridConfig(),
      'audioVideo/videoCapture/advanced/compress/bitrate',
      '25'
    )
    expect(cfg.audioVideo.videoCapture.advanced.compress.bitrate).toBe('25')
  })

  it('applyTopicChange ignores unknown subpaths and returns the input', () => {
    const cfg = defaultUltraGridConfig()
    const result = applyTopicChange(cfg, 'some/unknown/path', 'x')
    expect(result).toBe(cfg)
  })

  it('isConfigSubpath recognises real subpaths', () => {
    expect(isConfigSubpath('network/mode')).toBe(true)
    expect(isConfigSubpath('enable')).toBe(true)
    expect(isConfigSubpath('audioVideo/videoReciever/texture/name')).toBe(true)
  })

  it('isConfigSubpath rejects unknown subpaths', () => {
    expect(isConfigSubpath('network/something/else')).toBe(false)
    expect(isConfigSubpath('')).toBe(false)
  })

  it('isTransientSubpath identifies description/indicators/updateMenu', () => {
    expect(isTransientSubpath('description')).toBe(true)
    expect(isTransientSubpath('indicators')).toBe(true)
    expect(isTransientSubpath('updateMenu')).toBe(true)
    expect(isTransientSubpath('enable')).toBe(false)
  })

  it('recognises every config subpath from the captured mode-4 session', () => {
    const capture = readFileSync(
      join(__dirname, '../../../../tests/fixtures/ultragrid/capture-mode4-room11-ch0-raw.txt'),
      'utf8'
    )
    const unrecognised: string[] = []
    for (const line of capture.split('\n')) {
      const match = line.match(/RECV\s+\S+\/device\/gui\/(\S+)/)
      if (!match) continue
      const subpath = match[1]
      if (isConfigSubpath(subpath) || isTransientSubpath(subpath)) continue
      unrecognised.push(subpath)
    }
    expect(unrecognised).toEqual([])
  })

  it('folds all real capture lines into a consistent config', () => {
    const capture = readFileSync(
      join(__dirname, '../../../../tests/fixtures/ultragrid/capture-mode4-room11-ch0-raw.txt'),
      'utf8'
    )
    let config = defaultUltraGridConfig()
    for (const line of capture.split('\n')) {
      const match = line.match(/RECV\s+\S+\/device\/gui\/(\S+)\s+(.*)$/)
      if (!match) continue
      config = applyTopicChange(config, match[1], match[2])
    }
    expect(config.network.mode).toBe('4')
    expect(config.audioVideo.videoReciever.texture.name).toBe('room_channel_0')
    expect(config.audioVideo.videoCapture.texture.menu.selection).toBe("name='Spout Sender'")
    expect(config.audioVideo.audioCapture.portaudio.menu.selection).toContain('Primary Sound Capture Driver')
    expect(config.remoteValues.local_os).toBe('windows')
  })

  it('snapshotTopics returns one entry per known config subpath', () => {
    const topics = snapshotTopics(defaultUltraGridConfig())
    const subpaths = topics.map((t) => t.subpath)
    expect(new Set(subpaths).size).toBe(subpaths.length)
    expect(subpaths).toContain('network/mode')
    expect(subpaths).toContain('enable')
    expect(subpaths).toContain('audioVideo/connection')
  })
})
