import { DEFAULT_RANGE, type ParseResult } from './types'

// Parses `uv -t ndi:help`. Format:
//   available sources (tentative, format: name - url):
//       MACHINE_NAME (SOURCE_NAME) - 192.168.1.5:5961
//       ...
//   Exit
//
// Or, when no sources are reachable:
//   [NDI cap.] No sources found!
//
// NDI sources have no numeric ids — Max publishes the raw name. We emit the
// name only (before ` - `) joined with `|`. Returns `-default-` when no
// sources, matching Max's observed behavior for an idle NDI setup.
export function parseNdi(stdout: string): ParseResult {
  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /available sources/i.test(l))
  if (headerIdx < 0) return DEFAULT_RANGE

  const names: string[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^(Exit|MasterPort|\[NDI)/i.test(line)) continue
    if (!/ - /.test(line)) continue
    const name = line.split(' - ')[0].trim()
    if (name) names.push(name)
  }

  if (names.length === 0) return DEFAULT_RANGE
  return { range: names.join('|'), count: names.length }
}
