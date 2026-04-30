import { ref } from 'vue'

const brokerHost = ref('telemersion.zhdk.ch')
const roomId = ref(0)
const roomName = ref('')

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  window.api.invoke('settings:load').then((settings: any) => {
    if (settings?.brokerUrl) brokerHost.value = settings.brokerUrl
  })

  window.api.invoke('bus:state').then((s: any) => {
    if (typeof s?.roomId === 'number') roomId.value = s.roomId
    if (s?.roomName) roomName.value = s.roomName
  })

  window.api.invoke('bus:localPeer').then((info: any) => {
    if (typeof info?.roomId === 'number') roomId.value = info.roomId
  })

  window.api.on('peer:room:id', (id: number) => { roomId.value = id })
  window.api.on('peer:room:name', (name: string) => { roomName.value = name })
}

export function useSessionInfo() {
  init()
  return { brokerHost, roomId, roomName }
}
