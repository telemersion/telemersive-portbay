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
  // How often the switchboard's supervisor restarted this relay. Missing on
  // switchboards that predate the supervisor.
  revivals?: number
}

// Keyed by port number (as string, per the switchboard's JSON response).
export type SwitchboardRoomState = Record<string, SwitchboardProxyState>

export interface SwitchboardHealth {
  // Changes whenever the switchboard process restarts (and forgets its relays).
  instance: string
  uptime?: number
  proxies?: number
  // Proxy count per room.
  rooms?: Record<string, number>
}

export class SwitchboardHttpError extends Error {
  constructor(readonly status: number) {
    super(`switchboard responded ${status}`)
  }
}

export function switchboardBaseUrl(brokerHost: string): string {
  return `http://${brokerHost}:3591`
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new SwitchboardHttpError(res.status)
    return await res.json() as T
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchSwitchboardRoomState(
  baseUrl: string,
  roomName: string,
  timeoutMs = 4000
): Promise<SwitchboardRoomState> {
  return fetchJson<SwitchboardRoomState>(`${baseUrl}/rooms/${encodeURIComponent(roomName)}/state`, timeoutMs)
}

// Returns null when the switchboard has no /health endpoint (older versions).
export async function fetchSwitchboardHealth(
  baseUrl: string,
  timeoutMs = 4000
): Promise<SwitchboardHealth | null> {
  try {
    return await fetchJson<SwitchboardHealth>(`${baseUrl}/health`, timeoutMs)
  } catch (err) {
    if (err instanceof SwitchboardHttpError && err.status === 404) return null
    throw err
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
