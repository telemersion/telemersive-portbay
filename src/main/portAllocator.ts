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

// RX-side of the paired-slot topology from spec §8.7:
// slot 2 (TX) ↔ slot 6 (RX) for video, slot 4 (TX) ↔ slot 8 (RX) for audio.
// The udpproxy/switchboard forwards TX→RX for router-based modes.
export function allocateUgRxPorts(roomId: number, channelIndex: number): UgPorts {
  const base = portBase(roomId, channelIndex)
  return {
    videoPort: base + 6,
    audioPort: base + 8
  }
}

export function allocateStageControlPort(roomId: number): number {
  return roomId * 1000 + 902
}

// MoCap/NatNet uses a one2manyBi proxy:
//   base + 0 = listen_port  — source-client sends TO the router (outputPort)
//   base + 1 = many_port    — sink-clients receive FROM the router (inputPort);
//              sink-clients must send periodic heartbeat packets to stay registered.
export interface MocapPorts {
  outputPort: number
  inputPort: number
}

export function allocateMocapLocalPorts(channelIndex: number): MocapPorts {
  const base = portBase(LOCAL_PREFIX, channelIndex)
  return {
    outputPort: base + 0,
    inputPort: base + 1
  }
}

export function allocateMocapRoomPorts(roomId: number, channelIndex: number): MocapPorts {
  const base = portBase(roomId, channelIndex)
  return {
    outputPort: base + 0,
    inputPort: base + 1
  }
}
