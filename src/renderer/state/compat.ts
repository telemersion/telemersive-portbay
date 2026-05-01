import { reactive, computed } from 'vue'
import type { CompatStatus } from '../../shared/toolRequirements'
import { isAllOk } from '../../shared/toolRequirements'

interface CompatState {
  status: CompatStatus | null
  loading: boolean
}

const state = reactive<CompatState>({ status: null, loading: false })

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, cb: (...args: any[]) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

let initialized = false

export function initCompat(): void {
  if (initialized) return
  initialized = true
  window.api.on('compat:status', (s: CompatStatus) => {
    state.status = s
    state.loading = false
  })
  refreshCompat()
}

export async function refreshCompat(): Promise<void> {
  state.loading = true
  try {
    state.status = await window.api.invoke('compat:get-status')
  } finally {
    state.loading = false
  }
}

export async function recheckCompat(): Promise<void> {
  state.loading = true
  try {
    state.status = await window.api.invoke('compat:recheck')
  } finally {
    state.loading = false
  }
}

export async function locateTool(toolId: 'ultragrid' | 'natnetOsc'): Promise<void> {
  state.loading = true
  try {
    const result = await window.api.invoke('compat:locate', toolId)
    if (result) state.status = result
  } finally {
    state.loading = false
  }
}

export async function openDownloadPage(toolId: 'ultragrid' | 'natnetOsc'): Promise<void> {
  await window.api.invoke('compat:open-download', toolId)
}

export async function revealToolsFolder(): Promise<void> {
  await window.api.invoke('compat:reveal-tools-folder')
}

export const compatState = state

export const hasCompatIssues = computed(() => {
  if (!state.status) return false
  return !isAllOk(state.status)
})
