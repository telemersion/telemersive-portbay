// Activity-log entry shape, shared by main (logBus) and renderer (LogPanel).

export type LogKind = 'sub' | 'unsub' | 'pub' | 'recv' | 'event' | 'warn' | 'error'

// 'data'      — room data-plane topics (/peer/..., the Max-compatible protocol)
// 'bus'       — telemersive-bus control traffic with the room manager
//               (broker connect, roomCreate/roomAccess handshake, peer join/leave)
// 'keepalive' — periodic bus traffic (room alive pings, speed pings); kept in
//               its own bucket so it can't evict handshake entries
export type LogSource = 'data' | 'bus' | 'keepalive'

export interface LogEntry {
  seq: number
  ts: number
  source: LogSource
  kind: LogKind
  topic: string
  value?: string
  retained?: boolean
}

export const LOG_CAP_PER_SOURCE = 500

// Appends `entry` and evicts the oldest entry of the same source once that
// source exceeds `cap`, so a chatty source never pushes out a quiet one.
export function pushCapped(buf: LogEntry[], entry: LogEntry, cap = LOG_CAP_PER_SOURCE): void {
  buf.push(entry)
  let count = 0
  for (const e of buf) if (e.source === entry.source) count++
  if (count > cap) buf.splice(buf.findIndex(e => e.source === entry.source), 1)
}
