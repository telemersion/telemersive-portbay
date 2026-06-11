import { reactive } from 'vue'

export interface SwitchboardClientInfo {
  role: string
  last_seen: number
}

export interface ProxyEntry {
  port: number
  offset: number
  running: boolean
  pid: number
  packets_in: number
  bytes_in: number
  packets_out: number
  bytes_out: number
  clients: Record<string, SwitchboardClientInfo>
}

export interface SwitchboardStatePayload {
  roomId: number
  error: boolean
  channels: Record<number, ProxyEntry[]>
}

export function createSwitchboardState() {
  const state = reactive<SwitchboardStatePayload>({ roomId: 0, error: false, channels: {} })

  function applyUpdate(payload: SwitchboardStatePayload): void {
    state.roomId = payload.roomId
    state.error = payload.error
    state.channels = payload.channels
  }

  function proxiesForChannel(channelIndex: number): ProxyEntry[] {
    return state.channels[channelIndex] ?? []
  }

  return { state, applyUpdate, proxiesForChannel }
}

export type SwitchboardState = ReturnType<typeof createSwitchboardState>

let singleton: SwitchboardState | null = null

export function useSwitchboardState(): SwitchboardState {
  if (!singleton) singleton = createSwitchboardState()
  return singleton
}
