import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

describe('normalizeSettings', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'ng-settings-test-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('fills missing fields from DEFAULTS', async () => {
    const { normalizeSettings } = await import('../../../src/main/persistence/settings')
    const normalized = normalizeSettings({ brokerUrl: 'example.org', brokerPort: 1883 })

    expect(normalized.brokerUrl).toBe('example.org')
    expect(normalized.brokerPort).toBe(1883)
    expect(normalized.brokerUser).toBe('') // from DEFAULTS, absent in the opened file
    expect(normalized.panelRowHeight).toBe(320)
  })

  it('does not persist — opening a settings file must not write settings.json', async () => {
    const { normalizeSettings } = await import('../../../src/main/persistence/settings')
    normalizeSettings({ brokerUrl: 'example.org' })
    expect(existsSync(join(userDataDir, 'settings.json'))).toBe(false)
  })

  it('leaves an already-saved settings.json untouched', async () => {
    const { normalizeSettings, saveSettings, loadSettings } = await import(
      '../../../src/main/persistence/settings'
    )
    saveSettings({ ...loadSettings(), brokerUrl: 'original.example' })
    normalizeSettings({ brokerUrl: 'opened.example' })

    const onDisk = JSON.parse(readFileSync(join(userDataDir, 'settings.json'), 'utf-8'))
    expect(onDisk.brokerUrl).toBe('original.example')
  })
})
