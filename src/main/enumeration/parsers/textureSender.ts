import { DEFAULT_RANGE, type ParseResult } from './types'

// Parses `uv -t syphon:help` (macOS) or `uv -t spout:help` (Windows).
// Both feed `textureCaptureRange` — they're the platform-specific texture-
// sender enumeration. Max calls this category "texture" in the UI picker.
//
// Syphon format (macOS, verified 1.10.3):
//   Available servers:
//       1) app: Simple Server name:
//       2) app: OtherApp name: channel_2
// Where `name:` may be blank (unnamed server = default).
//
// Spout format (Windows — not yet captured from a Windows host; inferred from
// UV source): expected similar shape, exact format TBD when a Windows fixture
// is added. Until then the Windows branch uses the same parser — if spout
// differs, this test will surface it and we'll split.
//
// Emit: `name='<app>/<name>'` per server, joined with `|`. The `name=`
// prefix matches how Max writes the selection topic (seen in
// creating_4_devices_locally.log: `videoCapture/texture/menu/selection
// name='Spout Sender'`).
//
// Sentinels (return `-default-`):
//   - "Unable to open capture device" (spout on mac)
//   - no "Available servers:" header
//   - header present but list empty
export function parseTextureSender(stdout: string): ParseResult {
  if (/Unable to open capture device/i.test(stdout)) return DEFAULT_RANGE

  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /Available servers:/i.test(l))
  if (headerIdx < 0) return DEFAULT_RANGE

  const entries: string[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^(Exit|MasterPort|\[)/i.test(line)) break
    const m = line.match(/^\d+\)\s*app:\s*(.*?)\s*name:\s*(.*)$/)
    if (!m) continue
    const app = m[1].trim()
    const name = m[2].trim()
    const id = name ? `${app}/${name}` : app
    entries.push(`name='${id}'`)
  }

  if (entries.length === 0) return DEFAULT_RANGE
  return { range: entries.join('|'), count: entries.length }
}
