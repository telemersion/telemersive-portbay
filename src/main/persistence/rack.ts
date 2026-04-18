import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export type RackSnapshot = Record<string, string>

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
