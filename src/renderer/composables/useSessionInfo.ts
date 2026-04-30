import { ref } from 'vue'

const brokerHost = ref('telemersion.zhdk.ch')
const roomId = ref(0)

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  window.api.invoke('settings:load').then((settings: any) => {
    if (settings?.brokerUrl) brokerHost.value = settings.brokerUrl
  })

  window.api.invoke('bus:state').then((s: any) => {
    if (typeof s?.roomId === 'number') roomId.value = s.roomId
  })

  window.api.invoke('bus:localPeer').then((info: any) => {
    if (typeof info?.roomId === 'number') roomId.value = info.roomId
  })

  window.api.on('peer:room:id', (id: number) => { roomId.value = id })
}

export function useSessionInfo() {
  init()
  return { brokerHost, roomId }
}
