<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loaded: string
  description: string
  enable: string
  inputIndicator: string
  outputIndicator: string
  indicators: string
  ugMode: string
  mocapDirectionSelect: string
  isLocal: boolean
  isLocked: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  click: []
  openPopup: [rect: DOMRect]
}>()

function handleOpenPopup(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  emit('openPopup', target.getBoundingClientRect())
}

const isEmpty = computed(() => props.loaded === '0' || props.loaded === '')
const isEnabled = computed(() => props.enable === '1')

const DEVICE_STYLES: Record<string, { color: string; dim: string; label: string }> = {
  '1': { color: '#36ABFF', dim: '#13527F', label: 'OSC' },
  '2': { color: '#F0DE01', dim: '#787000', label: 'UltraGrid' },
  '3': { color: '#FFA126', dim: '#7F500F', label: 'MoCap' },
  '4': { color: '#FE5FF5', dim: '#7F2F7A', label: 'StageC' }
}

const DISABLED_COLOR = '#555'

const style = computed(() => DEVICE_STYLES[props.loaded] ?? { color: '#888', dim: '#444', label: 'device' })
const label = computed(() => props.description || style.value.label)

const labelColor = computed(() => isEnabled.value ? style.value.color : DISABLED_COLOR)
const borderColor = computed(() => {
  if (isEmpty.value) return '#444'
  return isEnabled.value ? style.value.color : '#444'
})
const backgroundColor = computed(() => {
  if (isEmpty.value) return '#333'
  return isEnabled.value ? '#333' : '#1a1a1a'
})

// MoCap direction comes from direction/select, passed via the mocapDirectionSelect prop.
const mocapDirection = computed<'tx' | 'rx' | 'local'>(() => {
  if (props.mocapDirectionSelect === '2') return 'rx'
  if (props.mocapDirectionSelect === '4') return 'local'
  return 'tx'
})

const direction = computed(() => {
  switch (props.loaded) {
    case '1': case '4': return 'bidi'
    case '2': return ugDirection.value
    case '3': return mocapDirection.value
    default: return 'tx'
  }
})

// UG icon direction tracks the active network mode:
//   1 (send-to-router)      → tx   (up arrow into sink)
//   2 (receive-from-router) → rx   (down arrow out of sink)
//   4 (p2p-auto)            → bidi (up + down arrows)
//   5 (p2p-manual)          → bidi (up + down arrows)
//   7 (capture-to-local)    → loop (FromLocal: right-turn loopback, see color_scheme.html)
// Unknown/missing mode defaults to tx to match pre-mode-2 behavior.
const ugDirection = computed<'tx' | 'rx' | 'bidi' | 'loop'>(() => {
  switch (props.ugMode) {
    case '2': return 'rx'
    case '4': case '5': return 'bidi'
    case '7': return 'loop'
    default: return 'tx'
  }
})

// Data flow indicators — per-device-type wire format (see docs/device-icon-mapping.md).
// OSC/StageC (loaded=1|4): separate inputIndicator/outputIndicator topics.
// UG (loaded=2): single `indicators` topic, space-separated, positions 0=TX active, 1=RX active.
// MoCap (loaded=3): `indicators` topic: positions 0=major active, 1=minor active, 2=direction, 3=running.
const indicatorTokens = computed(() => props.indicators.trim().split(/\s+/).filter(Boolean))
const txActive = computed(() => {
  if (!isEnabled.value) return false
  if (props.loaded === '2' || props.loaded === '3') {
    return indicatorTokens.value[0] === '1'
  }
  return Number(props.inputIndicator) > 0
})
const rxActive = computed(() => {
  if (!isEnabled.value) return false
  if (props.loaded === '2' || props.loaded === '3') {
    return indicatorTokens.value[1] === '1'
  }
  return Number(props.outputIndicator) > 0
})

// All-solid-fill rendering: disabled = #555, enabled-idle arrow = dim device color,
// enabled-active arrow = device color, enabled sink = device color. No strokes.
const deviceColor = computed(() => style.value.color)
const dimColor = computed(() => style.value.dim)

const txFill = computed(() => !isEnabled.value ? DISABLED_COLOR : txActive.value ? deviceColor.value : dimColor.value)
const rxFill = computed(() => !isEnabled.value ? DISABLED_COLOR : rxActive.value ? deviceColor.value : dimColor.value)
const sinkFill = computed(() => {
  if (!isEnabled.value) return DISABLED_COLOR
  return (txActive.value || rxActive.value) ? deviceColor.value : dimColor.value
})
</script>

