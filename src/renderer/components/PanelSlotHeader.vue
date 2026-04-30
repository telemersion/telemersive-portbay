<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  peerName: string
  deviceState: any
  pinned: boolean
  active: boolean
}>()

const emit = defineEmits<{
  pin: []
  close: []
  activate: []
}>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')

const deviceColor = computed(() => {
  switch (loaded.value) {
    case '1': return '#36ABFF'
    case '2': return '#1BFEE9'
    case '3': return '#FFA126'
    case '4': return '#FE5FF5'
    default:  return '#555'
  }
})

const deviceLabel = computed(() => {
  switch (loaded.value) {
    case '1': return 'OSC'
    case '2': return 'UG'
    case '3': return 'MC'
    case '4': return 'SC'
    default:  return '?'
  }
})

const ugIndicators = computed(() => {
  if (loaded.value !== '2') return null
  const raw = props.deviceState?.device?.gui?.indicators ?? ''
  const parts = raw.split(' ')
  return {
    txFps:   parseFloat(parts[2]) || 0,
    txVol:   parseFloat(parts[3]) || 0,
    rxFps:   parseFloat(parts[4]) || 0,
    rxVol:   parseFloat(parts[5]) || 0,
    txActive: parts[0] === '1',
    rxActive: parts[1] === '1',
  }
})

const oscTxActive = computed(() => {
  if (loaded.value !== '1' && loaded.value !== '4') return false
  return Number(props.deviceState?.device?.gui?.outputIndicator ?? 0) > 0
})
const oscRxActive = computed(() => {
  if (loaded.value !== '1' && loaded.value !== '4') return false
  return Number(props.deviceState?.device?.gui?.inputIndicator ?? 0) > 0
})

const mocapRxActive = computed(() => {
  if (loaded.value !== '3') return false
  const raw = props.deviceState?.device?.gui?.indicators ?? ''
  return raw.split(' ')[1] === '1'
})
</script>

<template>
  <div
    class="slot-header"
    :class="{ active }"
    @click="emit('activate')"
  >
    <span class="device-badge" :style="{ color: deviceColor, borderColor: deviceColor }">
      {{ deviceLabel }}
    </span>
    <span class="peer-name">{{ peerName }}</span>
    <span class="ch-label">ch.{{ channelIndex }}</span>

    <template v-if="loaded === '2' && ugIndicators">
      <span class="metric" :class="{ active: ugIndicators.txActive }">
        TX {{ ugIndicators.txFps.toFixed(1) }}fps {{ ugIndicators.txVol.toFixed(1) }}dB
      </span>
      <span class="metric" :class="{ active: ugIndicators.rxActive }">
        RX {{ ugIndicators.rxFps.toFixed(1) }}fps {{ ugIndicators.rxVol.toFixed(1) }}dB
      </span>
    </template>

    <template v-else-if="loaded === '1' || loaded === '4'">
      <span class="pulse" :class="{ active: oscTxActive }" title="TX">▲</span>
      <span class="pulse" :class="{ active: oscRxActive }" title="RX">▼</span>
    </template>

    <template v-else-if="loaded === '3'">
      <span class="pulse" :class="{ active: mocapRxActive }" title="RX">▼</span>
    </template>

    <div class="slot-actions">
      <button v-if="!pinned" class="action-btn" title="Pin panel" @click.stop="emit('pin')">
        📌
      </button>
      <button v-else class="action-btn" title="Close panel" @click.stop="emit('close')">
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.slot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #222;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  user-select: none;
  min-height: 28px;
  flex-shrink: 0;
}

.slot-header.active {
  border-bottom-color: #1BFEE9;
}

.device-badge {
  font-size: 9px;
  font-weight: bold;
  border: 1px solid;
  border-radius: 3px;
  padding: 1px 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.peer-name {
  font-size: 11px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.ch-label {
  font-size: 10px;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

.metric {
  font-size: 9px;
  color: #555;
  white-space: nowrap;
  font-family: monospace;
  flex-shrink: 0;
  transition: color 0.15s;
}

.metric.active { color: #1BFEE9; }

.pulse {
  font-size: 9px;
  color: #444;
  flex-shrink: 0;
  transition: color 0.15s;
}

.pulse.active { color: #1BFEE9; }

.slot-actions { margin-left: auto; flex-shrink: 0; }

.action-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  line-height: 1;
}

.action-btn:hover { color: #ccc; }
</style>
