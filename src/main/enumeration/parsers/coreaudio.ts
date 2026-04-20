import { EMPTY_RANGE, type ParseResult } from './types'

// Parses `uv -s coreaudio:help` or `uv -r coreaudio:help`. Format (identical
// across 1.9.x and 1.10.x):
//   Available Core Audio capture/playback devices:
//       coreaudio    : Default CoreAudio capture
//       coreaudio:158: NDI Audio
//       coreaudio:95 : MacBook Pro Microphone
//
// Whitespace padding between `coreaudio:<id>` and `:` is variable — e.g.
// `coreaudio:95 :` for two-digit ids, `coreaudio:158:` for three.
//
// Skipped: the default pseudo-entry `coreaudio    : Default ...` (no id).
// Emit: `{id} {name}` joined with `|`.
export function parseCoreaudio(stdout: string): ParseResult {
  const entries: string[] = []
  for (const raw of stdout.split('\n')) {
    const m = raw.match(/^\s*coreaudio:(\d+)\s*:\s*(.+)$/)
    if (!m) continue
    const id = m[1]
    const name = m[2].trim()
    entries.push(`${id} ${name}`)
  }
  if (entries.length === 0) return EMPTY_RANGE
  return { range: entries.join('|'), count: entries.length }
}
