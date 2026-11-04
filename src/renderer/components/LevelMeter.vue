<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseLevels, levelToFraction, formatDb } from '../utils/levels'

// Classic loudness bars, one column per audio channel. Fill = RMS, tick = peak,
// both on a -60..0 dBFS scale. TX and RX each get a full-width row, so more
// channels simply mean narrower bars. Hovering a bar shows the exact values in a
// custom tooltip (native `title` tooltips are not reliable in the Electron window).
const props = defineProps<{
  tx: string
  rx: string
}>()

const rows = computed(() =>
  [
    { key: 'tx', label: 'TX', channels: parseLevels(props.tx) },
    { key: 'rx', label: 'RX', channels: parseLevels(props.rx) }
  ].filter((r) => r.channels.length > 0)
)

interface Hover {
  key: string
  index: number
  x: number
  y: number
}
const hover = ref<Hover | null>(null)

function onMove(e: MouseEvent, key: string, index: number): void {
  hover.value = { key, index, x: e.clientX, y: e.clientY }
}

// Resolved from the live data on every render, so the text follows new values
// while the mouse rests on a bar.
const tooltipText = computed(() => {
  const h = hover.value
  if (!h) return ''
  const row = rows.value.find((r) => r.key === h.key)
  const c = row?.channels[h.index]
  if (!row || !c) return ''
  const peak = c.peak === null ? '' : ` · peak ${formatDb(c.peak)} dBFS`
  return `${row.label} ch ${h.index + 1} · RMS ${formatDb(c.rms)} dBFS${peak}`
})

const tooltipStyle = computed(() => ({
  left: `${(hover.value?.x ?? 0) + 12}px`,
  top: `${(hover.value?.y ?? 0) + 16}px`
}))
</script>

<template>
  <div v-if="rows.length" class="level-meter" data-testid="level-meter" @mouseleave="hover = null">
    <div v-for="row in rows" :key="row.key" class="row">
      <span class="row-label">{{ row.label }}</span>
      <div
        v-for="(c, i) in row.channels"
        :key="i"
        class="bar"
        :data-testid="`${row.key}-bar-${i}`"
        @mouseenter="onMove($event, row.key, i)"
        @mousemove="onMove($event, row.key, i)"
        @mouseleave="hover = null"
      >
        <div class="fill" :style="{ height: levelToFraction(c.rms) * 100 + '%' }" />
        <div
          v-if="c.peak !== null"
          class="peak"
          :style="{ bottom: levelToFraction(c.peak) * 100 + '%' }"
        />
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div v-if="hover && tooltipText" class="level-tooltip" :style="tooltipStyle" role="tooltip">
      {{ tooltipText }}
    </div>
  </Teleport>
</template>

<style scoped>
.level-meter { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.row { position: relative; display: flex; gap: 1px; height: 26px; }
.row-label {
  position: absolute; left: 4px; top: 2px; z-index: 1; pointer-events: none;
  font-size: 9px; line-height: 1; color: #bbb; text-shadow: 0 0 3px #000, 0 0 3px #000;
}
.bar {
  position: relative; flex: 1 1 0; min-width: 0; height: 100%;
  background: #1a1a1a; border: 1px solid #333; border-radius: 2px; overflow: hidden;
}
.bar:hover { border-color: #777; }
.fill {
  position: absolute; left: 0; right: 0; bottom: 0; pointer-events: none;
  background: linear-gradient(to top, #1D9E75 0, #1D9E75 70%, #e0b030 85%, #d94040 100%);
  background-size: 100% 26px; background-position: bottom;
}
.peak { position: absolute; left: 0; right: 0; height: 2px; background: #eee; transform: translateY(1px); pointer-events: none; }
</style>

<style>
/* Unscoped: the tooltip is teleported to <body>. */
.level-tooltip {
  position: fixed; z-index: 10000; pointer-events: none; white-space: nowrap;
  padding: 4px 8px; border-radius: 4px; border: 1px solid #555;
  background: #111; color: #eee; font-size: 11px; font-family: monospace;
}
</style>
