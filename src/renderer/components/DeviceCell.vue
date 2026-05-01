<script setup lang="ts">
import { computed } from 'vue'
import { ICON_COMPOSITES } from '../assets/icons'
import { DEVICE_STYLES, UG_STYLES } from '../assets/design'

const props = defineProps<{
  loaded: string
  description: string
  enable: string
  inputIndicator: string
  outputIndicator: string
  indicators: string
  ugMode: string
  ugTransmission: string
  ugConnection: string
  mocapDirectionSelect: string
  isLocal: boolean
  isLocked: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  click: []
  openPopup: [rect: DOMRect]
  removeDevice: []
}>()

function handleOpenPopup(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  emit('openPopup', target.getBoundingClientRect())
}

function handleRemoveDevice(e: MouseEvent) {
  e.stopPropagation()
  emit('removeDevice')
}

const isEmpty = computed(() => props.loaded === '0' || props.loaded === '')
const isEnabled = computed(() => props.enable === '1')


const style = computed(() => {
  if (props.loaded === '2') {
    if (props.ugTransmission === '1') return UG_STYLES.audio
    if (props.ugTransmission === '2') return UG_STYLES.both
    return UG_STYLES.video
  }
  return DEVICE_STYLES[props.loaded] ?? { color: '#888', dim: '#444', label: 'device' }
})
const label = computed(() => props.description || style.value.label)

const disabledColor = computed(() => style.value.dim)
const labelColor = computed(() => isEnabled.value ? style.value.color : disabledColor.value)
const borderColor = computed(() => {
  if (isEmpty.value) return '#333'
  return isEnabled.value ? style.value.color : '#444'
})
const backgroundColor = computed(() => {
  if (isEmpty.value) return '#1a1a1a'
  return isEnabled.value ? '#1a1a1a' : '#333'
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

// UG icon direction is determined by network/mode × audioVideo/connection
// (see docs/device-icon-mapping.md §2):
//   mode=1 (send-to-router)      → ug-tx       (forces connection=0)
//   mode=2 (receive-from-router) → ug-rx       (forces connection=1)
//   mode=4|5 (p2p auto/manual)   → ug-p2p-tx | ug-p2p-rx | ug-p2p-bidi (per connection)
//   mode=7 (capture-to-local)    → loop
// Unknown/missing mode defaults to ug-tx.
const ugDirection = computed<'ug-tx' | 'ug-rx' | 'ug-p2p-tx' | 'ug-p2p-rx' | 'ug-p2p-bidi' | 'loop'>(() => {
  switch (props.ugMode) {
    case '2': return 'ug-rx'
    case '4': case '5':
      switch (props.ugConnection) {
        case '1': return 'ug-p2p-rx'
        case '2': return 'ug-p2p-bidi'
        default: return 'ug-p2p-tx'
      }
    case '7': return 'loop'
    default: return 'ug-tx'
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

const txFill = computed(() => !isEnabled.value ? disabledColor.value : txActive.value ? deviceColor.value : dimColor.value)
const rxFill = computed(() => !isEnabled.value ? disabledColor.value : rxActive.value ? deviceColor.value : dimColor.value)
const sinkFill = computed(() => {
  if (!isEnabled.value) return disabledColor.value
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
          <svg width="28" height="28" viewBox="0 0 200 200" stroke="none" stroke-linejoin="round" stroke-linecap="round">
            <path
              v-for="(layer, i) in ICON_COMPOSITES[direction]"
              :key="i"
              :d="layer.path"
              :fill="layer.role === 'tx' ? txFill : layer.role === 'rx' ? rxFill : sinkFill"
            />
          </svg>
        </div>
        <div class="dev-label" :style="{ color: labelColor }">
          {{ label }}
        </div>
      </div>
      <div
        v-if="!isLocked"
        class="cell-plus"
        @click.stop="handleRemoveDevice"
      >−</div>
    </template>
  </div>
</template>

<style scoped>
.device-cell {
  width: 50px;
  height: 50px;
  min-width: 50px;
  box-sizing: border-box;
  border: 1px solid #333;
  background: #1a1a1a;
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
