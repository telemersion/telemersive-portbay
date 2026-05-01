import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface Settings {
  peerName: string
  peerColor: string
  brokerUrl: string
  brokerPort: number
  brokerUser: string
  brokerPwd: string
  lastRoomName: string
  lastRoomPwd: string
  panelRowHeight: number
  settingsVersion: number
  appVersion: string
  ugPath: string
  natnetOscPath: string
  lastCompatCheckAt: number | null
}

const DEFAULTS: Settings = {
  peerName: '',
  peerColor: '',
  brokerUrl: 'telemersion.zhdk.ch',
  brokerPort: 3883,
  brokerUser: 'peer',
  brokerPwd: 'telemersion2021',
  lastRoomName: '',
  lastRoomPwd: '',
  panelRowHeight: 320,
  settingsVersion: 1,
  appVersion: '',
  ugPath: '',
  natnetOscPath: '',
  lastCompatCheckAt: null
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULTS }

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): void {
  const path = settingsPath()
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
