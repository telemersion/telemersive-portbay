import { DEFAULT_RANGE, type ParseResult } from './types'

export type TextureBackend = 'syphon' | 'spout'

// Parses `uv -t syphon:help` (macOS) or `uv -t spout:help` (Windows). Both
// feed `textureCaptureRange` but the emitted selection strings are *different*
// because UV parses the two backends' option strings independently (verified
// in UV 1.10.3 src/video_capture/syphon.m: `name=` and `app=` are separate
// keys, no fallback matching).
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
// Using `name='Simple Server'` on a blank-name server would fail at UV because
// UV matches `name=` only against the channel name.
//
// Spout format (Windows): each sender is addressed by a single string. Max
// emits selections as `name='<sender>'` (seen in logging_in_to_room_with.log).
// UV spout: `name=<name>` is the only selector we need.
//
// Sentinels (return `-default-`):
//   - "Unable to open capture device" (backend not available on this OS)
//   - no "Available servers:" header
//   - header present but list empty
export function parseTextureSender(
  stdout: string,
  backend: TextureBackend = 'syphon'
): ParseResult {
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
    entries.push(formatSelection(backend, app, name))
  }

  if (entries.length === 0) return DEFAULT_RANGE
  return { range: entries.join('|'), count: entries.length }
}

function formatSelection(backend: TextureBackend, app: string, name: string): string {
  if (backend === 'syphon') {
    if (name) return `app='${app}':name='${name}'`
    return `app='${app}'`
  }
  // spout: single identifier, key is name=
  const id = name ? `${app}/${name}` : app
  return `name='${id}'`
}
