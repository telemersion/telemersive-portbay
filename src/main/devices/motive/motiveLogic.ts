// Pure helpers for MotiveDevice. Separated from MotiveDevice.ts so they can be
// unit-tested without touching dgram/Electron.

export const enum MotiveDirection {
  Source = 1,
  Sink = 2
}

export interface MotiveConfig {
  direction: MotiveDirection
  multicastIP: string
  dataPort: number
  cmdPort: number
  interfaceName: string
}

export interface MotiveSibling {
  channelIndex: number
  enabled: boolean
  config: MotiveConfig
}

export type HealthState =
  | 'ok'
  | 'waiting_motive'
  | 'waiting_consumer'
  | 'no_proxy'
  | 'duplicate_source'
  | 'interface_missing'
  | 'port_conflict'

export const DEFAULT_MULTICAST_IP = '239.255.42.99'
export const DEFAULT_DATA_PORT = 1511
export const DEFAULT_CMD_PORT = 1510
export const SOURCE_HANDSHAKE = Buffer.from([8, 8, 8])
export const SINK_HANDSHAKE = Buffer.from([9, 9, 9])
export const HANDSHAKE_INTERVAL_MS = 250

// Tunables for health/state derivation. Exported so tests can use them.
export const NO_DATA_TIMEOUT_MS = 3000
export const HANDSHAKE_OK_WINDOW_MS = 1500

export interface PortConflictInput {
  self: { channelIndex: number; config: MotiveConfig }
  siblings: MotiveSibling[]
}

export interface PortConflict {
  conflictingChannel: number
  reason: 'multicast_pair' | 'cmd_port'
}

// Q15-E: at enable time, refuse to start if another enabled Motive sibling on
// this peer would produce a packet storm via shared multicast group+port or a
// double-bind on the cmd port on the same NIC.
export function findPortConflict(input: PortConflictInput): PortConflict | null {
  const { self, siblings } = input
  for (const sib of siblings) {
    if (sib.channelIndex === self.channelIndex) continue
    if (!sib.enabled) continue

    const sameMulticastPair =
      sib.config.multicastIP === self.config.multicastIP &&
      sib.config.dataPort === self.config.dataPort

    const sameCmdPortOnSameNic =
      sib.config.cmdPort === self.config.cmdPort &&
      sib.config.interfaceName === self.config.interfaceName

    if (sameMulticastPair) {
      return { conflictingChannel: sib.channelIndex, reason: 'multicast_pair' }
    }
    if (sameCmdPortOnSameNic) {
      return { conflictingChannel: sib.channelIndex, reason: 'cmd_port' }
    }
  }
  return null
}

export function formatPortConflict(c: PortConflict, self: MotiveConfig): string {
  if (c.reason === 'multicast_pair') {
    return (
      `Cannot enable: channel ${c.conflictingChannel} is already using ` +
      `${self.multicastIP}:${self.dataPort}. Change multicastIP or dataPort, ` +
      `or disable channel ${c.conflictingChannel} first.`
    )
  }
  return (
    `Cannot enable: channel ${c.conflictingChannel} is already bound to ` +
    `cmdPort ${self.cmdPort} on ${self.interfaceName}. Change cmdPort or ` +
    `interfaceName, or disable channel ${c.conflictingChannel} first.`
  )
}

export interface HealthInput {
  enabled: boolean
  direction: MotiveDirection
  // Timestamps of the most recent observed events; null if never observed.
  lastHandshakeReplyAt: number | null
  lastDataPacketAt: number | null
  lastConsumerCmdAt: number | null   // Sink only
  duplicateSourceDetected: boolean
  interfaceMissing: boolean
  portConflict: boolean
  now: number
}

// Derive the canonical health/state from observation timestamps. Pure function;
// callers feed it the latest tick state.
export function deriveHealthState(input: HealthInput): HealthState {
  if (!input.enabled) return 'ok'
  if (input.portConflict) return 'port_conflict'
  if (input.interfaceMissing) return 'interface_missing'
  if (input.duplicateSourceDetected) return 'duplicate_source'

  const handshakeOk =
    input.lastHandshakeReplyAt !== null &&
    input.now - input.lastHandshakeReplyAt < HANDSHAKE_OK_WINDOW_MS
  if (!handshakeOk) return 'no_proxy'

  if (input.direction === MotiveDirection.Source) {
    const sawData =
      input.lastDataPacketAt !== null &&
      input.now - input.lastDataPacketAt < NO_DATA_TIMEOUT_MS
    if (!sawData) return 'waiting_motive'
    return 'ok'
  }

  // Sink
  const consumerKnown = input.lastConsumerCmdAt !== null
  if (!consumerKnown) return 'waiting_consumer'
  return 'ok'
}

// Reset semantics — Q9-A. Restore everything to defaults except direction.
// Used by both the handler's reset path and the unit tests.
export function defaultsForDirection(direction: MotiveDirection, fallbackInterface: string): MotiveConfig {
  return {
    direction,
    multicastIP: DEFAULT_MULTICAST_IP,
    dataPort: DEFAULT_DATA_PORT,
    cmdPort: DEFAULT_CMD_PORT,
    interfaceName: fallbackInterface
  }
}

export function defaultDescription(direction: MotiveDirection): string {
  return direction === MotiveDirection.Source ? 'Motive Source' : 'Motive Sink'
}
