// Helpers for the per-channel audio level topics (`gui/levels/tx|rx`, see
// main/devices/ultragrid/indicators.ts). Wire format: space-separated tokens,
// one per channel, `rms/peak` or just `rms`, values in dBFS (or `-inf`).

export const LEVEL_FLOOR_DB = -60

export interface ChannelLevel {
  rms: number
  peak: number | null
}

function parseDb(token: string): number {
  if (/^-?inf$/i.test(token)) return -Infinity
  const n = parseFloat(token)
  return Number.isFinite(n) ? n : -Infinity
}

export function parseLevels(raw: string | undefined): ChannelLevel[] {
  return (raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [rms, peak] = token.split('/')
      return { rms: parseDb(rms), peak: peak === undefined ? null : parseDb(peak) }
    })
}

// dBFS -> 0..1 on the -60..0 scale; -inf and anything below the floor map to 0.
export function levelToFraction(db: number): number {
  if (!Number.isFinite(db)) return 0
  return Math.min(1, Math.max(0, (db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB))
}

export function formatDb(db: number): string {
  return Number.isFinite(db) ? db.toFixed(1) : '-inf'
}
