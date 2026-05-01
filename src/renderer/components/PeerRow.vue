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
  peerInfoActive?: boolean
}>()

const emit = defineEmits<{
  cellClick: [channelIndex: number]
  openPopup: [channelIndex: number, rect: DOMRect]
  removeDevice: [channelIndex: number]
  peerInfoClick: []
}>()

const cellsLocked = computed(() => props.isLocked && !props.isLocal)

function toggleLock() {
  const next = props.isLocked ? '0' : '1'
  window.api.invoke('mqtt:publish', {
    topic: `/peer/${props.peerId}/settings/lock/enable`,
    value: next,
    retain: true
  })
}

function channelData(index: number) {
  const key = `channel.${index}`
  const ch = props.channels?.[key]
  return {
    loaded: ch?.loaded ?? '0',
    description: ch?.device?.gui?.description ?? '',
    enable: ch?.device?.gui?.enable ?? '0',
    inputIndicator: ch?.device?.gui?.inputIndicator ?? '0',
    outputIndicator: ch?.device?.gui?.outputIndicator ?? '0',
    indicators: typeof ch?.device?.gui?.indicators === 'string'
      ? ch.device.gui.indicators
      : '',
    ugMode: ch?.device?.gui?.network?.mode ?? '',
    ugTransmission: ch?.device?.gui?.audioVideo?.transmission ?? '',
    ugConnection: ch?.device?.gui?.audioVideo?.connection ?? '',
    mocapDirectionSelect: ch?.device?.gui?.direction?.select ?? ''
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
      :class="{ 'peer-info-active': peerInfoActive }"
      :style="{ background: peerColors.bg, borderLeftColor: peerColors.border }"
      @click="emit('peerInfoClick')"
    >
      <div class="peer-dot" :style="{ background: peerColors.dot }" />
      <div class="peer-text">
        <div class="peer-name" :style="{ color: peerColors.name }">
          {{ peerName }}
          <span v-if="isLocal" class="peer-tag">(you)</span>
        </div>
        <div v-if="peerIp" class="peer-ip" :style="{ color: peerColors.ip }">{{ peerIp }}</div>
      </div>
      <button
        v-if="isLocal"
        class="lock-toggle"
        :class="{ locked: isLocked }"
        :title="isLocked ? 'Unlock your row' : 'Lock your row'"
        @click="toggleLock"
      >
        <svg v-if="isLocked" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 7V5a4 4 0 0 1 8 0v2h1v7H3V7h1zm2 0h4V5a2 2 0 1 0-4 0v2z" fill="currentColor"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 7V5a4 4 0 0 1 7.465-2.04l-1.73 1A2 2 0 0 0 6 5v2h7v7H3V7h1z" fill="currentColor"/>
        </svg>
      </button>
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
        :indicators="channelData(i - 1).indicators"
        :ug-mode="channelData(i - 1).ugMode"
        :ug-transmission="channelData(i - 1).ugTransmission"
        :ug-connection="channelData(i - 1).ugConnection"
        :mocap-direction-select="channelData(i - 1).mocapDirectionSelect"
        :is-local="isLocal"
        :is-locked="cellsLocked"
        :selected="selectedChannel === i - 1"
        @click="emit('cellClick', i - 1)"
        @open-popup="(rect) => emit('openPopup', i - 1, rect)"
        @remove-device="emit('removeDevice', i - 1)"
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
  cursor: pointer;
}

.peer-info:hover {
  filter: brightness(1.25);
}

.peer-info.peer-info-active {
  outline: 1px solid #555;
  outline-offset: -1px;
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

.lock-toggle {
  background: transparent;
  border: 1px solid #444;
  color: #888;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.lock-toggle:hover {
  color: #ccc;
  border-color: #666;
}

.lock-toggle.locked {
  color: #e6b800;
  border-color: #8a6d00;
}

</style>
