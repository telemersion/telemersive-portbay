import type { RackSnapshot } from './rack'

// rack.json and settings.json live side by side in the same userData folder and
// are both plain JSON, so picking the wrong one in an Open dialog is easy to do.
// These guards let the open handlers reject a mismatch (and say which item to
// use instead) rather than silently applying nonsense.

const SETTINGS_MARKER_KEYS = [
  'brokerUrl',
  'brokerPort',
  'peerName',
  'settingsVersion',
  'panelRowHeight'
]

export function isPlainObject(data: unknown): data is Record<string, unknown> {
  return !!data && typeof data === 'object' && !Array.isArray(data)
}

// A rack is a non-empty flat map of topic-tail -> string value.
export function looksLikeRack(data: unknown): data is RackSnapshot {
  if (!isPlainObject(data)) return false
  const entries = Object.entries(data)
  if (entries.length === 0) return false
  return entries.every(([, v]) => typeof v === 'string')
}

// A settings file carries at least one of the known top-level setting keys.
export function looksLikeSettings(data: unknown): boolean {
  if (!isPlainObject(data)) return false
  return SETTINGS_MARKER_KEYS.some((k) => k in data)
}
