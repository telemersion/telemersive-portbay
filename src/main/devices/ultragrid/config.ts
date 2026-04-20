export interface UltraGridConfig {
  audioVideo: {
    videoCapture: {
      type: string
      texture: { menu: { selection: string } }
      ndi: { menu: { selection: string } }
      custom: { customFlags: { flags: string } }
      advanced: {
        compress: { codec: string; bitrate: string }
        texture: { fps: string }
        filter: { params: string }
      }
    }
    videoReciever: {
      type: string
      texture: { name: string; closedWindow: string }
      ndi: { name: string }
      custom: { customFlags: { flags: string } }
      advanced: { postprocessor: { params: string } }
    }
    audioCapture: {
      type: string
      portaudio: { menu: { selection: string } }
      coreaudio: { menu: { selection: string } }
      wasapi: { menu: { selection: string } }
      jack: { menu: { selection: string } }
      testcard: { frequency: string; volume: string }
      custom: { customFlags: { flags: string } }
      advanced: {
        compress: { codec: string; bitrate: string; samplerate: string }
        channels: { channels: string }
      }
    }
    audioReceiver: {
      type: string
      portaudio: { menu: { selection: string } }
      coreaudio: { menu: { selection: string } }
      wasapi: { menu: { selection: string } }
      jack: { menu: { selection: string } }
      custom: { customFlags: { flags: string } }
      advanced: { channels: { params: string } }
    }
    advanced: {
      custom: { customFlags: { flags: string } }
      advanced: {
        params: { params: string }
        encryption: { key: string }
      }
    }
    connection: string
    transmission: string
  }
  network: {
    mode: string
    holepuncher: { stunServer: string }
    local: { customSending: string }
    ports: { alternativeChannel: string; receiveChannel: string }
  }
  monitor: {
    log: string
    monitorGate: string
  }
  remoteValues: {
    local_os: string
  }
  enable: string
  print_cli: string
}

export function defaultUltraGridConfig(): UltraGridConfig {
  return {
    audioVideo: {
      videoCapture: {
        type: '0',
        texture: { menu: { selection: '-default-' } },
        ndi: { menu: { selection: '-default-' } },
        custom: { customFlags: { flags: '-none-' } },
        advanced: {
          compress: { codec: '2', bitrate: '10' },
          texture: { fps: '0' },
          filter: { params: '-none-' }
        }
      },
      videoReciever: {
        type: '0',
        texture: { name: 's_channel_0', closedWindow: '0' },
        ndi: { name: 's_channel_0' },
        custom: { customFlags: { flags: '-none-' } },
        advanced: { postprocessor: { params: '-none-' } }
      },
      audioCapture: {
        type: '0',
        portaudio: { menu: { selection: '-default-' } },
        coreaudio: { menu: { selection: '-default-' } },
        wasapi: { menu: { selection: '-default-' } },
        jack: { menu: { selection: '-default-' } },
        testcard: { frequency: '440', volume: '-18' },
        custom: { customFlags: { flags: '-none-' } },
        advanced: {
          compress: { codec: '1', bitrate: '64000', samplerate: '32000' },
          channels: { channels: '1' }
        }
      },
      audioReceiver: {
        type: '0',
        portaudio: { menu: { selection: '-default-' } },
        coreaudio: { menu: { selection: '-default-' } },
        wasapi: { menu: { selection: '-default-' } },
        jack: { menu: { selection: '-default-' } },
        custom: { customFlags: { flags: '-none-' } },
        advanced: { channels: { params: '-none-' } }
      },
      advanced: {
        custom: { customFlags: { flags: '-none-' } },
        advanced: {
          params: { params: '-none-' },
          encryption: { key: '-none-' }
        }
      },
      connection: '2',
      transmission: '2'
    },
    network: {
      mode: '1',
      holepuncher: { stunServer: 'stun4.l.google.com:19302' },
      local: { customSending: '0.0.0.0:0' },
      ports: { alternativeChannel: '0', receiveChannel: '0' }
    },
    monitor: {
      log: '0',
      monitorGate: '0'
    },
    remoteValues: {
      local_os: 'mac'
    },
    enable: '0',
    print_cli: '0'
  }
}

