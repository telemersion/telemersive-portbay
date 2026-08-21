<script setup lang="ts">
const props = defineProps<{
  on: boolean
  accent: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:on': [value: boolean]
}>()

function setOn(value: boolean): void {
  if (props.disabled || props.on === value) return
  emit('update:on', value)
}
</script>

<template>
  <span class="monitor-toggle" :class="{ disabled }" :style="{ '--accent': accent }">
    <button
      type="button"
      class="segment off"
      :class="{ active: !on }"
      :disabled="disabled"
      @click="setOn(false)"
    >
      Off
    </button>
    <button
      type="button"
      class="segment on"
      :class="{ active: on }"
      :disabled="disabled"
      @click="setOn(true)"
    >
      Monitor
    </button>
  </span>
</template>

<style scoped>
.monitor-toggle {
  display: inline-flex;
  border: 1px solid #555;
  border-radius: 4px;
  overflow: hidden;
}
.monitor-toggle.disabled {
  opacity: 0.4;
}
.segment {
  padding: 2px 8px;
  border: none;
  background: none;
  color: #888;
  cursor: pointer;
  font-size: 10px;
  line-height: 1.4;
}
.segment:disabled {
  cursor: not-allowed;
}
.segment.off.active {
  background: #333;
  color: #ccc;
}
.segment.on.active {
  background: var(--accent);
  color: white;
}
.segment + .segment {
  border-left: 1px solid #555;
}
</style>
