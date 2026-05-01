import { reactive } from 'vue'

function ensurePath(obj: any, keys: string[]): any {
  let current = obj
  for (const key of keys) {
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  return current
}

export function createPeerState() {
  const peers: Record<string, any> = reactive({})

  function applyTopic(topic: string, value: string): void {
    const parts = topic.split('/').filter(Boolean)
    if (parts[0] !== 'peer' || parts.length < 3) return

    const peerId = parts[1]
    const rest = parts.slice(2)

    if (!peers[peerId]) {
      peers[peerId] = {}
    }

    const leaf = rest.pop()!
    const parent = ensurePath(peers[peerId], rest)
    parent[leaf] = value
  }

  function removePeer(peerId: string): void {
    delete peers[peerId]
  }

  function clear(): void {
    for (const id of Object.keys(peers)) delete peers[id]
  }

  return { peers, applyTopic, removePeer, clear }
}

export type PeerState = ReturnType<typeof createPeerState>

let singleton: PeerState | null = null

export function usePeerState(): PeerState {
  if (!singleton) singleton = createPeerState()
  return singleton
}
