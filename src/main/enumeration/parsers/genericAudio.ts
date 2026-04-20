import { EMPTY_RANGE, type ParseResult } from './types'

// Parses backends like jack/wasapi that show `{backend}:<id> - <name>` or a
// failure sentinel when the backend isn't available on this platform/runtime:
//   - "Unknown audio capture driver: wasapi" (wrong platform)
//   - "jack server is not running" (server offline)
//
// Returns `0` when no entries found — matches Max's published sentinel.
export function parseGenericAudio(prefix: string, stdout: string): ParseResult {
  const rx = new RegExp(`^\\s*(?:\\(\\*\\)\\s*)?${prefix}:(\\d+)\\s*[-:]\\s*(.+)$`)
  const entries: string[] = []
  for (const raw of stdout.split('\n')) {
    const m = raw.match(rx)
    if (!m) continue
    const id = m[1]
    const rest = m[2].trim()
    entries.push(`${id} ${rest}`)
  }
  if (entries.length === 0) return EMPTY_RANGE
  return { range: entries.join('|'), count: entries.length }
}

export function parseJack(stdout: string): ParseResult {
  return parseGenericAudio('jack', stdout)
}

export function parseWasapi(stdout: string): ParseResult {
  return parseGenericAudio('wasapi', stdout)
}
