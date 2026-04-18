import { reactive } from 'vue'
import type { RemotePeerInfo } from '../../shared/types'

export interface RosterEntry {
  peerName: string
  localIP: string
  publicIP: string
  joinedAt: number
}

export function createRoster() {
  const entries: Record<string, RosterEntry> = reactive({})

  function addPeer(info: RemotePeerInfo): void {
    entries[info.peerId] = {
      peerName: info.peerName,
      localIP: info.localIP,
      publicIP: info.publicIP,
      joinedAt: Date.now()
    }
  }

  function removePeer(peerId: string): void {
    delete entries[peerId]
  }

  function setLocalPeer(peerId: string, peerName: string, localIP: string, publicIP: string): void {
    entries[peerId] = {
      peerName,
      localIP,
      publicIP,
      joinedAt: Date.now()
    }
  }

  return { entries, addPeer, removePeer, setLocalPeer }
}
