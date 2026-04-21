<script setup lang="ts">
defineProps<{
  roomName: string
  roomId: number | string
  peerId: string
  localIp: string
  publicIp: string
}>()
</script>

<template>
  <div class="room-header">
    <div class="field">
      <span class="label">Room</span>
      <span class="value">{{ roomName || '—' }}</span>
      <span v-if="roomId" class="sub">#{{ roomId }}</span>
    </div>
    <div class="field">
      <span class="label">Peer</span>
      <span class="value mono">{{ peerId || '—' }}</span>
    </div>
    <div class="field">
      <span class="label">Local IP</span>
      <span class="value mono">{{ localIp || '—' }}</span>
    </div>
    <div class="field">
      <span class="label">Public IP</span>
      <span class="value mono">{{ publicIp || '—' }}</span>
    </div>
  </div>
</template>

<style scoped>
.room-header {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 6px 12px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 11px;
}

.field {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.label {
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 9px;
}

.value {
  color: #ddd;
  font-weight: 500;
}

.sub {
  color: #888;
  font-size: 10px;
}

.mono {
  font-family: monospace;
}
</style>