const CONFIG_SUBPATHS: ReadonlySet<string> = new Set([
  'audioVideo/videoCapture/type',
  'audioVideo/videoCapture/texture/menu/selection',
  'audioVideo/videoCapture/ndi/menu/selection',
  'audioVideo/videoCapture/custom/customFlags/flags',
  'audioVideo/videoCapture/advanced/compress/codec',
  'audioVideo/videoCapture/advanced/compress/bitrate',
  'audioVideo/videoCapture/advanced/texture/fps',
  'audioVideo/videoCapture/advanced/filter/params',
  'audioVideo/videoReciever/type',
  'audioVideo/videoReciever/texture/name',
  'audioVideo/videoReciever/texture/closedWindow',
  'audioVideo/videoReciever/ndi/name',
  'audioVideo/videoReciever/custom/customFlags/flags',
  'audioVideo/videoReciever/advanced/postprocessor/params',
  'audioVideo/audioCapture/type',
  'audioVideo/audioCapture/portaudio/menu/selection',
  'audioVideo/audioCapture/coreaudio/menu/selection',
  'audioVideo/audioCapture/wasapi/menu/selection',
  'audioVideo/audioCapture/jack/menu/selection',
  'audioVideo/audioCapture/testcard/frequency',
  'audioVideo/audioCapture/testcard/volume',
  'audioVideo/audioCapture/custom/customFlags/flags',
  'audioVideo/audioCapture/advanced/compress/codec',
  'audioVideo/audioCapture/advanced/compress/bitrate',
  'audioVideo/audioCapture/advanced/compress/samplerate',
  'audioVideo/audioCapture/advanced/channels/channels',
  'audioVideo/audioReceiver/type',
  'audioVideo/audioReceiver/portaudio/menu/selection',
  'audioVideo/audioReceiver/coreaudio/menu/selection',
  'audioVideo/audioReceiver/wasapi/menu/selection',
  'audioVideo/audioReceiver/jack/menu/selection',
  'audioVideo/audioReceiver/custom/customFlags/flags',
  'audioVideo/audioReceiver/advanced/channels/params',
  'audioVideo/advanced/custom/customFlags/flags',
  'audioVideo/advanced/advanced/params/params',
  'audioVideo/advanced/advanced/encryption/key',
  'audioVideo/connection',
  'audioVideo/transmission',
  'network/mode',
  'network/holepuncher/stunServer',
  'network/local/customSending',
  'network/ports/alternativeChannel',
  'network/ports/receiveChannel',
  'monitor/log',
  'monitor/monitorGate',
  'remoteValues/local_os',
  'enable',
  'print_cli'
])

const TRANSIENT_SUBPATHS: ReadonlySet<string> = new Set([
  'description',
  'indicators',
  'updateMenu'
])

export function isConfigSubpath(subpath: string): boolean {
  return CONFIG_SUBPATHS.has(subpath)
}

export function isTransientSubpath(subpath: string): boolean {
  return TRANSIENT_SUBPATHS.has(subpath)
}

export function applyTopicChange(
  config: UltraGridConfig,
  subpath: string,
  value: string
): UltraGridConfig {
  if (!CONFIG_SUBPATHS.has(subpath)) return config

  const next = structuredClone(config) as UltraGridConfig
  const parts = subpath.split('/')
  let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
  return next
}

export function snapshotTopics(
  config: UltraGridConfig
): Array<{ subpath: string; value: string }> {
  const out: Array<{ subpath: string; value: string }> = []
  for (const subpath of CONFIG_SUBPATHS) {
    const parts = subpath.split('/')
    let cursor: unknown = config
    for (const part of parts) {
      cursor = (cursor as Record<string, unknown>)[part]
    }
    out.push({ subpath, value: cursor as string })
  }
  return out
}
