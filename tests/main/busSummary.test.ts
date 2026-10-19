import { describe, it, expect } from 'vitest'
import { protoClassForTopic, summarizeBus } from '../../src/main/busSummary'
import { describeBusMessage } from '../../src/main/busTap'

const { RoomAccess, PeerInfo, RoomInfo } = require('telemersive-bus/lib/protos/BusMessages.js')

function encode(cls: any, obj: Record<string, unknown>): Uint8Array {
  return cls.encode(cls.create(obj)).finish()
}

describe('protoClassForTopic', () => {
  it('maps bus topics to their protobuf classes', () => {
    expect(protoClassForTopic('tBus/peers/abc:x/roomAccess')).toBe(RoomAccess)
    expect(protoClassForTopic('tBus/rooms/lab/peers/abc/joined')).toBe(PeerInfo)
    expect(protoClassForTopic('tBus/rooms/lab/alive')).toBe(RoomInfo)
    expect(protoClassForTopic('tBus/rooms/lab/mqtt/peer/x')).toBeNull()
  })
})

describe('summarizeBus', () => {
  it('explains room access answers', () => {
    expect(summarizeBus('recv', 'tBus/peers/a/roomAccess', { access: false, roomName: 'lab', reason: 'password invalid' }))
      .toBe("manager refused access to room 'lab' — password invalid")
    expect(summarizeBus('recv', 'tBus/peers/a/roomAccess', { access: true, roomName: 'lab', roomId: 11, reason: 'no room of this name exists' }))
      .toBe("manager created room 'lab' (id 11) and granted access")
    expect(summarizeBus('recv', 'tBus/peers/a/roomAccess', { access: true, roomName: 'lab', reason: 'confirmation' }))
      .toBe("manager confirmed membership in room 'lab'")
  })

  it('explains room and peer lifecycle, including retained clears', () => {
    expect(summarizeBus('recv', 'tBus/rooms/lab/info', null)).toBe("manager removed room 'lab'")
    expect(summarizeBus('recv', 'tBus/rooms/lab/alive', { roomName: 'lab' }))
      .toBe("manager housekeeping: pinging peers of room 'lab'")
    expect(summarizeBus('recv', 'tBus/rooms/lab/peers/p1/joined', null))
      .toBe("manager cleared join record of peer p1 in room 'lab'")
    expect(summarizeBus('recv', 'tBus/rooms/lab/peers/p1/left', { peerName: 'bob' }))
      .toContain("manager removed peer 'bob' from room 'lab'")
    expect(summarizeBus('recv', 'tBus/rooms/lab/peers/p1/left', null)).toBeUndefined()
  })
})

describe('describeBusMessage', () => {
  it('decodes by topic and redacts', () => {
    const payload = encode(PeerInfo, { peerName: 'bob', roomName: 'lab', localIpV4: 'U2FsdGVk' })
    const { value, summary } = describeBusMessage('recv', 'tBus/rooms/lab/peers/p1/joined', payload)
    expect(value).toContain('peerName=bob')
    expect(value).toContain('localIpV4=<enc>')
    expect(summary).toBe("peer 'bob' joined room 'lab'")
  })

  it('handles empty payloads and unknown topics', () => {
    expect(describeBusMessage('recv', 'tBus/rooms/lab/info', Buffer.alloc(0)))
      .toEqual({ value: '(empty)', summary: "manager removed room 'lab'" })
    expect(describeBusMessage('recv', 'tBus/rooms/lab/osc', Buffer.from('["/x",1]')))
      .toEqual({ value: '["/x",1]' })
  })
})
