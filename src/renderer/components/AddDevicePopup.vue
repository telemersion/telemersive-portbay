<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  anchorRect: DOMRect
}>()

const emit = defineEmits<{
  select: [deviceType: number]
  close: []
}>()

interface Tile {
  type: number
  label: string
  color: string
  enabled: boolean
}

const tiles: Tile[] = [
  { type: 1, label: 'OSC',          color: '#36ABFF', enabled: true  },
  { type: 4, label: 'StageControl', color: '#1BFEE9', enabled: true  },
  { type: 2, label: 'UltraGrid',    color: '#F0DE01', enabled: false },
  { type: 6, label: 'MoCap',        color: '#FFA126', enabled: false }
]

const POPUP_WIDTH = 180
const POPUP_HEIGHT = 188

const style = computePosition()

function computePosition() {
  const r = props.anchorRect
  let left = r.left + r.width / 2 - POPUP_WIDTH / 2
  let top = r.bottom + 4
  const maxLeft = window.innerWidth - POPUP_WIDTH - 8
  if (left > maxLeft) left = maxLeft
  if (left < 8) left = 8
  if (top + POPUP_HEIGHT > window.innerHeight - 8) {
    top = r.top - POPUP_HEIGHT - 4
  }
  return { left: `${left}px`, top: `${top}px`, width: `${POPUP_WIDTH}px` }
}

function onTileClick(tile: Tile) {
  if (!tile.enabled) return
  emit('select', tile.type)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.add-device-popup')) emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  setTimeout(() => document.addEventListener('click', onDocClick), 0)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="add-device-popup" :style="style">
    <div class="popup-title">Add device</div>
    <div class="tile-grid">
      <button
        v-for="tile in tiles"
        :key="tile.type"
        class="tile"
        :class="{ disabled: !tile.enabled }"
        :style="{ '--tile-color': tile.color } as any"
        :disabled="!tile.enabled"
        :title="tile.enabled ? tile.label : `${tile.label} (not yet available)`"
        @click="onTileClick(tile)"
      >
        <div class="tile-dot" />
        <div class="tile-label">{{ tile.label }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.add-device-popup {
  position: fixed;
  z-index: 500;
  background: #1f1f1f;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}
.popup-title {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 4px 6px;
}
.tile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  color: #ddd;
  font-size: 11px;
  transition: filter 0.1s, border-color 0.15s;
}
.tile:hover:not(.disabled) {
  filter: brightness(1.2);
  border-color: var(--tile-color);
}
.tile.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tile-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--tile-color);
}
.tile-label {
  font-weight: 500;
  white-space: nowrap;
}
</style>
