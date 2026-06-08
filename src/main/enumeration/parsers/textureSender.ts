import { DEFAULT_RANGE, type ParseResult } from './types'

export type TextureBackend = 'syphon' | 'spout'

// Parses `uv -t syphon:help` (macOS) or `uv -t spout:help` (Windows). Both
// feed `textureCaptureRange` but the formats differ between backends.
//
// Syphon format (macOS, verified 1.10.3):
//   Available servers:
//       1) app: Simple Server name:
//       2) app: OtherApp name: channel_2
// Where `name:` may be blank (unnamed server).
//
// Syphon selection — must pick the right UV key:
//   - blank name         → `app='<app>'`
//   - both present       → `app='<app>':name='<name>'`
//
// Spout format (Windows, verified 1.10.3):
//   Servers:
//       SenderName) width: 1920, height: 1080
// The sender name precedes the closing `)`. UV's name= selector is used.
//
// Sentinels (return `-default-`):
//   - "Unable to open capture device" (backend not available on this OS)
//   - no recognised header
//   - header present but list empty
export function parseTextureSender(
  stdout: string,
  backend: TextureBackend = 'syphon'
): ParseResult {
  if (/Unable to open capture device/i.test(stdout)) return DEFAULT_RANGE

  const lines = stdout.split('\n')

  if (backend === 'spout') {
    const headerIdx = lines.findIndex(l => /^Servers:/i.test(l.trim()))
    if (headerIdx < 0) return DEFAULT_RANGE
    const entries: string[] = []
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (/^(Exit|MasterPort|\[)/i.test(line)) break
      // Format: "SenderName) width: W, height: H"
      // The name itself may contain parens (e.g. "IO (OBS_Motive))"), so strip
      // the last ") width:..." suffix rather than matching from the left.
      const widthIdx = line.indexOf(') width:')
      if (widthIdx < 0) continue
      const name = line.slice(0, widthIdx).trim()
      if (name) entries.push(`name='${name}'`)
    }
    if (entries.length === 0) return DEFAULT_RANGE
    return { range: entries.join('|'), count: entries.length }
  }

  // Syphon
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
    if (name) entries.push(`app='${app}':name='${name}'`)
    else entries.push(`app='${app}'`)
  }
  if (entries.length === 0) return DEFAULT_RANGE
  return { range: entries.join('|'), count: entries.length }
}
