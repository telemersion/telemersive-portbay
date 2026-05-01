<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  anchorRect: DOMRect
  targetLocalProps?: Record<string, string>
}>()

const emit = defineEmits<{
  select: [deviceType: number]
  close: []
}>()

interface Tile {
  type: number
  label: string
  color: string
  flag: string | null
  implemented: boolean
}

const TILES: Tile[] = [
  { type: 1, label: 'OSC',           color: '#36ABFF', flag: 'osc_enable',    implemented: true },
  { type: 4, label: 'StageControl',  color: '#FE5FF5', flag: 'stagec_enable', implemented: true },
  { type: 2, label: 'UltraGrid',     color: '#F0DE01', flag: 'ug_enable',     implemented: true },
  { type: 3, label: 'MoCap',         color: '#FFA126', flag: null,            implemented: true },
  { type: 5, label: 'Motive bridge', color: '#E84E4E', flag: 'motive_enable', implemented: true }
]

function flagValue(name: string): string | undefined {
  return props.targetLocalProps?.[name]
}

const tiles = computed(() =>
  TILES.map((t) => {
    const explicitlyDisabled = t.flag ? flagValue(t.flag) === '0' : false
    const enabled = t.implemented && !explicitlyDisabled
    const reason = !t.implemented
      ? `${t.label} (not yet available)`
      : explicitlyDisabled
        ? `${t.label} (not available on this peer)`
        : t.label
    return { ...t, enabled, title: reason }
  })
)

const POPUP_WIDTH = 180
const POPUP_HEIGHT = 56 + TILES.length * 32

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
    <div class="tile-list">
      <button
        v-for="tile in tiles"
        :key="tile.type"
        class="tile"
        :class="{ disabled: !tile.enabled }"
        :style="{ '--tile-color': tile.color } as any"
        :disabled="!tile.enabled"
        :title="tile.title"
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
.tile-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tile {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  color: #ddd;
  font-size: 12px;
  transition: filter 0.1s, border-color 0.15s;
  text-align: left;
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