<template>
  <div
    class="device-cell"
    :class="{ empty: isEmpty, selected }"
    :style="{ borderColor, background: backgroundColor }"
    @click="isEmpty ? undefined : emit('click')"
  >
    <!-- Empty cell: centered + icon -->
    <template v-if="isEmpty">
      <div
        v-if="!isLocked"
        class="empty-plus"
        @click.stop="handleOpenPopup"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </template>

    <!-- Occupied cell: icon + label -->
    <template v-else>
      <div class="cell-inner">
        <div class="dev-icon">
          <!-- Bidirectional: UpStream + DownStream + Sink -->
          <svg v-if="direction === 'bidi'" width="28" height="28" viewBox="0 0 200 200"
            stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" :fill="sinkFill"/>
            <path d="M 119.98763,149.94015 118.84557,59.940148 H 99.416606 l 29.999994,-40 30,40 h -20.57103 l 1.14206,90.000002 z" :fill="txFill"/>
            <path d="m 80.01231,19.999998 1.14206,90.059852 h 19.42897 l -30,39.94015 -30,-39.94015 H 61.15437 L 60.01231,19.999998 Z" :fill="rxFill"/>
          </svg>
          <!-- MoCap TX (send to router): large up-right + small up-left minor -->
          <svg v-else-if="direction === 'tx'" width="28" height="28" viewBox="0 0 200 200"
            stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" :fill="sinkFill"/>
            <path d="M 119.98763,149.94015 118.84557,59.940148 H 99.416606 l 29.999994,-40 30,40 h -20.57103 l 1.14206,90.000002 z" :fill="txFill"/>
            <path d="m 64.332575,85.396692 0.56301,44.571838 h 9.5779 l -14.7891,19.76692 -14.7891,-19.76692 h 10.1409 l -0.563,-44.571838 z" :fill="rxFill"/>
          </svg>
          <!-- MoCap RX (receive from router): large down-left + small up-right minor -->
          <svg v-else-if="direction === 'rx'" width="28" height="28" viewBox="0 0 200 200"
            stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" :fill="sinkFill"/>
            <path d="m 80.01231,19.999998 1.14206,90.059852 h 19.42897 l -30,39.94015 -30,-39.94015 H 61.15437 L 60.01231,19.999998 Z" :fill="txFill"/>
            <path d="m 135.74171,150.16519 -0.56693,-44.85035 h -9.64464 l 14.89216,-19.933489 14.89216,19.933489 h -10.21157 l 0.56692,44.85035 z" :fill="rxFill"/>
          </svg>
          <!-- MoCap Local (send to local): right arrow out + left down arrow in -->
          <svg v-else-if="direction === 'local'" width="28" height="28" viewBox="0 0 200 200"
            stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" :fill="sinkFill"/>
            <path d="m 110,60 40,0.254882 V 40 l 40,30 -40,30 V 80.254881 L 130,80 v 69.93036 l -20,0.13928 z" :fill="txFill"/>
            <path d="m 69.326146,92.99619 v 31.94097 H 82.098857 L 62.93979,150.4517 43.780725,124.93716 h 12.77271 V 105.77258 H 31.05249 L 30.96354,92.996191 Z" :fill="rxFill"/>
          </svg>
          <!-- Loop: FromLocal (UG capture-to-local loopback, see color_scheme.html) -->
          <svg v-else-if="direction === 'loop'" width="28" height="28" viewBox="0 0 200 200"
            stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" :fill="sinkFill"/>
            <path d="m 144.15955,60.595724 v 49.999996 h 20 l -30,39.94015 -30,-39.94015 h 20 V 80.595724 l -51.997483,0.393303 0.0838,70.085463 -22.350659,0.20395 0.09425,-90.602178 z" :fill="sinkFill"/>
          </svg>
        </div>
        <div class="dev-label" :style="{ color: labelColor }">
          {{ label }}
        </div>
      </div>
      <div
        v-if="!isLocked"
        class="cell-plus"
        @click.stop="handleOpenPopup"
      >+</div>
    </template>
  </div>
</template>

<style scoped>
.device-cell {
  width: 50px;
  height: 50px;
  min-width: 50px;
  box-sizing: border-box;
  border: 1px solid #444;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: filter 0.1s, border-color 0.15s;
  border-radius: 3px;
}
.device-cell:hover { filter: brightness(1.1); }
.device-cell.empty { cursor: default; }
.device-cell.selected { box-shadow: 0 0 0 2px #36ABFF; }

.cell-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0px;
}

.dev-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dev-label {
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  margin-top: 2px;
  max-width: 46px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-plus {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
  opacity: 0;
  transition: opacity 0.15s;
  line-height: 1;
}
.device-cell:hover .cell-plus { opacity: 1; }

.empty-plus {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 2px;
  opacity: 0.3;
  cursor: pointer;
  color: #aaa;
}
.device-cell.empty:hover .empty-plus { opacity: 0.6; }
</style>
