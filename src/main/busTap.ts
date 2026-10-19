import { logEvent, type LogSource } from './logBus'

// Taps telemersive-bus's internal Communicator / MQTTBus so the activity log
// shows the control traffic with the room manager (broker connect + last will,
// roomCreate → roomAccess handshake, peer joined/left, alive pings). The
// library exposes no hooks, so we wrap its instance methods in place. All
// wrappers delegate unchanged; logging failures are swallowed so the tap can
// never break the bus.
//
// Data-plane topics (tBus/rooms/<room>/mqtt/...) are skipped here — they're
// already logged by TBusClient / trackedPublish with room-relative topics.

const BUS_PREFIX = 'tBus/'
const DATA_PLANE = /^tBus\/rooms\/[^/]+\/mqtt(\/|$)/
const KEEPALIVE = /^tBus\/(rooms\/[^/]+\/(alive|speed)(\/|$)|peers\/[^/]+\/speed\/)/
const MAX_VALUE_LEN = 400

// Fields that are AES-encrypted with the room password — opaque in the log.
const ENCRYPTED_FIELDS = new Set(['localIpV4', 'publicIpV4', 'roomUuid'])

export function isDataPlaneTopic(topic: string): boolean {
  return DATA_PLANE.test(topic)
}

// Classifies a topic carrying a pub/recv. Sub/unsub are always 'bus' — the
// alive subscription is part of the join handshake, not periodic noise.
export function classifyBusTopic(topic: string): LogSource {
  return KEEPALIVE.test(topic) ? 'keepalive' : 'bus'
}

function redactClientId(clientId: unknown): string {
  const s = String(clientId ?? '')
  const i = s.indexOf(':')
  return i < 0 ? s : `${s.slice(0, i)}:***`
}

function formatValue(key: string, v: unknown): string | null {
  if (v === '' || v === null || v === undefined) return null
  if (key === 'roomPwd') return '***'
  if (key === 'clientId') return redactClientId(v)
  if (ENCRYPTED_FIELDS.has(key)) return '<enc>'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function formatFields(obj: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const s = formatValue(k, v)
    if (s !== null) parts.push(`${k}=${s}`)
  }
  return parts.join(' ')
}

function truncate(s: string): string {
  return s.length > MAX_VALUE_LEN ? s.slice(0, MAX_VALUE_LEN) + '…' : s
}

// Mirrors BusMsg.type: 1 = protobuf class, 2 = JSON object, 3 = string.
export function describePayload(msgClass: any, type: number, payload: any): string {
  if (payload == null || payload.length === 0) return '(empty)'
  if (type === 1) {
    const decoded = msgClass.decode(payload)
    const obj = msgClass.toObject(decoded, { longs: Number, bytes: String, defaults: true })
    return truncate(formatFields(obj))
  }
  if (type === 2 || type === 3) return truncate(String(payload))
  return `${payload.length} bytes`
}

function safeLog(fn: () => void): void {
  try { fn() } catch { /* never let logging break the bus */ }
}

export function installBusTap(client: any): void {
  const comm = client?.communicator
  const net = comm?.networkBus
  if (!comm || !net) return

  // --- connection lifecycle -------------------------------------------------
  const origConnect = net.connect
  net.connect = async (lastWill: any) => {
    safeLog(() => logEvent({
      source: 'bus', kind: 'event',
      topic: `connect ${net.host}:${net.port}`,
      value: `clientId=${redactClientId(net.clientID)}` + (lastWill ? ` will=${lastWill.topic}` : '')
    }))
    try {
      await origConnect(lastWill)
    } catch (err: any) {
      safeLog(() => logEvent({ source: 'bus', kind: 'error', topic: 'connect failed', value: String(err?.message ?? err?.code ?? err) }))
      throw err
    }
    safeLog(() => {
      logEvent({ source: 'bus', kind: 'event', topic: 'broker connected' })
      const mc = net.mqttClient
      mc.on('connect', () => logEvent({ source: 'bus', kind: 'event', topic: 'broker reconnected' }))
      mc.on('reconnect', () => logEvent({ source: 'bus', kind: 'warn', topic: 'broker reconnecting' }))
      mc.on('offline', () => logEvent({ source: 'bus', kind: 'warn', topic: 'broker offline' }))
      mc.on('close', () => logEvent({ source: 'bus', kind: 'event', topic: 'broker connection closed' }))
    })
  }

  const origDisconnect = net.disconnect
  net.disconnect = async () => {
    safeLog(() => logEvent({ source: 'bus', kind: 'event', topic: 'disconnect' }))
    return origDisconnect()
  }

  // --- subscriptions (MQTTBus level so reconnect resubscribes are visible) ---
  const origSubscribe = net.subscribe
  net.subscribe = async (qos: any, ...topics: string[]) => {
    safeLog(() => {
      for (const t of topics) {
        if (!isDataPlaneTopic(t)) logEvent({ source: 'bus', kind: 'sub', topic: t, value: `qos=${qos}` })
      }
    })
    return origSubscribe(qos, ...topics)
  }

  const origUnsubscribe = net.unsubscribe
  net.unsubscribe = async (...topics: string[]) => {
    safeLog(() => {
      for (const t of topics) {
        if (!isDataPlaneTopic(t)) logEvent({ source: 'bus', kind: 'unsub', topic: t })
      }
    })
    return origUnsubscribe(...topics)
  }

  // --- outgoing (Communicator level — BusMsgPub still carries its proto class)
  const origPublish = comm.publish
  comm.publish = async (msg: any) => {
    safeLog(() => {
      if (typeof msg?.topic === 'string' && msg.topic.startsWith(BUS_PREFIX) && !isDataPlaneTopic(msg.topic)) {
        logEvent({
          source: classifyBusTopic(msg.topic), kind: 'pub', topic: msg.topic,
          value: describePayload(msg.class, msg.type, msg.payload), retained: !!msg.retain
        })
      }
    })
    return origPublish(msg)
  }

  // --- incoming --------------------------------------------------------------
  // MQTTBus attaches `onMessage` to each new mqtt client on connect, so
  // replacing it here (before the first connect) catches every message.
  const origOnMessage = net.onMessage
  net.setMessageCallbackFunction((topic: string, payload: any, packet: any) => {
    safeLog(() => {
      if (isDataPlaneTopic(topic)) return
      let value: string
      if (!payload || payload.length === 0) {
        value = '(empty)'
      } else {
        // findSubscription has a side effect (caches an autogenerated
        // subscription) that the library's own handler performs right after.
        const sub = comm.findSubscription(topic)
        value = sub ? describePayload(sub.class, sub.type, payload) : `${payload.length} bytes (no handler)`
      }
      logEvent({ source: classifyBusTopic(topic), kind: 'recv', topic, value, retained: !!packet?.retain })
    })
    origOnMessage(topic, payload, packet)
  })
}

// Bus callback events (['peer', 'joined', 1], ['error', 'broker', msg], ...)
// → log entries. List-rebuild chatter (peers/rooms 'menu' + 'done') is skipped;
// 'rooms listing' and 'peers remote joined/left' carry the same information.
export function logBusCallback(content: any[]): void {
  if (content.length === 0) return
  if (content[1] === 'menu' || content[1] === 'done') return
  const kind = content[0] === 'error' ? 'error' : content[0] === 'warning' ? 'warn' : 'event'
  const parts = content.map(c => (typeof c === 'string' ? c : JSON.stringify(c)))
  safeLog(() => logEvent({ source: 'bus', kind, topic: parts.join(' ') }))
}
