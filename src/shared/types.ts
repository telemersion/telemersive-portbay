export type BusEventType =
  | 'broker:connected'
  | 'peer:joined'
  | 'peer:id'
  | 'peer:name'
  | 'peer:localIP'
  | 'peer:publicIP'
  | 'peer:room:name'
  | 'peer:room:id'
  | 'peer:room:uuid'
  | 'rooms:update'
  | 'peers:remote:joined'
  | 'peers:remote:left'
  | 'ready'
  | 'chat'

export interface RemotePeerInfo {
  peerName: string
  peerId: string
  localIP: string
  publicIP: string
}

export interface MqttMessage {
  topic: string
  payload: string
}

export interface BrokerConfig {
  host: string
  port: number
  username: string
  password: string
  localIP: string
}
