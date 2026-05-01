import { describe, it, expect } from 'vitest'
import {
  allocateLocalPorts,
  allocateRoomPorts,
  allocateUgPorts,
  allocateMotiveRoomPorts
} from '../../src/main/portAllocator'

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

describe('allocateMotiveRoomPorts', () => {
  it('uses cmd=xxcc0, dataTx=xxcc2, dataRx=xxcc6 for room 11 channel 0', () => {
    expect(allocateMotiveRoomPorts(11, 0)).toEqual({
      cmdPort: 11000,
      dataTxPort: 11002,
      dataRxPort: 11006
    })
  })

  it('matches the Processing patches for room 11 channel 0', () => {
    // NatNetPipeLocal.pde:    telematicPort_Cmnd = 11000; telematicPort_Data = 11002
    // NatNetPipeRemote.pde:   telematicPort_Cmnd = 11001; telematicPort_Data = 11006
    // NG's allocator returns the slot-zero side of each pair (cmd Bi shares
    // xxcc0/xxcc1 — Source binds xxcc0, Sink xxcc1; data Mo shares xxcc2/xxcc6
    // — Source pushes xxcc2, Sink receives xxcc6). The handler picks the right
    // side based on direction.
    const motive = allocateMotiveRoomPorts(11, 0)
    expect(motive.cmdPort).toBe(11000)
    expect(motive.dataTxPort).toBe(11002)
    expect(motive.dataRxPort).toBe(11006)
  })

  it('shares xxcc0 with MoCap cmd slot (intended slot reuse)', () => {
    for (let ch = 0; ch < 20; ch++) {
      const mocap = allocateRoomPorts(11, ch)
      const motive = allocateMotiveRoomPorts(11, ch)
      // MoCap allocateRoomPorts uses base+8/+7/+9; Motive uses base+0/+2/+6 —
      // documented as shared with MoCap one2manyBi cmd at base+0/+1.
      // (allocateRoomPorts here is the OSC variant; cross-check is just that
      // the addresses scale correctly with the channel index.)
      expect(motive.cmdPort).toBe(11000 + ch * 10)
      expect(mocap.outputPortOne).toBe(11008 + ch * 10)
    }
  })
})
