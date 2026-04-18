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
