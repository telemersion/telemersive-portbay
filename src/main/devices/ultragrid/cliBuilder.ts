import type { UltraGridConfig } from './config'
import type { UgPorts } from '../../portAllocator'

export type LocalOs = 'osx' | 'win' | 'linux'

export interface ResolvedMenuIndexes {
  textureCapture: string | null
  ndiCapture: string | null
  audioCapture: number | null
  audioReceive: number | null
}

export interface BuildUvArgsInput {
  config: UltraGridConfig
  ports: UgPorts
  indexes: ResolvedMenuIndexes
  host: string
  textureReceiverName: string
  localOs: LocalOs
}

export function buildUvArgs(input: BuildUvArgsInput): string[] {
  const { config } = input
  const mode = config.network.mode
  const args = mode === '1' ? buildMode1Args(input)
    : mode === '4' ? buildMode4Args(input)
    : null
  if (!args) throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`)
  return args
}

// Gating rules derived from tg.ultragrid.js:
//   transmission_mode: 0=video, 1=audio, 2=both
//   connection_type:   0=send,  1=receive, 2=both
// Mode 1 is always send-only; connection is ignored.
// Mode 4 gates each side on connection and each block-within-side on transmission.

function shouldEmitVideo(transmission: string): boolean {
  return transmission !== '1'
}

function shouldEmitAudio(transmission: string): boolean {
  return transmission !== '0'
}

function shouldEmitSend(connection: string): boolean {
  return connection !== '1'
}

function shouldEmitReceive(connection: string): boolean {
  return connection !== '0'
}

function buildMode1Args(input: BuildUvArgsInput): string[] {
  const { config, ports, indexes, host, localOs } = input
  const transmission = config.audioVideo.transmission
  const args: string[] = ['--param', 'log-color=no']

  if (shouldEmitVideo(transmission)) pushVideoCapture(args, config, indexes, localOs)
  if (shouldEmitAudio(transmission)) pushAudioCapture(args, config, indexes)

  // Single-port -P reuses the video port even for audio-only (Max does this faithfully).
  if (shouldEmitVideo(transmission) && shouldEmitAudio(transmission)) {
    args.push(`-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`)
  } else {
    args.push(`-P${ports.videoPort}`)
  }
  args.push(host)
  return args
}

function buildMode4Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const transmission = config.audioVideo.transmission
  const connection = config.audioVideo.connection
  const args: string[] = ['--param', 'log-color=no']

  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) pushVideoCapture(args, config, indexes, localOs)
    if (shouldEmitAudio(transmission)) pushAudioCapture(args, config, indexes)
  }
  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      args.push('-d', `${textureDisplayPrefix(localOs)}'${textureReceiverName}'`)
    }
    if (shouldEmitAudio(transmission) && indexes.audioReceive !== null) {
      args.push('-r', `portaudio:${indexes.audioReceive}`)
    }
  }
  return args
}

function textureCapturePrefix(localOs: LocalOs): string {
  return localOs === 'win' ? 'spout' : 'syphon'
}

function textureDisplayPrefix(localOs: LocalOs): string {
  return localOs === 'win' ? 'gl:spout=' : 'gl:syphon='
}

function textureFpsFlag(localOs: LocalOs): string {
  return localOs === 'win' ? 'fps' : 'override_fps'
}

function pushVideoCapture(
  args: string[],
  config: UltraGridConfig,
  indexes: ResolvedMenuIndexes,
  localOs: LocalOs
): void {
  const type = config.audioVideo.videoCapture.type
  if (type === '0') {
    let flag = textureCapturePrefix(localOs)
    if (indexes.textureCapture && indexes.textureCapture !== '-default-') {
      flag += `:${indexes.textureCapture}`
    }
    const fps = config.audioVideo.videoCapture.advanced.texture.fps
    if (fps && fps !== '0') flag += `:${textureFpsFlag(localOs)}=${fps}`
    args.push('-t', flag)
  } else if (type === '1') {
    let flag = 'ndi'
    if (indexes.ndiCapture && indexes.ndiCapture !== '-default-') {
      flag += `:${indexes.ndiCapture}`
    }
    args.push('-t', flag)
  }
  const { codec, bitrate } = config.audioVideo.videoCapture.advanced.compress
  if (codec !== '0') {
    args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
  }
}

function pushAudioCapture(
  args: string[],
  config: UltraGridConfig,
  indexes: ResolvedMenuIndexes
): void {
  if (indexes.audioCapture !== null) {
    args.push('-s', `portaudio:${indexes.audioCapture}`)
  }
  const audio = config.audioVideo.audioCapture.advanced
  args.push('--audio-codec', `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`)
  args.push('--audio-capture-format', `channels=${audio.channels.channels}`)
}

// Video codec umenu from Max tg.deviceUG_view.maxpat (line 22391).
// Index 0 (-none-) is deliberately absent here: it means "no -c flag at all",
// which is handled by the caller (see pushVideoCapture).
// Index 1 Max-label is MJPEG but UG 1.10.3 rejects that literal; UG accepts
// "JPEG" instead. Max has shipped this broken for years; we map to JPEG.
// Codec name acceptance re-verified with scripts/probe-uv-codecs.sh — see
// docs/ug-codecs-<version>.txt for the live probe output.
const VIDEO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'JPEG',
  '2': 'H.264',
  '3': 'H.265',
  '4': 'J2K',
  '5': 'AV1',
  '6': 'VP8',
  '7': 'VP9',
  '8': 'HFYU',
  '9': 'FFV1'
}

// Audio codec umenu from Max tg.deviceUG_view.maxpat (line 12555).
// Index 0 means "no --audio-codec flag" — handled by caller.
const AUDIO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'OPUS'
}

function videoCodecName(codec: string): string {
  const name = VIDEO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported video codec id: ${codec}`)
  return name
}

function audioCodecName(codec: string): string {
  const name = AUDIO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported audio codec id: ${codec}`)
  return name
}

export function extractMenuIndex(rangeString: string, selection: string): number | null {
  if (!rangeString || !selection) return null
  for (const entry of rangeString.split('|')) {
    const match = entry.match(/^(\d+)\s+(.+)$/)
    if (!match) continue
    if (entryMatchesSelection(match[2], selection)) return parseInt(match[1], 10)
  }
  return null
}

function entryMatchesSelection(entry: string, selection: string): boolean {
  if (entry === selection) return true
  const selectionWithoutPrefix = selection.replace(/^\d+\s+/, '')
  if (entry === selectionWithoutPrefix) return true
  const entryHead = stripDeviceTail(entry)
  const selectionHead = stripDeviceTail(selectionWithoutPrefix)
  if (!selectionHead) return false
  return entryHead.startsWith(selectionHead)
}

function stripDeviceTail(s: string): string {
  const idx = s.indexOf(' (out:')
  return idx === -1 ? s : s.slice(0, idx)
}
