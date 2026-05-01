import { contextBridge, ipcRenderer } from 'electron'

const SEND_CHANNELS = ['bus:configure'] as const
const INVOKE_CHANNELS = [
  'bus:init', 'bus:connect', 'bus:disconnect', 'bus:join', 'bus:leave', 'bus:localPeer', 'bus:state',
  'mqtt:publish', 'mqtt:subscribe', 'mqtt:unsubscribe',
  'settings:load', 'settings:save',
  'settings:get-path', 'settings:reveal', 'settings:open-in-editor',
  'log:get', 'log:clear',
  'geo:lookup',
  'compat:get-status', 'compat:recheck', 'compat:locate',
  'compat:open-download', 'compat:reveal-tools-folder',
  'net:interfaces'
] as const
const RECEIVE_CHANNELS = [
  'broker:connected', 'peer:joined', 'peer:id', 'peer:name',
  'peer:localIP', 'peer:publicIP', 'peer:room:name', 'peer:room:id',
  'peer:room:uuid', 'rooms:clear', 'rooms:append', 'rooms:listing',
  'rooms:done', 'peers:remote:joined', 'peers:remote:left',
  'peers:clear', 'peers:append', 'peers:done',
  'ready', 'mqtt:message', 'chat',
  'log:entry',
  'compat:status',
  'bus:error'
] as const

contextBridge.exposeInMainWorld('api', {
  send(channel: string, ...args: any[]) {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  invoke(channel: string, ...args: any[]) {
    if ((INVOKE_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Channel ${channel} not allowed`))
  },
  on(channel: string, callback: (...args: any[]) => void) {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel)
  }
})
