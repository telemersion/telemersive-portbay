import { EMPTY_RANGE, type ParseResult } from './types'

// Parses `uv -s portaudio:help` or `uv -r portaudio:help`. Format:
//   Available PortAudio capture/playback devices (max channels; API):
//       portaudio - use default Portaudio device (marked with star)
//       portaudio:0 - NDI Audio (2; Core Audio)
//   (*) portaudio:4 - MacBook Pro Microphone (1; Core Audio)
//
// 1.9.x emits the longer `(output channels: X; input channels: Y; API)` form in
// the same slot. We preserve the parens content verbatim — it's cosmetic.
//
// Skipped: the default-device pseudo-entry (no numeric id).
// Emit: `{id} {name} ({parens})` joined with `|`.
export function parsePortaudio(stdout: string): ParseResult {
  const entries: string[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/^\(\*\)\s*/, '').trim()
    const m = line.match(/^portaudio:(\d+)\s*-\s*(.+)$/)
    if (!m) continue
    const id = m[1]
    const rest = m[2].trim()
    entries.push(`${id} ${rest}`)
  }
  if (entries.length === 0) return EMPTY_RANGE
  return { range: entries.join('|'), count: entries.length }
}
