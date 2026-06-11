import { reactive, computed } from 'vue'
import type { UpdateStatus } from '../../shared/updateStatus'

const state = reactive<{ status: UpdateStatus }>({ status: { state: 'idle' } })

let initialized = false

export function initUpdater(): void {
  if (initialized) return
  initialized = true
  window.api.on('update:status', (s: UpdateStatus) => {
    state.status = s
  })
  window.api.invoke('update:get-status').then((s: UpdateStatus) => {
    state.status = s
  })
}

export async function checkForUpdates(): Promise<void> {
  await window.api.invoke('update:check')
}

export async function downloadUpdate(): Promise<void> {
  await window.api.invoke('update:download')
}

export async function installUpdate(): Promise<void> {
  await window.api.invoke('update:install')
}

export const updaterState = state

export const hasUpdateAvailable = computed(() => {
  return state.status.state === 'available' || state.status.state === 'downloaded'
})
