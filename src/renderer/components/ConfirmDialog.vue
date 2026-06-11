<script setup lang="ts">
import { useConfirm } from '../composables/useConfirm'

const { state, respond } = useConfirm()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') respond(false)
  if (e.key === 'Enter') respond(true)
}
</script>

<template>
  <div v-if="state.open" class="confirm-overlay" @keydown="onKeydown">
    <div class="confirm-dialog" tabindex="-1" @vue:mounted="($event.el as HTMLElement)?.focus()">
      <p class="confirm-message">{{ state.message }}</p>
      <div class="confirm-actions">
        <button class="btn" @click="respond(false)">Cancel</button>
        <button class="btn danger" @click="respond(true)">Remove</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-dialog {
  background: #1f1f1f;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 16px;
  width: 320px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
  outline: none;
}
.confirm-message {
  margin: 0 0 16px;
  font-size: 13px;
  color: #ddd;
  line-height: 1.4;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  padding: 6px 14px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #2a2a2a;
  color: #ddd;
  cursor: pointer;
  font-size: 12px;
}
.btn:hover {
  filter: brightness(1.2);
}
.btn.danger {
  border-color: #a33;
  color: #ff8080;
}
</style>
