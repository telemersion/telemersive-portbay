<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loaded: string
  description: string
  enable: string
  inputIndicator: string
  outputIndicator: string
  isLocal: boolean
  isLocked: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  click: []
  add: [deviceType: number]
}>()

const isEmpty = computed(() => props.loaded === '0' || props.loaded === '')
const isEnabled = computed(() => props.enable === '1')

const DEVICE_STYLES: Record<string, { color: string; label: string }> = {
  '1': { color: '#36ABFF', label: 'OSC' },
  '2': { color: '#FFA126', label: 'MoCap' },
  '3': { color: '#F0DE01', label: 'ultragrid' },
  '4': { color: '#1BFEE9', label: 'ultragrid' },
  '5': { color: '#00E411', label: 'ultragrid' }
}

const style = computed(() => DEVICE_STYLES[props.loaded] ?? { color: '#888', label: 'device' })
const label = computed(() => props.description || style.value.label)

const labelColor = computed(() => isEnabled.value ? style.value.color : '#999')
const borderColor = computed(() => {
  if (isEmpty.value) return '#444'
  return isEnabled.value ? style.value.color : '#444'
})

const direction = computed(() => {
  switch (props.loaded) {
    case '1': case '4': return 'bidi'
    case '2': return 'tx'
    default: return 'tx'
  }
})

// Data flow indicators
// OSC/StageControl: inputIndicator > 0 → TX (UpStream) active, outputIndicator > 0 → RX (DownStream) active
// inputIndicator = data coming IN to device from local apps → sent UP to server
// outputIndicator = data coming OUT from server → flowing DOWN to local apps
const txActive = computed(() => isEnabled.value && Number(props.inputIndicator) > 0)
const rxActive = computed(() => isEnabled.value && Number(props.outputIndicator) > 0)

// Per-arrow rendering: active = filled device color, idle = white stroke, disabled = #999 stroke
const deviceColor = computed(() => style.value.color)

// UpStream arrow (TX direction)
const txStroke = computed(() => !isEnabled.value ? '#999' : txActive.value ? deviceColor.value : '#fff')
const txFill = computed(() => !isEnabled.value ? 'none' : txActive.value ? deviceColor.value : 'none')

// DownStream arrow (RX direction)
const rxStroke = computed(() => !isEnabled.value ? '#999' : rxActive.value ? deviceColor.value : '#fff')
const rxFill = computed(() => !isEnabled.value ? 'none' : rxActive.value ? deviceColor.value : 'none')

// Sink: always white when enabled, #999 when disabled
const sinkStroke = computed(() => isEnabled.value ? '#fff' : '#999')
</script>

<template>
  <div
    class="device-cell"
    :class="{ empty: isEmpty, selected }"
    :style="{ borderColor }"
    @click="isEmpty ? undefined : emit('click')"
  >
    <!-- Empty cell: centered + icon -->
    <template v-if="isEmpty">
      <div
        v-if="!isLocked || isLocal"
        class="empty-plus"
        @click.stop="emit('add', 1)"
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
            stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" fill="none" :stroke="sinkStroke"/>
            <path d="M 119.98763,149.94015 118.84557,59.940148 H 99.416606 l 29.999994,-40 30,40 h -20.57103 l 1.14206,90.000002 z" :fill="txFill" :stroke="txStroke"/>
            <path d="m 80.01231,19.999998 1.14206,90.059852 h 19.42897 l -30,39.94015 -30,-39.94015 H 61.15437 L 60.01231,19.999998 Z" :fill="rxFill" :stroke="rxStroke"/>
          </svg>
          <!-- TX: ToServer (up arrow) -->
          <svg v-else-if="direction === 'tx'" width="28" height="28" viewBox="0 0 200 200"
            stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" fill="none" :stroke="sinkStroke"/>
            <path d="M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z" :fill="txFill" :stroke="txStroke"/>
          </svg>
          <!-- RX: FromServer (down arrow) -->
          <svg v-else width="28" height="28" viewBox="0 0 200 200"
            stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
            <path d="m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z" fill="none" :stroke="sinkStroke"/>
            <path d="M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z" :fill="rxFill" :stroke="rxStroke"/>
          </svg>
        </div>
        <div class="dev-label" :style="{ color: labelColor }">
          {{ label }}
        </div>
      </div>
      <div v-if="!isLocked || isLocal" class="cell-plus">+</div>
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
