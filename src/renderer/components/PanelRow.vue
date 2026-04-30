<script setup lang="ts">
import { ref } from 'vue'
import type { PanelSlot } from '../composables/usePanelRow'
import PanelSlotHeader from './PanelSlotHeader.vue'
import DevicePanel from './DevicePanel.vue'

const props = defineProps<{
  slots: PanelSlot[]
  activeId: string | null
  getDeviceState: (peerId: string, channelIndex: number) => any
  getDeviceSettings: (peerId: string) => any
  getPeerName: (peerId: string) => string
  isLocal: (peerId: string) => boolean
  isLocked: (peerId: string) => boolean
}>()

const emit = defineEmits<{
  pin: [id: string]
  close: [id: string]
  activate: [id: string]
  reorder: [fromIndex: number, toIndex: number]
  remove: [peerId: string, channelIndex: number]
}>()

const SLOT_WIDTH = 380

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number, slot: PanelSlot) {
  if (!slot.pinned) return
  dragFromIndex.value = index
  e.dataTransfer?.setData('text/plain', String(index))
}

function onDragOver(e: DragEvent, index: number, slot: PanelSlot) {
  if (!slot.pinned) return
  if (dragFromIndex.value === null) return
  e.preventDefault()
  dragOverIndex.value = index
}

function onDrop(index: number, slot: PanelSlot) {
  if (!slot.pinned) return
  if (dragFromIndex.value === null || dragFromIndex.value === index) {
    dragFromIndex.value = null
    dragOverIndex.value = null
    return
  }
  emit('reorder', dragFromIndex.value, index)
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <div class="panel-row">
    <div
      v-for="(slot, index) in slots"
      :key="slot.id"
      class="panel-slot"
      :class="{
        'drag-over': dragOverIndex === index && slot.pinned,
        'is-floating': !slot.pinned
      }"
      :style="{ width: SLOT_WIDTH + 'px' }"
      :draggable="slot.pinned"
      @dragstart="(e) => onDragStart(e, index, slot)"
      @dragover="(e) => onDragOver(e, index, slot)"
      @drop="onDrop(index, slot)"
      @dragend="onDragEnd"
    >
      <PanelSlotHeader
        :peer-id="slot.peerId"
        :channel-index="slot.channelIndex"
        :peer-name="getPeerName(slot.peerId)"
        :device-state="getDeviceState(slot.peerId, slot.channelIndex)"
        :pinned="slot.pinned"
        :active="activeId === slot.id"
        @pin="emit('pin', slot.id)"
        @close="emit('close', slot.id)"
        @activate="emit('activate', slot.id)"
      />
      <DevicePanel
        :peer-id="slot.peerId"
        :channel-index="slot.channelIndex"
        :device-state="getDeviceState(slot.peerId, slot.channelIndex)"
        :peer-settings="getDeviceSettings(slot.peerId)"
        :is-local="isLocal(slot.peerId)"
        :target-locked="isLocked(slot.peerId)"
        @remove="emit('remove', slot.peerId, slot.channelIndex)"
      />
    </div>
  </div>
</template>

<style scoped>
.panel-row {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  background: #1a1a1a;
  border-top: 1px solid #333;
  scrollbar-color: #555 transparent;
  scrollbar-width: thin;
}

.panel-row::-webkit-scrollbar { height: 8px; }
.panel-row::-webkit-scrollbar-track { background: transparent; }
.panel-row::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }

.panel-slot {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid #2a2a2a;
  height: 100%;
  overflow: hidden;
}

.panel-slot.drag-over {
  border-left: 2px solid #1BFEE9;
}

.panel-slot.is-floating {
  border-left: 1px solid #333;
}
</style>
