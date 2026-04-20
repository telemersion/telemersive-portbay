import type { UltraGridConfig } from './config'
import type { UgPorts } from '../../portAllocator'

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
}

export function buildUvArgs(input: BuildUvArgsInput): string[] {
  const { config } = input
  const mode = config.network.mode
  if (mode === '1') return buildMode1Args(input)
  if (mode === '4') return buildMode4Args(input)
  throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`)
}

function buildMode1Args(input: BuildUvArgsInput): string[] {
  const { config, ports, indexes, host } = input
  const args: string[] = ['--param', 'log-color=no']

  pushVideoCapture(args, config, indexes)
  pushAudioCapture(args, config, indexes)

  args.push(
    `-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`,
    host
  )
  return args
}

function buildMode4Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName } = input
  const args: string[] = ['--param', 'log-color=no']

  pushVideoCapture(args, config, indexes)
  pushAudioCapture(args, config, indexes)

  args.push('-d', `gl:spout='${textureReceiverName}'`)
  if (indexes.audioReceive !== null) {
    args.push('-r', `portaudio:${indexes.audioReceive}`)
  }
  return args
}

function pushVideoCapture(
  args: string[],
  config: UltraGridConfig,
  indexes: ResolvedMenuIndexes
): void {
  if (indexes.textureCapture !== null) {
    args.push('-t', `spout:${indexes.textureCapture}`)
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
