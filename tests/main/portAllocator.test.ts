import { describe, it, expect } from 'vitest'
import { allocateLocalPorts, allocateRoomPorts, allocateUgPorts } from '../../src/main/portAllocator'

describe('allocateLocalPorts', () => {
  it('always uses prefix 10 for channel 0', () => {
    const ports = allocateLocalPorts(0)
    expect(ports).toEqual({
      outputPortOne: 10008,
      outputPortTwo: 10007,
      inputPort: 10009
    })
  })

  it('always uses prefix 10 for channel 3', () => {
    const ports = allocateLocalPorts(3)
    expect(ports).toEqual({
      outputPortOne: 10038,
      outputPortTwo: 10037,
      inputPort: 10039
    })
  })
})

describe('allocateRoomPorts', () => {
  it('uses roomId as prefix for channel 0', () => {
    const ports = allocateRoomPorts(11, 0)
    expect(ports).toEqual({
      outputPortOne: 11008,
      outputPortTwo: 11007,
      inputPort: 11009
    })
  })

  it('uses roomId as prefix for channel 19', () => {
    const ports = allocateRoomPorts(11, 19)
    expect(ports).toEqual({
      outputPortOne: 11198,
      outputPortTwo: 11197,
      inputPort: 11199
    })
  })
})

describe('allocateUgPorts', () => {
  it('matches captured Max CLI for room 11, channel 0', () => {
    expect(allocateUgPorts(11, 0)).toEqual({ videoPort: 11002, audioPort: 11004 })
  })

  it('matches captured Max CLI for room 11, channel 5', () => {
    expect(allocateUgPorts(11, 5)).toEqual({ videoPort: 11052, audioPort: 11054 })
  })

  it('scales to channel 19', () => {
    expect(allocateUgPorts(11, 19)).toEqual({ videoPort: 11192, audioPort: 11194 })
  })

  it('never collides with OSC room ports on the same channel', () => {
    for (let ch = 0; ch < 20; ch++) {
      const osc = allocateRoomPorts(11, ch)
      const ug = allocateUgPorts(11, ch)
      const oscPorts = [osc.outputPortOne, osc.outputPortTwo, osc.inputPort]
      expect(oscPorts).not.toContain(ug.videoPort)
      expect(oscPorts).not.toContain(ug.audioPort)
    }
  })
})
