// Client for the telemersive-switchboard REST API.
// See https://github.com/telemersion/telemersive-router/blob/master/switchboard/README.md

export interface SwitchboardClientInfo {
  role: string
  last_seen: number
}

export interface SwitchboardProxyState {
  running: boolean
  pid: number
  packets_in: number
  bytes_in: number
  packets_out: number
  bytes_out: number
  clients: Record<string, SwitchboardClientInfo>
}

// Keyed by port number (as string, per the switchboard's JSON response).
export type SwitchboardRoomState = Record<string, SwitchboardProxyState>

export function switchboardBaseUrl(brokerHost: string): string {
  return `http://${brokerHost}:3591`
}

export async function fetchSwitchboardRoomState(
  baseUrl: string,
  roomName: string,
  timeoutMs = 4000
): Promise<SwitchboardRoomState> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/state`, {
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`switchboard responded ${res.status}`)
    return await res.json() as SwitchboardRoomState
  } finally {
    clearTimeout(timer)
  }
}

export interface ProxyEntry extends SwitchboardProxyState {
  port: number
  offset: number
}

// Groups proxies by channel index, derived from the room-port convention
// `roomId*1000 + channelIndex*10 + offset` (see portAllocator.ts).
export function groupProxiesByChannel(
  state: SwitchboardRoomState,
  roomId: number
): Record<number, ProxyEntry[]> {
  const channels: Record<number, ProxyEntry[]> = {}
  for (const [portStr, proxy] of Object.entries(state)) {
    const port = Number(portStr)
    if (!Number.isFinite(port)) continue
    const relative = port - roomId * 1000
    if (relative < 0) continue
    const channelIndex = Math.floor(relative / 10)
    const offset = relative % 10
    const entry: ProxyEntry = { ...proxy, port, offset }
    ;(channels[channelIndex] ??= []).push(entry)
  }
  for (const list of Object.values(channels)) {
    list.sort((a, b) => a.port - b.port)
  }
  return channels
}
