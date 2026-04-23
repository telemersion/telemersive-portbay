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

const NONE = '-none-'
const DEFAULT = '-default-'

export function buildUvArgs(input: BuildUvArgsInput): string[] {
  const { config } = input
  const mode = config.network.mode
  switch (mode) {
    case '1': return buildMode1Args(input)
    case '2': return buildMode2Args(input)
    case '4': return buildMode4Args(input)
    case '5': return buildMode5Args(input)
    case '7': return buildMode7Args(input)
    default:
      throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`)
  }
}

// Gating rules derived from tg.ultragrid.js:
//   transmission_mode: 0=video, 1=audio, 2=both
//   connection_type:   0=send,  1=receive, 2=both
// Mode 1 is always send-only; connection is ignored.
// Mode 2 is always receive-only; connection is ignored.
// Mode 4 gates each side on connection and each block-within-side on transmission.
// Mode 5 is peer-to-peer manual: -P from customSending port, destination IP from
// customSending IP on the send side, no router/host. Same gating as mode 4.
// Mode 7 is video-only loopback; transmission/connection are ignored.

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
  const args: string[] = []

  pushTopLevelFlags(args, config)

  if (shouldEmitVideo(transmission)) {
    pushCaptureFilter(args, config)
    pushVideoCapture(args, config, indexes, localOs)
  }
  if (shouldEmitAudio(transmission)) {
    pushAudioCapture(args, config, indexes)
  }

  // Single-port -P reuses the video port even for audio-only (Max does this faithfully).
  pushPort(args, ports, transmission)
  args.push(host)
  return args
}

function buildMode2Args(input: BuildUvArgsInput): string[] {
  const { config, ports, indexes, host, textureReceiverName, localOs } = input
  const transmission = config.audioVideo.transmission
  const args: string[] = []

  pushTopLevelFlags(args, config)

  // Video block: testcard primes the udpproxy forwarding table, then display.
  if (shouldEmitVideo(transmission)) {
    args.push('-t', 'testcard:80:60:1:UYVY')
    pushPostprocessor(args, config)
    pushVideoReceive(args, config, textureReceiverName, localOs)
  }
  // Audio block: same pattern — testcard primes the audio side.
  if (shouldEmitAudio(transmission)) {
    args.push('-s', 'testcard:frequency=440')
    pushAudioReceive(args, config, indexes)
    pushAudioMapping(args, config)
  }

  pushPort(args, ports, transmission)
  args.push(host)
  return args
}

function buildMode4Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const transmission = config.audioVideo.transmission
  const connection = config.audioVideo.connection
  const args: string[] = []

  pushTopLevelFlags(args, config)

  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushCaptureFilter(args, config)
      pushVideoCapture(args, config, indexes, localOs)
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioCapture(args, config, indexes)
    }
  }
  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushPostprocessor(args, config)
      pushVideoReceive(args, config, textureReceiverName, localOs)
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioReceive(args, config, indexes)
      pushAudioMapping(args, config)
    }
  }
  return args
}

// Mode 5: peer-to-peer manual. customSending carries `ip:port`; the port drives
// -P (with the usual +2 for audio when transmission=2), the IP is appended at
// the end only on the send side. No router, no host. Matches the ordering in
// tg.ultragrid.js:766-789 (-P first, then receive block, then send block).
function buildMode5Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const transmission = config.audioVideo.transmission
  const connection = config.audioVideo.connection
  const { ip: lanIp, port: lanPort } = parseCustomSending(config.network.local.customSending)
  const args: string[] = []

  pushTopLevelFlags(args, config)
  pushLanPort(args, lanPort, transmission)

  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushPostprocessor(args, config)
      pushVideoReceive(args, config, textureReceiverName, localOs)
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioReceive(args, config, indexes)
      pushAudioMapping(args, config)
    }
  }
  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushCaptureFilter(args, config)
      pushVideoCapture(args, config, indexes, localOs)
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioCapture(args, config, indexes)
    }
    args.push(lanIp)
  }
  return args
}

function parseCustomSending(raw: string): { ip: string; port: number } {
  const idx = raw.lastIndexOf(':')
  if (idx < 0) throw new Error(`invalid customSending value: ${raw}`)
  const ip = raw.slice(0, idx)
  const port = parseInt(raw.slice(idx + 1), 10)
  if (!ip || Number.isNaN(port)) throw new Error(`invalid customSending value: ${raw}`)
  return { ip, port }
}

function pushLanPort(args: string[], port: number, transmission: string): void {
  if (transmission === '2') {
    args.push(`-P${port}:${port}:${port + 2}:${port + 2}`)
  } else {
    args.push(`-P${port}`)
  }
}

// Mode 7: capture-to-local (loopback). Video-only by design — transmission and
// connection fields are ignored, matching Max (tg.ultragrid.js:813-818).
function buildMode7Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const args: string[] = []

  pushTopLevelFlags(args, config)
  pushCaptureFilter(args, config)
  pushVideoCapture(args, config, indexes, localOs, { emitCodec: false })
  pushPostprocessor(args, config)
  pushVideoReceive(args, config, textureReceiverName, localOs)
  return args
}

function pushTopLevelFlags(args: string[], config: UltraGridConfig): void {
  const params = config.audioVideo.advanced.advanced.params.params
  let paramValue = 'log-color=no'
  if (params && params !== NONE) paramValue += `,${params}`
  args.push('--param', paramValue)

  const advancedCustom = config.audioVideo.advanced.custom.customFlags.flags
  if (advancedCustom && advancedCustom !== NONE) {
    for (const tok of shellTokenize(advancedCustom)) args.push(tok)
  }

  const encryption = config.audioVideo.advanced.advanced.encryption.key
  if (encryption && encryption !== NONE) {
    args.push('--encryption', encryption)
  }
}

function pushPort(args: string[], ports: UgPorts, transmission: string): void {
  if (transmission === '2') {
    args.push(`-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`)
  } else {
    args.push(`-P${ports.videoPort}`)
  }
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
  localOs: LocalOs,
  opts: { emitCodec?: boolean } = {}
): void {
  const emitCodec = opts.emitCodec !== false
  const type = config.audioVideo.videoCapture.type
  if (type === '2') {
    const custom = config.audioVideo.videoCapture.custom.customFlags.flags
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok)
    }
    return
  }
  if (type === '0') {
    let flag = textureCapturePrefix(localOs)
    if (indexes.textureCapture && indexes.textureCapture !== DEFAULT) {
      flag += `:${indexes.textureCapture}`
    }
    const fps = config.audioVideo.videoCapture.advanced.texture.fps
    if (fps && fps !== '0') flag += `:${textureFpsFlag(localOs)}=${fps}`
    args.push('-t', flag)
  } else if (type === '1') {
    let flag = 'ndi'
    if (indexes.ndiCapture && indexes.ndiCapture !== DEFAULT) {
      flag += `:${indexes.ndiCapture}`
    }
    args.push('-t', flag)
  }
  if (!emitCodec) return
  const { codec, bitrate } = config.audioVideo.videoCapture.advanced.compress
  if (codec !== '0') {
    args.push('-c', `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`)
  }
}

function pushVideoReceive(
  args: string[],
  config: UltraGridConfig,
  textureReceiverName: string,
  localOs: LocalOs
): void {
  const type = config.audioVideo.videoReciever.type
  if (type === '2') {
    const custom = config.audioVideo.videoReciever.custom.customFlags.flags
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok)
    }
    return
  }
  if (type === '1') {
    const ndiName = config.audioVideo.videoReciever.ndi.name
    args.push('-d', `ndi:name='${ndiName}'`)
    return
  }
  // Default: texture (type === '0')
  const name = config.audioVideo.videoReciever.texture.name || textureReceiverName
  args.push('-d', `${textureDisplayPrefix(localOs)}'${name}'`)
}

function pushAudioCapture(
  args: string[],
  config: UltraGridConfig,
  indexes: ResolvedMenuIndexes
): void {
  const type = config.audioVideo.audioCapture.type
  if (type === '7') {
    const custom = config.audioVideo.audioCapture.custom.customFlags.flags
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok)
    }
    return
  }
  if (type === '8') {
    const testcard = config.audioVideo.audioCapture.testcard
    args.push('-s', `testcard:volume=${testcard.volume}:frequency=${testcard.frequency}`)
    return
  }
  const backend = audioCaptureBackend(type)
  if (backend) {
    let flag = backend
    if (audioBackendHasMenu(type) && indexes.audioCapture !== null) {
      flag += `:${indexes.audioCapture}`
    }
    args.push('-s', flag)
  }
  const audio = config.audioVideo.audioCapture.advanced
  if (audio.compress.codec !== '0') {
    args.push('--audio-codec', `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`)
  }
  args.push('--audio-capture-format', `channels=${audio.channels.channels}`)
}

function pushAudioReceive(
  args: string[],
  config: UltraGridConfig,
  indexes: ResolvedMenuIndexes
): void {
  const type = config.audioVideo.audioReceiver.type
  if (type === '7') {
    const custom = config.audioVideo.audioReceiver.custom.customFlags.flags
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok)
    }
    return
  }
  const backend = audioReceiveBackend(type)
  if (!backend) return
  let flag = backend
  if (audioBackendHasMenu(type) && indexes.audioReceive !== null) {
    flag += `:${indexes.audioReceive}`
  }
  args.push('-r', flag)
}

function pushCaptureFilter(args: string[], config: UltraGridConfig): void {
  const filter = config.audioVideo.videoCapture.advanced.filter.params
  if (filter && filter !== NONE) {
    args.push('--capture-filter', filter)
  }
}

function pushPostprocessor(args: string[], config: UltraGridConfig): void {
  const pp = config.audioVideo.videoReciever.advanced.postprocessor.params
  if (pp && pp !== NONE) {
    args.push('-p', pp)
  }
}

function pushAudioMapping(args: string[], config: UltraGridConfig): void {
  const mapping = config.audioVideo.audioReceiver.advanced.channels.params
  if (mapping && mapping !== NONE) {
    args.push('--audio-channel-map', mapping)
  }
}

// Audio receive enum (Max umenu): 0=portaudio, 1=coreaudio, 2=wasapi, 3=jack,
// 4=embedded, 5=analog, 6=AESEBU, 7=custom.
function audioReceiveBackend(type: string): string | null {
  switch (type) {
    case '0': return 'portaudio'
    case '1': return 'coreaudio'
    case '2': return 'wasapi'
    case '3': return 'jack'
    case '4': return 'embedded'
    case '5': return 'analog'
    case '6': return 'AESEBU'
    default: return null
  }
}

// Audio capture enum extends receive with 8=testcard (handled separately).
function audioCaptureBackend(type: string): string | null {
  return audioReceiveBackend(type)
}

function audioBackendHasMenu(type: string): boolean {
  // portaudio, coreaudio, wasapi, jack have a numeric menu index; the rest don't.
  return type === '0' || type === '1' || type === '2' || type === '3'
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
// Index 0 (-none-) means "no --audio-codec flag" — handled by caller.
// Index 2 (speex) is intentionally absent: UG 1.10.3 lists speex as
// "unavailable" — a spawn with --audio-codec speex fails at runtime with
// "Unable to find encoder for audio codec 'speex'". We throw in audioCodecName
// rather than letting that reach the user via a spawn crash.
// Codec name acceptance re-verified with scripts/probe-uv-codecs.sh — see
// docs/ug-codecs-<version>.txt for the live probe output.
const AUDIO_CODEC_NAMES: Readonly<Record<string, string>> = {
  '1': 'OPUS',
  '3': 'FLAC',
  '4': 'AAC',
  '5': 'MP3',
  '6': 'G.722',
  '7': 'u-law',
  '8': 'A-law',
  '9': 'PCM'
}

function videoCodecName(codec: string): string {
  const name = VIDEO_CODEC_NAMES[codec]
  if (!name) throw new Error(`unsupported video codec id: ${codec}`)
  return name
}

function audioCodecName(codec: string): string {
  if (codec === '2') {
    throw new Error('audio codec index 2 (speex) is unavailable in UG 1.10.3')
  }
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

// Shell-aware tokenizer for custom-flags strings. Splits on top-level whitespace
// and preserves single-quoted substrings (including the quotes) as a single
// token — so a user can type `--param name='Simple Server'` and get two argv
// elements rather than three. Matches the test-side tokenizer shape.
export function shellTokenize(line: string): string[] {
  const tokens: string[] = []
  let acc = ''
  let inSingle = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'") {
      inSingle = !inSingle
      acc += ch
      continue
    }
    if (!inSingle && /\s/.test(ch)) {
      if (acc) { tokens.push(acc); acc = '' }
      continue
    }
    acc += ch
  }
  if (acc) tokens.push(acc)
  return tokens
}
