import { reactive } from 'vue'

interface SessionState {
  connected: boolean
  joined: boolean
}

const state = reactive<SessionState>({ connected: false, joined: false })

let initialized = false

export function initSession(): void {
  if (initialized) return
  initialized = true

  window.api.invoke('bus:state').then((s: any) => {
    if (s) {
      state.connected = !!s.connected
      state.joined = !!s.joined
    }
  })

  window.api.on('broker:connected', (connected: boolean) => {
    state.connected = connected
    if (!connected) state.joined = false
  })

  window.api.on('peer:joined', (joined: boolean) => {
    state.joined = joined
  })
}

export const sessionState = state
