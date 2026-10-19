import { describe, it, expect } from 'vitest'
import { pushCapped, type LogEntry, type LogSource } from '../../src/shared/log'

let seq = 0
function entry(source: LogSource): LogEntry {
  return { seq: ++seq, ts: 0, source, kind: 'recv', topic: 't' }
}

describe('pushCapped', () => {
  it('evicts the oldest entry of the same source only', () => {
    const buf: LogEntry[] = []
    const data = entry('data')
    pushCapped(buf, data, 2)
    const ka1 = entry('keepalive')
    pushCapped(buf, ka1, 2)
    pushCapped(buf, entry('keepalive'), 2)
    pushCapped(buf, entry('keepalive'), 2)
    expect(buf).toHaveLength(3)
    expect(buf).toContain(data)
    expect(buf).not.toContain(ka1)
  })

  it('keeps insertion order', () => {
    const buf: LogEntry[] = []
    for (let i = 0; i < 5; i++) pushCapped(buf, entry(i % 2 ? 'bus' : 'data'), 2)
    const seqs = buf.map(e => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
  })
})
