<script setup lang="ts">
import { computed } from 'vue'
import DeviceCell from './DeviceCell.vue'

const props = defineProps<{
  peerId: string
  peerName: string
  peerColor: string
  peerIp: string
  isLocal: boolean
  isLocked: boolean
  channels: Record<string, any>
  channelCount: number
  selectedChannel: number | null
}>()

const emit = defineEmits<{
  cellClick: [channelIndex: number]
  addDevice: [channelIndex: number, deviceType: number]
}>()

function channelData(index: number) {
  const key = `channel.${index}`
  const ch = props.channels?.[key]
  return {
    loaded: ch?.loaded ?? '0',
    description: ch?.device?.gui?.description ?? '',
    enable: ch?.device?.gui?.enable ?? '0',
    inputIndicator: ch?.device?.gui?.inputIndicator ?? '0',
    outputIndicator: ch?.device?.gui?.outputIndicator ?? '0'
  }
}

// Derive tinted colors from peer color
const peerColors = computed(() => {
  if (!props.peerColor) {
    // Default gray when no color assigned
    return {
      dot: '#666',
      bg: '#222',
      border: '#666',
      name: '#ccc',
      ip: '#888'
    }
  }
  const parts = props.peerColor.split(' ').map(Number)
  if (parts.length < 3) {
    return { dot: '#666', bg: '#222', border: '#666', name: '#ccc', ip: '#888' }
  }
  const r = parts[0], g = parts[1], b = parts[2]

  // Dot / border accent: full color
  const dot = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
  // Background: very dark tint of the color
  const bg = `rgb(${Math.round(r * 30)},${Math.round(g * 30)},${Math.round(b * 30)})`
  // Name: lighter version
  const name = `rgb(${Math.round(140 + r * 115)},${Math.round(140 + g * 115)},${Math.round(140 + b * 115)})`
  // IP: mid brightness
  const ip = `rgb(${Math.round(60 + r * 120)},${Math.round(60 + g * 120)},${Math.round(60 + b * 120)})`

  return { dot, bg, border: dot, name, ip }
})
</script>

<template>
  <div class="peer-row">
    <div
      class="peer-info"
      :style="{ background: peerColors.bg, borderLeftColor: peerColors.border }"
    >
      <div class="peer-dot" :style="{ background: peerColors.dot }" />
      <div class="peer-text">
        <div class="peer-name" :style="{ color: peerColors.name }">
          {{ peerName }}
          <span v-if="isLocal" class="peer-tag">(you)</span>
        </div>
        <div v-if="peerIp" class="peer-ip" :style="{ color: peerColors.ip }">{{ peerIp }}</div>
      </div>
    </div>
    <div class="peer-cells">
      <DeviceCell
        v-for="i in channelCount"
        :key="i - 1"
        :loaded="channelData(i - 1).loaded"
        :description="channelData(i - 1).description"
        :enable="channelData(i - 1).enable"
        :input-indicator="channelData(i - 1).inputIndicator"
        :output-indicator="channelData(i - 1).outputIndicator"
        :is-local="isLocal"
        :is-locked="isLocked"
        :selected="selectedChannel === i - 1"
        @click="emit('cellClick', i - 1)"
        @add="(type) => emit('addDevice', i - 1, type)"
      />
    </div>
  </div>
</template>

<style scoped>
.peer-row {
  display: contents;
}

.peer-info {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 150px;
  max-width: 150px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  border-left: 3px solid transparent;
  background: #222;
  align-self: stretch;
}

.peer-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.peer-text {
  min-width: 0;
  flex: 1;
}

.peer-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.peer-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #252525;
  color: #888;
  font-weight: 400;
}

.peer-ip {
  font-size: 10px;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.peer-cells {
  display: flex;
  gap: 2px;
  align-items: center;
}
</style>
