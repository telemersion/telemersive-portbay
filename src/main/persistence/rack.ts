import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export type RackSnapshot = Record<string, string>

export function isRackEligibleTail(tail: string): boolean {
  if (tail.startsWith('settings/localMenus/')) return false
  if (tail.startsWith('settings/localProps/')) return false
  return true
}

export function buildRackSnapshot(
  retainedTopics: Iterable<[string, string]>,
  peerId: string
): RackSnapshot {
  if (!peerId) return {}
  const prefix = `/peer/${peerId}/`
  const snap: RackSnapshot = {}
  for (const [topic, value] of retainedTopics) {
    if (!topic.startsWith(prefix)) continue
    const tail = topic.slice(prefix.length)
    if (!isRackEligibleTail(tail)) continue
    snap[tail] = value
  }
  return snap
}

function rackPath(): string {
  return join(app.getPath('userData'), 'rack.json')
}

export function loadRack(): RackSnapshot {
  const path = rackPath()
  if (!existsSync(path)) return {}

  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveRack(snapshot: RackSnapshot): void {
  const path = rackPath()
  writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf-8')
}
