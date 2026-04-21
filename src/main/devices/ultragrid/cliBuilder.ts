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
  // Retained topic values carry texture/NDI names wrapped in `'...'` as a
  // schema artifact inherited from Max. `child_process.spawn` does no shell
  // parsing, so the quotes would reach `uv` as literal characters. Strip
  // them once here at the boundary — downstream builders can emit the raw
  // values without worrying about quoting.
  return args.map((a) => a.replace(/'/g, ''))
}

function buildMode1Args(input: BuildUvArgsInput): string[] {
  const { config, ports, indexes, host, localOs } = input
  const args: string[] = ['--param', 'log-color=no']

  pushVideoCapture(args, config, indexes, localOs)
  pushAudioCapture(args, config, indexes)

  args.push(
    `-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`,
    host
  )
  return args
}

function buildMode4Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const args: string[] = ['--param', 'log-color=no']

  pushVideoCapture(args, config, indexes, localOs)
  pushAudioCapture(args, config, indexes)

  args.push('-d', `${textureDisplayPrefix(localOs)}'${textureReceiverName}'`)
  if (indexes.audioReceive !== null) {
    args.push('-r', `portaudio:${indexes.audioReceive}`)
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
  args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
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

function videoCodecName(codec: string): string {
  if (codec === '2') return 'H.264'
  if (codec === '1') return 'JPEG'
  throw new Error(`unsupported video codec id: ${codec}`)
}

function audioCodecName(codec: string): string {
  if (codec === '1') return 'OPUS'
  throw new Error(`unsupported audio codec id: ${codec}`)
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
