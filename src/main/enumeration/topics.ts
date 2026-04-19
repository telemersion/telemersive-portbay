import { topics } from '../../shared/topics'

export interface EnumerationResult {
  range: string
  count: number
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

export function backendTopic(peerId: string, backend: Backend): string {
  return topics.settings(peerId, BACKEND_TOPIC_TAIL[backend])
}

export function backendFallback(backend: Backend): string {
  return BACKEND_FALLBACK[backend]
}

export function ugEnableTopic(peerId: string): string {
  return topics.settings(peerId, 'localProps/ug_enable')
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
