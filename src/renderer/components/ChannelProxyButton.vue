<script setup lang="ts">
import { computed } from 'vue'
import type { ProxyEntry } from '../state/switchboardState'

const props = defineProps<{
  channelIndex: number
  proxies: ProxyEntry[]
  error: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const runningCount = computed(() => props.proxies.filter(p => p.running).length)

const status = computed(() => {
  if (props.error) return 'error'
  if (props.proxies.length === 0) return 'none'
  if (runningCount.value === props.proxies.length) return 'all'
  if (runningCount.value === 0) return 'stopped'
  return 'mixed'
})

const tooltip = computed(() => {
  if (props.error) return 'Switchboard unreachable'
  if (props.proxies.length === 0) return `Channel ${props.channelIndex}: no proxies`
  return `Channel ${props.channelIndex}: ${runningCount.value}/${props.proxies.length} proxies running`
})
</script>

<template>
  <button class="ch-button" :class="`status-${status}`" :title="tooltip" @click="emit('click')">
    <span class="ch-num">{{ props.channelIndex }}</span>
    <span class="ch-dot" />
  </button>
</template>

<style scoped>
.ch-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 50px;
  width: 50px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 10px;
  color: #555;
}

.ch-button:hover {
  color: #ccc;
}

.ch-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #444;
}

.status-all .ch-dot { background: #4caf50; }
.status-mixed .ch-dot { background: #e6c200; }
.status-stopped .ch-dot { background: #e68a00; }
.status-none .ch-dot { background: #444; }
.status-error .ch-dot { background: #e53935; }
</style>
