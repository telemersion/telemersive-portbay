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

type PublishFn = (retained: 0 | 1, topic: string, ...values: string[]) => void

const TIMESTAMP_PATTERN = /^\[\d+\.\d+\]\s+/
const SOURCE_PATTERN = /\[(Syphon|SYPHON|Spout|SPOUT|Decklink|DeckLink|screen|AVfoundation|NDI|ndi|Audio|dshow|GL|testcard|syphon)[^\]]*\]/i
const DIRECTION_PATTERN = /(sender|capture|cap|display|decoder|disp)[.\]]/

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

  constructor(private publish: PublishFn, private topic: string) {}

  handleLogLine(line: string): void {
    const stripped = line.replace(TIMESTAMP_PATTERN, '').trim()
    if (!stripped) return

    const sourceMatch = stripped.match(SOURCE_PATTERN)
    if (!sourceMatch) return

    const dirMatch = stripped.match(DIRECTION_PATTERN)
    if (!dirMatch) return

    const isTx = /sender|capture|cap/.test(dirMatch[0])

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

  private pulseTxActive(): void {
    const wasInactive = !this.state.txActive
    this.state.txActive = true
    if (wasInactive) this.publishIfChanged()
  }

  private pulseRxActive(): void {
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
  }
}
