export interface OscPorts {
  outputPortOne: number
  outputPortTwo: number
  inputPort: number
}

export interface UgPorts {
  videoPort: number
  audioPort: number
}

const LOCAL_PREFIX = 10

function portBase(prefix: number, channelIndex: number): number {
  return prefix * 1000 + channelIndex * 10
}

export function allocateLocalPorts(channelIndex: number): OscPorts {
  const base = portBase(LOCAL_PREFIX, channelIndex)
  return {
    outputPortOne: base + 8,
    outputPortTwo: base + 7,
    inputPort: base + 9
  }
}

export function allocateRoomPorts(roomId: number, channelIndex: number): OscPorts {
  const base = portBase(roomId, channelIndex)
  return {
    outputPortOne: base + 8,
    outputPortTwo: base + 7,
    inputPort: base + 9
  }
}

export function allocateUgPorts(roomId: number, channelIndex: number): UgPorts {
  const base = portBase(roomId, channelIndex)
  return {
    videoPort: base + 2,
    audioPort: base + 4
  }
}
