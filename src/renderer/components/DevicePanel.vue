<script setup lang="ts">
import OscPanel from './panels/OscPanel.vue'
import UltraGridPanel from './panels/UltraGridPanel.vue'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  peerName: string
  roomName: string
  deviceState: any
  peerSettings?: any
  isLocal: boolean
  targetLocked: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')
const description = computed(() => props.deviceState?.device?.gui?.description ?? 'device')

const deviceTypeLabel = computed(() => {
  switch (loaded.value) {
    case '1': return 'OSC'
    case '2': return 'UltraGrid'
    case '3': return 'MoCap'
    case '4': return 'StageControl'
    default: return ''
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="device-panel" @keydown="onKeydown" tabindex="0">
    <div class="panel-breadcrumb">
      {{ roomName }} &gt; {{ peerName }} &gt; {{ description }} &gt; channel {{ channelIndex }}
    </div>
    <div v-if="deviceTypeLabel" class="panel-type-label">{{ deviceTypeLabel }}</div>
    <button class="close-btn" @click="emit('close')">X</button>

    <OscPanel
      v-if="loaded === '1' || loaded === '4'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('close')"
    />

    <UltraGridPanel
      v-else-if="loaded === '2'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :peer-settings="peerSettings"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('close')"
    />

    <div v-else class="unsupported">
      Device type {{ loaded }} is not yet supported in this milestone.
    </div>
  </div>
</template>

<style scoped>
.device-panel {
  position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
  background: #1a1a1a; border-left: 1px solid #333;
  display: flex; flex-direction: column; z-index: 100;
}
.panel-breadcrumb { font-size: 11px; color: #888; padding: 8px 12px 2px; font-family: monospace; }
.panel-type-label { font-size: 10px; color: #aaa; padding: 0 12px 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.close-btn { position: absolute; top: 8px; right: 12px; background: none; border: none; color: #888; cursor: pointer; font-size: 14px; }
.unsupported { padding: 24px; color: #666; text-align: center; }
</style>
