// Decodes telemersive-bus control messages by topic and turns them into
// one-line, human-readable log summaries ("manager refused access to 'lab' —
// password invalid"). Decoding is keyed on the topic rather than on the
// library's subscription table, so messages seen on a separate observer
// connection (see busObserver.ts) decode the same way.

let protos: any = null
try {
  protos = require('telemersive-bus/lib/protos/BusMessages.js')
} catch (err) {
  console.error('Failed to load telemersive-bus protos:', err)
}

type Rule = { re: RegExp; cls: string }

// Topic layout from telemersive-bus lib/utils/BusTopics.js (prefix 'tBus').
const RULES: Rule[] = [
  { re: /^tBus\/roomCreate$/, cls: 'PeerCredentials' },
  { re: /^tBus\/peerLeaving$/, cls: 'PeerCredentials' },
  { re: /^tBus\/roomDelete$/, cls: 'RoomInfo' },
  { re: /^tBus\/peers\/[^/]+\/roomAccess$/, cls: 'RoomAccess' },
  { re: /^tBus\/peers\/[^/]+\/speed\/ping$/, cls: 'SpeedPing' },
  { re: /^tBus\/rooms\/[^/]+\/info$/, cls: 'RoomInfo' },
  { re: /^tBus\/rooms\/[^/]+\/alive$/, cls: 'RoomInfo' },
  { re: /^tBus\/rooms\/[^/]+\/alive\/ping$/, cls: 'PeerCredentials' },
  { re: /^tBus\/rooms\/[^/]+\/peers\/[^/]+\/(joined|left)$/, cls: 'PeerInfo' },
  { re: /^tBus\/rooms\/[^/]+\/speed$/, cls: 'SpeedPing' },
  { re: /^tBus\/rooms\/[^/]+\/chat$/, cls: 'ChatHistory' },
  { re: /^tBus\/rooms\/[^/]+\/chat\/msg$/, cls: 'ChatMessage' }
]

// Returns the protobuf class for a bus topic, or null if the topic is unknown.
export function protoClassForTopic(topic: string): any {
  if (!protos) return null
  for (const rule of RULES) {
    if (rule.re.test(topic)) return protos[rule.cls] ?? null
  }
  return null
}

// Decodes a protobuf payload into a plain object (camelCase fields, longs as
// numbers). Returns null for empty payloads (retained clears).
export function decodeProto(cls: any, payload: any): Record<string, unknown> | null {
  if (payload == null || payload.length === 0) return null
  const msg = cls.decode(payload)
  return cls.toObject(msg, { longs: Number, bytes: String, defaults: true })
}

const q = (v: unknown): string => `'${String(v ?? '')}'`

// `obj` is the decoded payload, or null for an empty (retained-clear) payload.
export function summarizeBus(
  dir: 'pub' | 'recv',
  topic: string,
  obj: Record<string, any> | null
): string | undefined {
  const parts = topic.split('/')

  if (topic === 'tBus/roomCreate' && obj) {
    return `join request: peer ${q(obj.peerName)} → room ${q(obj.roomName)}`
  }
  if (topic === 'tBus/peerLeaving' && obj) {
    return `telling manager peer ${q(obj.peerName)} leaves room ${q(obj.roomName)}`
  }
  if (/^tBus\/peers\/[^/]+\/roomAccess$/.test(topic) && obj) {
    if (!obj.access) return `manager refused access to room ${q(obj.roomName)} — ${obj.reason || 'no reason given'}`
    if (obj.reason === 'no room of this name exists') return `manager created room ${q(obj.roomName)} (id ${obj.roomId}) and granted access`
    if (obj.reason === 'confirmation') return `manager confirmed membership in room ${q(obj.roomName)}`
    return `manager granted access to room ${q(obj.roomName)} (id ${obj.roomId})`
  }
  if (/^tBus\/peers\/[^/]+\/speed\/ping$/.test(topic) && obj) {
    return `speed reply from peer ${q(obj.peerName)}`
  }
  if (parts[1] !== 'rooms' || parts.length < 4) return undefined

  const room = parts[2]
  const rest = parts.slice(3).join('/')
  if (rest === 'info') {
    return obj
      ? `room ${q(room)} exists (id ${obj.roomId}, ${obj.appVersion || 'unknown app version'})`
      : `manager removed room ${q(room)}`
  }
  if (rest === 'alive' && obj) return `manager housekeeping: pinging peers of room ${q(room)}`
  if (rest === 'alive/ping' && dir === 'pub') return `answering housekeeping ping of room ${q(room)}`
  if (parts[3] === 'peers' && parts.length === 6) {
    const peer = parts[4]
    if (parts[5] === 'joined') {
      return obj
        ? `peer ${q(obj.peerName)} joined room ${q(room)}`
        : `manager cleared join record of peer ${peer} in room ${q(room)}`
    }
    if (parts[5] === 'left' && obj) {
      return `manager removed peer ${q(obj.peerName)} from room ${q(room)} (left, or did not answer the ping)`
    }
  }
  if (rest === 'speed' && obj) return `speed ping from peer ${q(obj.peerName)}`
  return undefined
}
