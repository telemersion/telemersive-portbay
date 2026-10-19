import { describe, it, expect, beforeEach } from 'vitest'
import { SwitchboardWatch, expectedRoomPorts, describePort, type WatchKind } from '../../src/main/switchboardWatch'
import type { SwitchboardRoomState, SwitchboardProxyState } from '../../src/main/switchboardClient'

const ROOM_ID = 11

function proxy(running = true, revivals = 0): SwitchboardProxyState {
  return { running, pid: 1, packets_in: 0, bytes_in: 0, packets_out: 0, bytes_out: 0, clients: {}, revivals }
}

function fullRoom(): SwitchboardRoomState {
  const state: SwitchboardRoomState = {}
  for (const p of expectedRoomPorts(ROOM_ID)) state[String(p)] = proxy()
  return state
}

let events: Array<{ kind: WatchKind; message: string; detail?: string }>
let watch: SwitchboardWatch

beforeEach(() => {
  events = []
  watch = new SwitchboardWatch((kind, message, detail) => events.push({ kind, message, detail }))
  watch.reset('lab', ROOM_ID)
})

describe('expectedRoomPorts / describePort', () => {
  it('matches the manager layout of 82 ports', () => {
    const ports = expectedRoomPorts(ROOM_ID)
    expect(ports).toHaveLength(82)
    expect(new Set(ports).size).toBe(82)
    expect(ports).toContain(11009)
    expect(ports).toContain(11192)
    expect(ports).toContain(11900)
  })

  it('names ports by channel and role', () => {
    expect(describePort(11042, ROOM_ID)).toBe('11042 (ch 4 UltraGrid video)')
    expect(describePort(11900, ROOM_ID)).toBe('11900 (Open Stage Control)')
  })
})

describe('SwitchboardWatch', () => {
  it('reports a healthy baseline once, then stays quiet', () => {
    watch.observeState(fullRoom())
    watch.observeState(fullRoom())
    expect(events).toEqual([{ kind: 'event', message: "switchboard holds all 82 ports of room 'lab'", detail: undefined }])
  })

  it('reports missing ports and their return', () => {
    watch.observeState(fullRoom())
    const partial = fullRoom()
    delete partial['11042']
    watch.observeState(partial)
    watch.observeState(partial)
    watch.observeState(fullRoom())
    expect(events.slice(1).map(e => [e.kind, e.message, e.detail])).toEqual([
      ['warn', "room 'lab' is missing 1 of 82 ports on the switchboard", '11042 (ch 4 UltraGrid video)'],
      ['event', "all 82 ports of room 'lab' present again", undefined]
    ])
  })

  it('treats an unknown room (404 → {}) as all ports missing', () => {
    watch.observeState({})
    expect(events[0].kind).toBe('warn')
    expect(events[0].message).toBe("room 'lab' is missing 82 of 82 ports on the switchboard")
    expect(events[0].detail).toContain('(+74 more)')
  })

  it('reports relays stopping, recovering and being revived', () => {
    watch.observeState(fullRoom())
    const s1 = fullRoom(); s1['11009'] = proxy(false)
    watch.observeState(s1)
    const s2 = fullRoom(); s2['11009'] = proxy(true)
    watch.observeState(s2)
    const s3 = fullRoom(); s3['11009'] = proxy(true, 1)
    watch.observeState(s3)
    expect(events.slice(1).map(e => [e.kind, e.message])).toEqual([
      ['error', 'relay 11009 (ch 0 OSC) stopped'],
      ['event', 'relay 11009 (ch 0 OSC) running again'],
      ['warn', 'relay 11009 (ch 0 OSC) crashed and was revived by the switchboard']
    ])
  })

  it('reports reachability changes once each', () => {
    watch.observeUnreachable('ECONNREFUSED')
    watch.observeUnreachable('ECONNREFUSED')
    watch.observeState(fullRoom())
    expect(events.map(e => e.message)).toEqual([
      'switchboard unreachable',
      'switchboard reachable again',
      "switchboard holds all 82 ports of room 'lab'"
    ])
  })

  it('detects a switchboard restart from the instance id', () => {
    watch.observeHealth({ instance: 'a' })
    watch.observeHealth({ instance: 'a' })
    watch.observeHealth({ instance: 'b' })
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('error')
    expect(events[0].detail).toBe('instance a → b')
  })

  it('notes a switchboard without /health once', () => {
    watch.observeHealth(null)
    watch.observeHealth(null)
    expect(events).toHaveLength(1)
  })
})
