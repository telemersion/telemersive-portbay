<script setup lang="ts">
import { onUnmounted } from 'vue'
import { panelWidths, panelResize, clampPanelWidth, PANEL_WIDTH_SPECS, type PanelWidthId } from './panelWidths'

// Drag strip on one vertical edge of a side panel. `edge` is the side of the
// panel the strip sits on: 'right' for a panel docked left (drag right grows
// it), 'left' for a panel docked right (drag left grows it).
const props = withDefaults(defineProps<{
  panel: PanelWidthId
  edge: 'left' | 'right'
  // Width of other fixed chrome (e.g. the icon bar) that also eats window space.
  reserved?: number
}>(), { reserved: 0 })

let startX = 0
let startWidth = 0

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  e.preventDefault()
  startX = e.clientX
  startWidth = panelWidths[props.panel]
  panelResize.active = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  document.body.classList.add('panel-resizing')
}

function onPointerMove(e: PointerEvent): void {
  if (!panelResize.active) return
  const dx = e.clientX - startX
  const width = props.edge === 'right' ? startWidth + dx : startWidth - dx
  panelWidths[props.panel] = clampPanelWidth(props.panel, width, props.reserved)
}

function endDrag(): void {
  if (!panelResize.active) return
  panelResize.active = false
  document.body.classList.remove('panel-resizing')
}

function resetWidth(): void {
  panelWidths[props.panel] = clampPanelWidth(props.panel, PANEL_WIDTH_SPECS[props.panel].default, props.reserved)
}

onUnmounted(endDrag)
</script>

<template>
  <div
    class="resize-handle"
    :class="'edge-' + edge"
    title="Drag to resize · double-click to reset"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @dblclick="resetWidth"
  />
</template>

<style scoped>
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 1;
  touch-action: none;
}
.edge-right { right: -3px; }
.edge-left { left: -3px; }

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 2px;
  background: transparent;
  transition: background 0.1s;
}
.resize-handle:hover::after,
.resize-handle:active::after { background: #1BFEE9; }
</style>

<style>
/* Keep the col-resize cursor and suppress text selection while dragging,
   even when the pointer outruns the handle. */
body.panel-resizing,
body.panel-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>
