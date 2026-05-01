import { reactive } from 'vue'
import { usePeerState } from './peerState'
import { useRoster } from './roster'

interface LocalPeer {
  peerId: string
  peerName: string
  localIP: string
  publicIP: string
  roomName: string
  roomId: number | string
}

const state = reactive<LocalPeer>({
  peerId: '',
  peerName: '',
  localIP: '',
  publicIP: '',
  roomName: '',
  roomId: ''
})

let initialized = false

export function initBusWiring(): void {
  if (initialized) return
  initialized = true

  const peerState = usePeerState()
  const roster = useRoster()

  const refreshLocal = (): void => {
    if (state.peerId) {
      roster.setLocalPeer(state.peerId, state.peerName, state.localIP, state.publicIP)
    }
  }

  window.api.invoke('bus:localPeer').then((info: any) => {
    if (info?.peerId) {
      state.peerId = info.peerId
      state.peerName = info.peerName || ''
      state.localIP = info.localIP || ''
      if (typeof info.roomId === 'number') state.roomId = info.roomId
      refreshLocal()
    }
  })

  window.api.invoke('bus:state').then((s: any) => {
    if (s?.roomName) state.roomName = s.roomName
    if (typeof s?.roomId === 'number') state.roomId = s.roomId
  })

  window.api.on('peer:id', (id: string) => {
    state.peerId = id
    refreshLocal()
  })
  window.api.on('peer:name', (name: string) => {
    state.peerName = name
    refreshLocal()
  })
  window.api.on('peer:localIP', (ip: string) => {
    state.localIP = ip
    refreshLocal()
  })
  window.api.on('peer:publicIP', (ip: string) => {
    state.publicIP = ip
    refreshLocal()
  })
  window.api.on('peer:room:name', (name: string) => { state.roomName = name })
  window.api.on('peer:room:id', (id: number) => { state.roomId = id })

  window.api.on('peers:remote:joined', (info: any) => { roster.addPeer(info) })
  window.api.on('peers:remote:left', (info: { peerName: string; peerId: string }) => {
    roster.removePeer(info.peerId)
    peerState.removePeer(info.peerId)
  })
  window.api.on('peers:append', (info: any) => { roster.addPeer(info) })
  window.api.on('peers:clear', () => {
    const local = state.peerId
    for (const id of Object.keys(roster.entries)) {
      if (id !== local) roster.removePeer(id)
    }
  })

  // On leave (peer:joined === false) drop everyone except us, and wipe peer state
  // for remotes so a re-join starts clean and stale colors/devices don't reappear.
  window.api.on('peer:joined', (joined: boolean) => {
    if (joined) return
    const local = state.peerId
    for (const id of Object.keys(roster.entries)) {
      if (id !== local) roster.removePeer(id)
    }
    for (const id of Object.keys(peerState.peers)) {
      if (id !== local) peerState.removePeer(id)
    }
    state.roomName = ''
    state.roomId = ''
  })

  window.api.on('mqtt:message', (msg: { topic: string; payload: string }) => {
    peerState.applyTopic(msg.topic, msg.payload)
  })
}

export const localPeerState = state
