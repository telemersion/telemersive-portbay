// UltraGrid stdout parser for real-time TX/RX indicators.
// Parses the live `uv` stdout stream to extract:
//   - TX/RX active flags (driven by presence of FPS or Volume log lines)
//   - TX/RX FPS values
//   - TX/RX audio volume (dB)
// Publishes a 6-value space-separated string on throttle/change:
//   "txActive rxActive txFps txVol rxFps rxVol"
//
// Pipeline mirrors the Max patcher tg.ultragrid.js:
//   1. Strip [timestamp]
//   2. Route by source (Syphon, Spout, Decklink, NDI, Audio, etc.)
//   3. Route by direction (sender/capture → TX, display/decoder → RX)
//   4. Extract FPS (N/D fraction) and Volume (dB float)
//   5. Pulse active flags on match, reset after idle window
//   6. Throttle + dedup publishes every ~2s
//   7. Idle watchdog: UG prints FPS/Volume lines every ~5s and nothing at all once a
//      stream stops (no "lost connection" message). If a direction produces no
//      FPS/Volume line for `idleMs`, that direction's flag, FPS, volume and levels
//      are cleared so a dead stream is never shown as live.
//
// Per-channel levels (NG extension, not in the Max protocol): a Volume line
// carries one `[ch] RMS/peak` pair per channel. When `levelsTopics` is given,
// all channels are published as space-separated `rms/peak` tokens (dBFS) to
// `levelsTopics.tx` / `.rx`, e.g. "-18.00/-14.99 -20.10/-12.00". The 6-value
// `indicators` topic keeps carrying channel 0 only.

type PublishFn = (retained: 0 | 1, topic: string, ...values: string[]) => void

const TIMESTAMP_PATTERN = /^\[\d+\.\d+\]\s+/
const SOURCE_PATTERN = /\[(Syphon|SYPHON|Spout|SPOUT|Decklink|DeckLink|screen|AVfoundation|NDI|ndi|Audio|dshow|GL|testcard|syphon)[^\]]*\]/i
// `dec` covers the receive-side audio line "[audio dec.] Volume: ..." (UG 1.10.3 and 1.10.8).
const DIRECTION_PATTERN = /(sender|capture|cap|display|decoder|dec|disp)[.\]]/

// UG reports every ~5s; three missed reports means the stream is gone.
export const DEFAULT_IDLE_MS = 15_000

const DB = String.raw`-?(?:inf|\d+(?:\.\d+)?)`
const CHANNEL_PAIR = new RegExp(String.raw`\[(\d+)\]\s*(${DB})(?:/(${DB}))?`, 'gi')

// "Volume: [0] -18.00/-14.99, [1] -20.1/-12.0 dBFS RMS/peak" -> ['-18.00/-14.99', '-20.1/-12.0'].
// A channel without a peak yields just the RMS token. Returns [] when the line has no
// bracketed channel pairs (legacy "Volume: -18.5" form).
export function parseChannelLevels(volumeText: string): string[] {
  const tokens: string[] = []
  for (const m of volumeText.matchAll(CHANNEL_PAIR)) {
    tokens[Number(m[1])] = m[3] !== undefined ? `${m[2]}/${m[3]}` : m[2]
  }
  // A gap would make the renderer misalign channels; fill with silence.
  return Array.from(tokens, (t) => t ?? '-inf')
}

export interface LevelsTopics {
  tx: string
  rx: string
}

export interface UltraGridIndicatorState {
  txActive: boolean
  rxActive: boolean
  txFps: string
  txVol: string
  rxFps: string
  rxVol: string
}

export class UltraGridIndicatorParser {
  private state: UltraGridIndicatorState = {
    txActive: false,
    rxActive: false,
    txFps: '0',
    txVol: '0',
    rxFps: '0',
    rxVol: '0'
  }

  private lastPublished: string | null = null
  private lastLevels: { tx: string | null; rx: string | null } = { tx: null, rx: null }
  private idleTimers: { tx: ReturnType<typeof setTimeout> | null; rx: ReturnType<typeof setTimeout> | null } = {
    tx: null,
    rx: null
  }

  constructor(
    private publish: PublishFn,
    private topic: string,
    private levelsTopics?: LevelsTopics,
    private idleMs: number = DEFAULT_IDLE_MS
  ) {}

