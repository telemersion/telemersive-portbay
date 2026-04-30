<script setup lang="ts">
import OscPanel from './panels/OscPanel.vue'
import UltraGridPanel from './panels/UltraGridPanel.vue'
import NatNetPanel from './panels/NatNetPanel.vue'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  peerSettings?: any
  isLocal: boolean
  targetLocked: boolean
}>()

const emit = defineEmits<{ remove: [] }>()

const loaded = computed(() => props.deviceState?.loaded ?? '0')
</script>

<template>
  <div class="device-panel-body">
    <OscPanel
      v-if="loaded === '1' || loaded === '4'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <UltraGridPanel
      v-else-if="loaded === '2'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :peer-settings="peerSettings"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <NatNetPanel
      v-else-if="loaded === '3'"
      :peer-id="peerId"
      :channel-index="channelIndex"
      :device-state="deviceState"
      :peer-settings="peerSettings"
      :is-local="isLocal"
      :target-locked="targetLocked"
      @remove="emit('remove')"
    />

    <div v-else-if="loaded === '0'" class="unsupported loading">
      <span>Initializing...</span>
    </div>

    <div v-else class="unsupported">
      Device type {{ loaded }} is not yet supported in this milestone.
    </div>
  </div>
</template>

<style scoped>
.device-panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.unsupported {
  padding: 24px;
  color: #666;
  text-align: center;
}

.loading {
  color: #555;
  font-style: italic;
}
</style>
