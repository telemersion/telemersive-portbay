export const topics = {
  channelLoaded(peerId: string, channel: number): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/loaded`
  },

  deviceGui(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/${field}`
  },

  localudp(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/localudp/${field}`
  },

  monitor(peerId: string, channel: number, field: string): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/monitor/${field}`
  },

  settings(peerId: string, subpath: string): string {
    return `/peer/${peerId}/settings/${subpath}`
  },

  deviceSubscribe(peerId: string, channel: number): string {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/#`
  },

  loadedSubscribe(peerId: string): string {
    return `/peer/${peerId}/rack/+/+/loaded`
  },

  settingsSubscribe(peerId: string): string {
    return `/peer/${peerId}/settings/#`
  }
}

export type ParsedTopic =
  | { peerId: string; type: 'loaded'; channelIndex: number; value: undefined }
  | { peerId: string; type: 'device'; channelIndex: number; subpath: string }
  | { peerId: string; type: 'settings'; subpath: string }
  | null

const CHANNEL_RE = /^\/peer\/([^/]+)\/rack\/page_0\/channel\.(\d+)\/(.+)$/
const SETTINGS_RE = /^\/peer\/([^/]+)\/settings\/(.+)$/

export function parseTopic(topic: string): ParsedTopic {
  let match = CHANNEL_RE.exec(topic)
  if (match) {
    const peerId = match[1]
    const channelIndex = parseInt(match[2], 10)
    const rest = match[3]

    if (rest === 'loaded') {
      return { peerId, type: 'loaded', channelIndex, value: undefined }
    }

    if (rest.startsWith('device/')) {
      return { peerId, type: 'device', channelIndex, subpath: rest.slice('device/'.length) }
    }

    return null
  }

  match = SETTINGS_RE.exec(topic)
  if (match) {
    return { peerId: match[1], type: 'settings', subpath: match[2] }
  }

  return null
}

export type Backend =
  | 'textureCapture'
  | 'ndi'
  | 'portaudioCapture'
  | 'portaudioReceive'
  | 'coreaudioCapture'
  | 'coreaudioReceive'
  | 'wasapiCapture'
  | 'wasapiReceive'
  | 'jackCapture'
  | 'jackReceive'

const BACKEND_TOPIC_TAIL: Record<Backend, string> = {
  textureCapture: 'localMenus/textureCaptureRange',
  ndi: 'localMenus/ndiRange',
  portaudioCapture: 'localMenus/portaudioCaptureRange',
  portaudioReceive: 'localMenus/portaudioReceiveRange',
  coreaudioCapture: 'localMenus/coreaudioCaptureRange',
  coreaudioReceive: 'localMenus/coreaudioReceiveRange',
  wasapiCapture: 'localMenus/wasapiCaptureRange',
  wasapiReceive: 'localMenus/wasapiReceiveRange',
  jackCapture: 'localMenus/jackCaptureRange',
  jackReceive: 'localMenus/jackReceiveRange'
}

const BACKEND_FALLBACK: Record<Backend, string> = {
  textureCapture: '-default-',
  ndi: '-default-',
  portaudioCapture: '0',
  portaudioReceive: '0',
  coreaudioCapture: '0',
  coreaudioReceive: '0',
  wasapiCapture: '0',
  wasapiReceive: '0',
  jackCapture: '0',
  jackReceive: '0'
}

const UG_REFRESH_TAIL: Record<Backend, string> = {
  textureCapture: 'localProps/ug_refresh_textureCapture',
  ndi: 'localProps/ug_refresh_ndi',
  portaudioCapture: 'localProps/ug_refresh_portaudioCapture',
  portaudioReceive: 'localProps/ug_refresh_portaudioReceive',
  coreaudioCapture: 'localProps/ug_refresh_coreaudioCapture',
  coreaudioReceive: 'localProps/ug_refresh_coreaudioReceive',
  wasapiCapture: 'localProps/ug_refresh_wasapiCapture',
  wasapiReceive: 'localProps/ug_refresh_wasapiReceive',
  jackCapture: 'localProps/ug_refresh_jackCapture',
  jackReceive: 'localProps/ug_refresh_jackReceive'
}

const REFRESH_TAIL_TO_BACKEND: Record<string, Backend> = Object.fromEntries(
  (Object.entries(UG_REFRESH_TAIL) as [Backend, string][]).map(([b, tail]) => [tail, b])
) as Record<string, Backend>

export function backendTopic(peerId: string, backend: Backend): string {
  return topics.settings(peerId, BACKEND_TOPIC_TAIL[backend])
}

export function backendFallback(backend: Backend): string {
  return BACKEND_FALLBACK[backend]
}

export function ugEnableTopic(peerId: string): string {
  return topics.settings(peerId, 'localProps/ug_enable')
}

export function refreshTopic(peerId: string, backend: Backend): string {
  return topics.settings(peerId, UG_REFRESH_TAIL[backend])
}

export function backendFromRefreshTopic(peerId: string, topic: string): Backend | null {
  const parsed = parseTopic(topic)
  if (!parsed || parsed.type !== 'settings') return null
  if (parsed.peerId !== peerId) return null
  return REFRESH_TAIL_TO_BACKEND[parsed.subpath] ?? null
}

export function applicableBackends(): Backend[] {
  const all: Backend[] = [
    'textureCapture',
    'ndi',
    'portaudioCapture',
    'portaudioReceive'
  ]
  if (process.platform === 'darwin') {
    all.push('coreaudioCapture', 'coreaudioReceive')
  }
  if (process.platform === 'linux') {
    all.push('jackCapture', 'jackReceive')
  }
  if (process.platform === 'win32') {
    all.push('wasapiCapture', 'wasapiReceive')
  }
  return all
}
