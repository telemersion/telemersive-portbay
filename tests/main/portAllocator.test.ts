import { describe, it, expect } from 'vitest'
import { allocateLocalPorts, allocateRoomPorts } from '../../src/main/portAllocator'

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