  handleLogLine(line: string): void {
    const stripped = line.replace(TIMESTAMP_PATTERN, '').trim()
    if (!stripped) return

    const sourceMatch = stripped.match(SOURCE_PATTERN)
    if (!sourceMatch) return

    const dirMatch = stripped.match(DIRECTION_PATTERN)
    let isTx: boolean
    if (dirMatch) {
      isTx = /sender|capture|cap/.test(dirMatch[0])
    } else {
      // Periodic summary lines for these two sources ("[GL] N frames in Ns = F FPS",
      // "[testcard] N frames in Ns = F FPS") carry no direction token, unlike
      // Syphon/Audio lines. In this app GL is display-only (RX) and testcard is
      // capture-priming-only (TX), so the source name alone disambiguates.
      const source = sourceMatch[1].toLowerCase()
      if (source === 'gl') isTx = false
      else if (source === 'testcard') isTx = true
      else return
    }

    // Extract FPS: "FPS 30/1 peak." or "FPS 60/1" or "57.4366 FPS" (periodic summary)
    let fpsMatch = stripped.match(/FPS\s+(\d+)\/(\d+)/)
    if (fpsMatch) {
      const num = parseInt(fpsMatch[1], 10)
      const den = parseInt(fpsMatch[2], 10)
      const fps = Math.round((num / den) * 10) / 10 // one decimal
      if (isTx) {
        this.state.txFps = String(fps)
        this.pulseTxActive()
      } else {
        this.state.rxFps = String(fps)
        this.pulseRxActive()
      }
    } else {
      fpsMatch = stripped.match(/=\s+([\d.]+)\s+FPS/)
      if (fpsMatch) {
        const fps = parseFloat(fpsMatch[1])
        if (isTx) {
          this.state.txFps = String(fps)
          this.pulseTxActive()
        } else {
          this.state.rxFps = String(fps)
          this.pulseRxActive()
        }
      }
    }

    // Extract Volume: "Volume: -18.5" or "Volume: [0] -46.77/-33.98 dBFS RMS/peak"
    const volMatch = stripped.match(/Volume:\s*(?:\[\d+\]\s*)?([-\d.]+)/)
    if (volMatch) {
      this.publishLevels(isTx ? 'tx' : 'rx', parseChannelLevels(stripped))
      const vol = volMatch[1]
      if (isTx) {
        this.state.txVol = vol
        this.pulseTxActive()
      } else {
        this.state.rxVol = vol
        this.pulseRxActive()
      }
    }

    this.publishIfChanged()
  }

  private publishLevels(dir: 'tx' | 'rx', tokens: string[]): void {
    if (!this.levelsTopics || tokens.length === 0) return
    const joined = tokens.join(' ')
    if (joined === this.lastLevels[dir]) return
    this.lastLevels[dir] = joined
    this.publish(1, this.levelsTopics[dir], ...tokens)
  }

  // (Re)arm the idle watchdog for one direction; called on every FPS/Volume match.
  private touch(dir: 'tx' | 'rx'): void {
    const existing = this.idleTimers[dir]
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => this.expire(dir), this.idleMs)
    timer.unref?.()
    this.idleTimers[dir] = timer
  }

  private expire(dir: 'tx' | 'rx'): void {
    this.idleTimers[dir] = null
    if (dir === 'tx') {
      this.state.txActive = false
      this.state.txFps = '0'
      this.state.txVol = '0'
    } else {
      this.state.rxActive = false
      this.state.rxFps = '0'
      this.state.rxVol = '0'
    }
    this.publishIfChanged()
    this.clearLevels(dir)
  }

  private clearLevels(dir: 'tx' | 'rx'): void {
    if (!this.levelsTopics) return
    if (this.lastLevels[dir] !== '') this.publish(1, this.levelsTopics[dir], '')
    this.lastLevels[dir] = ''
  }

  private clearTimers(): void {
    for (const dir of ['tx', 'rx'] as const) {
      const t = this.idleTimers[dir]
      if (t) clearTimeout(t)
      this.idleTimers[dir] = null
    }
  }

  // Stop the watchdog without publishing (device teardown clears topics itself).
  dispose(): void {
    this.clearTimers()
  }

  private pulseTxActive(): void {
    this.touch('tx')
    const wasInactive = !this.state.txActive
    this.state.txActive = true
    if (wasInactive) this.publishIfChanged()
  }

  private pulseRxActive(): void {
    this.touch('rx')
    const wasInactive = !this.state.rxActive
    this.state.rxActive = true
    if (wasInactive) this.publishIfChanged()
  }

  private publishIfChanged(): void {
    const atoms = [
      this.state.txActive ? '1' : '0',
      this.state.rxActive ? '1' : '0',
      this.state.txFps,
      this.state.txVol,
      this.state.rxFps,
      this.state.rxVol
    ]
    const joined = atoms.join(' ')
    if (joined !== this.lastPublished) {
      this.lastPublished = joined
      this.publish(1, this.topic, ...atoms)
    }
  }

  reset(): void {
    this.clearTimers()
    this.state = {
      txActive: false,
      rxActive: false,
      txFps: '0',
      txVol: '0',
      rxFps: '0',
      rxVol: '0'
    }
    this.lastPublished = null
    this.publishIfChanged()
    this.clearLevels('tx')
    this.clearLevels('rx')
  }
}
