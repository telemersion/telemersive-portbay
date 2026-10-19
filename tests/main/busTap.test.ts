import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  isDataPlaneTopic, classifyBusTopic, describePayload, installBusTap, logBusCallback
} from '../../src/main/busTap'
import { getLogBuffer, clearLogBuffer } from '../../src/main/logBus'

const { PeerCredentials, RoomAccess } = require('telemersive-bus/lib/protos/BusMessages.js')
const BusMsgPub = require('telemersive-bus/lib/msg/BusMsgPub')
const BusMsgSub = require('telemersive-bus/lib/msg/BusMsgSub')

describe('topic classification', () => {
  it('recognises data-plane topics', () => {
    expect(isDataPlaneTopic('tBus/rooms/lab/mqtt/peer/abc/settings/x')).toBe(true)
    expect(isDataPlaneTopic('tBus/rooms/lab/info')).toBe(false)
    expect(isDataPlaneTopic('tBus/roomCreate')).toBe(false)
  })

  it('separates keepalive from handshake traffic', () => {
    expect(classifyBusTopic('tBus/rooms/lab/alive')).toBe('keepalive')
    expect(classifyBusTopic('tBus/rooms/lab/alive/ping')).toBe('keepalive')
    expect(classifyBusTopic('tBus/rooms/lab/speed')).toBe('keepalive')
    expect(classifyBusTopic('tBus/peers/abc/speed/ping')).toBe('keepalive')
    expect(classifyBusTopic('tBus/roomCreate')).toBe('bus')
    expect(classifyBusTopic('tBus/peers/abc:xyz/roomAccess')).toBe('bus')
    expect(classifyBusTopic('tBus/rooms/lab/peers/abc/joined')).toBe('bus')
  })
})

describe('describePayload', () => {
  it('decodes protobuf and redacts credentials', () => {
    const msg = new BusMsgPub('tBus/roomCreate', PeerCredentials, 1, false).encode({
      timestamp: 1700000000, protocolVersion: '1', peerId: 'abc', peerName: 'alice',
      roomName: 'lab', roomPwd: 'deadbeef12', localIpV4: 'U2FsdGVk...', publicIpV4: 'U2FsdGVk...',
      clientId: 'abc:deadbeef12', appVersion: 'TeGateway_v0612'
    })
    const s = describePayload(msg.class, msg.type, msg.payload)
    expect(s).toContain('peerName=alice')
    expect(s).toContain('roomName=lab')
    expect(s).toContain('roomPwd=***')
    expect(s).toContain('clientId=abc:***')
    expect(s).toContain('localIpV4=<enc>')
    expect(s).not.toContain('deadbeef12')
    expect(s).not.toContain('userData')
  })

  it('keeps false booleans (access denied must be visible)', () => {
    const msg = new BusMsgPub('x', RoomAccess, 1, false).encode({ access: false, reason: 'wrong password' })
    const s = describePayload(msg.class, msg.type, msg.payload)
    expect(s).toContain('access=false')
    expect(s).toContain('reason=wrong password')
  })
})

function fakeBusClient() {
  const published: any[] = []
  const handled: string[] = []
  const mqttClient = new EventEmitter()
  const net: any = {
    host: 'mqtt://broker', port: 1883, clientID: 'abc:deadbeef12',
    onMessage: null,
    setMessageCallbackFunction(cb: any) { net.onMessage = cb },
    connect: async () => { net.mqttClient = mqttClient },
    disconnect: async () => {},
    subscribe: async () => true,
    unsubscribe: async () => true,
    publish: async () => true
  }
  const subs: Record<string, any> = {
    'tBus/peers/abc:deadbeef12/roomAccess': new BusMsgSub('tBus/peers/abc:deadbeef12/roomAccess', null, RoomAccess, 2)
  }
  const comm: any = {
    networkBus: net,
    publish: async (m: any) => { published.push(m) },
    findSubscription: (t: string) => subs[t] ?? null
  }
  net.setMessageCallbackFunction((t: string) => handled.push(t))
  return { client: { communicator: comm }, comm, net, mqttClient, published, handled }
}

describe('installBusTap', () => {
  beforeEach(() => clearLogBuffer())

  it('logs connect, subscriptions and handshake, skipping data plane', async () => {
    const f = fakeBusClient()
    installBusTap(f.client)

    await f.net.connect({ topic: 'tBus/peerLeaving' })
    await f.net.subscribe(2, 'tBus/peers/abc:deadbeef12/roomAccess')
    await f.net.subscribe(0, 'tBus/rooms/lab/mqtt/peer/abc/settings/#')
    await f.comm.publish(new BusMsgPub('tBus/roomCreate', PeerCredentials, 1, false).encode({ peerName: 'alice' }))

    const access = new BusMsgPub('x', RoomAccess, 1, false).encode({ access: true, roomId: 11, roomName: 'lab' })
    f.net.onMessage('tBus/peers/abc:deadbeef12/roomAccess', access.payload, { retain: false })
    f.net.onMessage('tBus/rooms/lab/mqtt/peer/abc/x', Buffer.from('[1]'), { retain: true })

    const log = getLogBuffer()
    expect(log.map(e => `${e.source}:${e.kind}:${e.topic}`)).toEqual([
      'bus:event:connect mqtt://broker:1883',
      'bus:event:broker connected',
      'bus:sub:tBus/peers/abc:deadbeef12/roomAccess',
      'bus:pub:tBus/roomCreate',
      'bus:recv:tBus/peers/abc:deadbeef12/roomAccess'
    ])
    expect(log[0].value).toBe('clientId=abc:*** will=tBus/peerLeaving')
    expect(log[4].value).toContain('access=true')
    expect(log[4].value).toContain('roomId=11')

    // library handlers still run, including for data-plane messages
    expect(f.handled).toEqual(['tBus/peers/abc:deadbeef12/roomAccess', 'tBus/rooms/lab/mqtt/peer/abc/x'])
    expect(f.published).toHaveLength(1)

    f.mqttClient.emit('offline')
    expect(getLogBuffer().at(-1)).toMatchObject({ kind: 'warn', topic: 'broker offline' })
  })

  it('logs bus callback events, skipping list-rebuild chatter', () => {
    logBusCallback(['peer', 'joined', 1])
    logBusCallback(['peers', 'menu', 'clear'])
    logBusCallback(['rooms', 'done'])
    logBusCallback(['error', 'peer', 'join access declined - wrong password'])
    expect(getLogBuffer().map(e => `${e.kind}:${e.topic}`)).toEqual([
      'event:peer joined 1',
      'error:error peer join access declined - wrong password'
    ])
  })
})
