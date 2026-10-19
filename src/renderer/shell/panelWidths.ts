import { reactive, watch } from 'vue'

// User-resizable side panel widths, remembered per machine in localStorage.

export type PanelWidthId = 'log' | 'peerDetail'

interface PanelWidthSpec { default: number; min: number }

export const PANEL_WIDTH_SPECS: Record<PanelWidthId, PanelWidthSpec> = {
  log: { default: 400, min: 260 },
  peerDetail: { default: 280, min: 220 }
}

// Always leave this much of the window for the main content.
const MIN_CONTENT_WIDTH = 320
const STORAGE_KEY = 'panelWidths'

function load(): Record<PanelWidthId, number> {
  const widths = { log: PANEL_WIDTH_SPECS.log.default, peerDetail: PANEL_WIDTH_SPECS.peerDetail.default }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    for (const id of Object.keys(widths) as PanelWidthId[]) {
      if (typeof saved[id] === 'number' && Number.isFinite(saved[id])) widths[id] = saved[id]
    }
  } catch { /* storage unavailable or corrupt — use defaults */ }
  return widths
}

export const panelWidths = reactive(load())

// True while a resize handle is being dragged — layout transitions are
// suspended so the content follows the pointer without lag.
export const panelResize = reactive({ active: false })

export function clampPanelWidth(id: PanelWidthId, width: number, reserved = 0): number {
  const max = Math.max(PANEL_WIDTH_SPECS[id].min, window.innerWidth - reserved - MIN_CONTENT_WIDTH)
  return Math.round(Math.min(max, Math.max(PANEL_WIDTH_SPECS[id].min, width)))
}

// Keep saved widths valid for the current window (e.g. a smaller screen than
// last session, or the window shrinking). 48 = icon bar.
function clampAll(): void {
  for (const id of Object.keys(PANEL_WIDTH_SPECS) as PanelWidthId[]) {
    const w = clampPanelWidth(id, panelWidths[id], 48)
    if (w !== panelWidths[id]) panelWidths[id] = w
  }
}
clampAll()
window.addEventListener('resize', clampAll)

watch(panelWidths, (w) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)) } catch { /* non-fatal */ }
})
