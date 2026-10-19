import type { SwitchboardHealth, SwitchboardRoomState } from './switchboardClient'

// Turns successive switchboard polls into log-worthy changes: the switchboard
// restarting, the room missing ports, relays stopping, recovering or being
// revived by the switchboard's supervisor. The switchboard keeps no history we
// can read, so everything here is derived by diffing one poll against the last.

export type WatchKind = 'event' | 'warn' | 'error'
export type WatchEmit = (kind: WatchKind, message: string, detail?: string) => void

// The ports the manager builds for a room — mirrors roomProxyDefinitions() in
// telemersive-bus lib/BusManager.js (20 channels × 4 relays + 2 Stage Control).
export function expectedRoomPorts(roomId: number): number[] {
  const base = roomId * 1000
  const ports: number[] = []
  for (let ch = 0; ch < 20; ch++) {
    for (const offset of [9, 2, 4, 0]) ports.push(base + ch * 10 + offset)
  }
  ports.push(base + 902, base + 900)
  return ports
}

const OFFSET_LABELS: Record<number, string> = {
  9: 'OSC',
  2: 'UltraGrid video',
  4: 'UltraGrid audio / NatNet data',
  0: 'NatNet control'
}

export function describePort(port: number, roomId: number): string {
  const rel = port - roomId * 1000
  if (rel === 900) return `${port} (Open Stage Control)`
  if (rel === 902) return `${port} (Stage Control OSC relay)`
  if (rel < 0 || rel >= 200) return String(port)
  const label = OFFSET_LABELS[rel % 10]
  return `${port} (ch ${Math.floor(rel / 10)}${label ? ' ' + label : ''})`
}

const LIST_MAX = 8

function listPorts(ports: number[], roomId: number): string {
  const shown = ports.slice(0, LIST_MAX).map(p => describePort(p, roomId)).join(', ')
  return ports.length > LIST_MAX ? `${shown}, … (+${ports.length - LIST_MAX} more)` : shown
}

interface PortSnapshot { running: boolean; revivals: number }

export class SwitchboardWatch {
  private room = ''
  private roomId = 0
  private reachable: boolean | null = null
  private instance: string | null = null
  private healthUnsupportedLogged = false
  private ports: Map<number, PortSnapshot> | null = null
  private missingCount = 0

  constructor(private readonly emit: WatchEmit) {}

  // Call when polling (re)starts for a room.
  reset(room: string, roomId: number): void {
    this.room = room
    this.roomId = roomId
    this.reachable = null
    this.instance = null
    this.healthUnsupportedLogged = false
    this.ports = null
    this.missingCount = 0
  }

  observeUnreachable(reason: string): void {
    if (this.reachable === false) return
    this.reachable = false
    this.emit('warn', 'switchboard unreachable', reason)
  }

  // `health` is null when the switchboard has no /health endpoint.
  observeHealth(health: SwitchboardHealth | null): void {
    if (health === null) {
      if (!this.healthUnsupportedLogged) {
        this.healthUnsupportedLogged = true
        this.emit('event', 'switchboard has no /health endpoint (older version) — restart detection unavailable')
      }
      return
    }
    if (!health.instance) return
    if (this.instance !== null && this.instance !== health.instance) {
      this.emit('error', 'switchboard restarted — it forgot every relay of every room until the manager rebuilds them',
        `instance ${this.instance} → ${health.instance}`)
    }
    this.instance = health.instance
  }

  // `state` is the room's proxies; an unknown room (HTTP 404) is passed as {}.
  observeState(state: SwitchboardRoomState): void {
    if (this.reachable === false) this.emit('event', 'switchboard reachable again')
    this.reachable = true

    const current = new Map<number, PortSnapshot>()
    for (const [portStr, proxy] of Object.entries(state)) {
      const port = Number(portStr)
      if (!Number.isFinite(port)) continue
      current.set(port, { running: proxy.running !== false, revivals: proxy.revivals ?? 0 })
    }

    const expected = expectedRoomPorts(this.roomId)
    const missing = expected.filter(p => !current.has(p))

    if (this.ports === null) {
      // First poll for this room: report the baseline.
      if (missing.length === 0) {
        this.emit('event', `switchboard holds all ${expected.length} ports of room '${this.room}'`)
      } else {
        this.emit('warn', `room '${this.room}' is missing ${missing.length} of ${expected.length} ports on the switchboard`,
          listPorts(missing, this.roomId))
      }
      const stopped = [...current].filter(([, s]) => !s.running).map(([p]) => p)
      if (stopped.length > 0) {
        this.emit('error', `${stopped.length} relay(s) not running`, listPorts(stopped, this.roomId))
      }
    } else {
      if (missing.length !== this.missingCount) {
        if (missing.length === 0) {
          this.emit('event', `all ${expected.length} ports of room '${this.room}' present again`)
        } else {
          this.emit('warn', `room '${this.room}' is missing ${missing.length} of ${expected.length} ports on the switchboard`,
            listPorts(missing, this.roomId))
        }
      }
      for (const [port, now] of current) {
        const before = this.ports.get(port)
        if (!before) continue
        const desc = describePort(port, this.roomId)
        if (now.revivals > before.revivals) {
          this.emit('warn', `relay ${desc} crashed and was revived by the switchboard`, `revival ${now.revivals}`)
        } else if (before.running && !now.running) {
          this.emit('error', `relay ${desc} stopped`)
        } else if (!before.running && now.running) {
          this.emit('event', `relay ${desc} running again`)
        }
      }
    }

    this.ports = current
    this.missingCount = missing.length
  }
}
