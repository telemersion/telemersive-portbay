import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/updateStatus'

export type { UpdateStatus }

let status: UpdateStatus = { state: 'idle' }
let onStatus: ((status: UpdateStatus) => void) | null = null

function setStatus(next: UpdateStatus): void {
  status = next
  onStatus?.(status)
}

export function initAutoUpdater(callback: (status: UpdateStatus) => void): void {
  onStatus = callback
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => setStatus({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }))
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
