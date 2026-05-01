// Single source of truth for device-type visual identity and peer color derivation.

export interface DeviceStyle {
  color: string
  dim: string
  label: string
}

// Keyed by the `loaded` discriminator value published on MQTT.
// '1' = OSC, '3' = MoCap, '4' = StageC.
// UltraGrid (loaded=2) has sub-variants — use UG_STYLES keyed by stream type.
export const DEVICE_STYLES: Record<string, DeviceStyle> = {
  '1': { color: '#36abff', dim: '#13527f', label: 'OSC' },
  '3': { color: '#ffa126', dim: '#7f500f', label: 'MoCap' },
  '4': { color: '#fe5ff5', dim: '#7f2f7a', label: 'StageC' },
}

export type UgStreamType = 'video' | 'audio' | 'both'

export const UG_STYLES: Record<UgStreamType, DeviceStyle> = {
  video: { color: '#f0de01', dim: '#787000', label: 'UltraGrid' },
  audio: { color: '#00e411', dim: '#006b08', label: 'UltraGrid' },
  both:  { color: '#1bfee9', dim: '#0d7f74', label: 'UltraGrid' },
}

export interface PeerColors {
  dot: string    // full-brightness rgb() — peer dot indicator and color swatch
  bg: string     // very dark tint — peer row background
  border: string // same as dot — left border accent
  name: string   // readable text on dark background
  ip: string     // dimmer readable color for IP/secondary text
  hex: string    // #rrggbb — for <input type="color">
}

const FALLBACK: PeerColors = {
  dot:    '#666666',
  bg:     '#222222',
  border: '#666666',
  name:   '#cccccc',
  ip:     '#888888',
  hex:    '#666666',
}

// Accepts the raw MQTT wire value (e.g. "0.5 0.3 0.8" as space-separated floats 0–1).
// Returns a consistent gray fallback for empty, malformed, or out-of-range input.
export function peerColors(colorString: string): PeerColors {
  if (!colorString) return FALLBACK

  const parts = colorString.trim().split(' ').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return FALLBACK

  const [r, g, b] = parts

  const ch = (v: number) => Math.round(v * 255)
  const dot    = `rgb(${ch(r)},${ch(g)},${ch(b)})`
  const bg     = `rgb(${Math.round(r * 30)},${Math.round(g * 30)},${Math.round(b * 30)})`
  const name   = `rgb(${Math.round(140 + r * 115)},${Math.round(140 + g * 115)},${Math.round(140 + b * 115)})`
  const ip     = `rgb(${Math.round(60 + r * 120)},${Math.round(60 + g * 120)},${Math.round(60 + b * 120)})`
  const hex    = '#' + [r, g, b].map(v => ch(v).toString(16).padStart(2, '0')).join('')

  return { dot, bg, border: dot, name, ip, hex }
}
