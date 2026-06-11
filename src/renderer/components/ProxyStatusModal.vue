<script setup lang="ts">
import type { ProxyEntry } from '../state/switchboardState'

const props = defineProps<{
  channelIndex: number
  proxies: ProxyEntry[]
  error: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function onOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit('close')
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const deltaMs = Date.now() - seconds * 1000
  const deltaSec = Math.max(0, Math.round(deltaMs / 1000))
  if (deltaSec < 60) return `${deltaSec}s ago`
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`
  return `${Math.round(deltaSec / 3600)}h ago`
}
</script>

<template>
  <div class="proxy-overlay" @click="onOverlayClick">
    <div class="proxy-window">
      <button class="close-btn" @click="emit('close')">✕</button>
      <h2 class="proxy-title">Channel {{ props.channelIndex }} — Proxy Status</h2>

      <p v-if="props.error" class="proxy-error">Switchboard unreachable — showing last known data.</p>
      <p v-if="props.proxies.length === 0" class="proxy-empty">No proxies found for this channel.</p>

      <div v-for="proxy in props.proxies" :key="proxy.port" class="proxy-card">
        <div class="proxy-header">
          <span class="proxy-port">Port {{ proxy.port }} (+{{ proxy.offset }})</span>
          <span class="proxy-state" :class="proxy.running ? 'running' : 'stopped'">
            <span class="state-dot" /> {{ proxy.running ? 'running' : 'stopped' }}
          </span>
          <span v-if="proxy.pid" class="proxy-pid">pid {{ proxy.pid }}</span>
        </div>
        <div class="proxy-traffic">
          <span>{{ proxy.packets_in }} pkts / {{ formatBytes(proxy.bytes_in) }} in</span>
          <span>{{ proxy.packets_out }} pkts / {{ formatBytes(proxy.bytes_out) }} out</span>
        </div>
        <div class="proxy-clients">
          <div v-if="Object.keys(proxy.clients).length === 0" class="no-clients">no clients connected</div>
          <div v-for="(client, address) in proxy.clients" :key="address" class="client-row">
            <span class="client-address">{{ address }}</span>
            <span class="client-role">{{ client.role }}</span>
            <span class="client-seen">last seen {{ formatRelative(client.last_seen) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proxy-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.proxy-window {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 24px 28px;
  min-width: 360px;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 4px;
}
.close-btn:hover { color: #ccc; }

.proxy-title {
  font-size: 14px;
  font-weight: 600;
  color: #ddd;
  margin: 0 0 14px;
}

.proxy-error {
  color: #e53935;
  font-size: 12px;
  margin: 0 0 12px;
}

.proxy-empty {
  color: #888;
  font-size: 12px;
}

.proxy-card {
  background: #262626;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 12px;
}

.proxy-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: monospace;
  color: #ddd;
}

.proxy-port {
  font-weight: 600;
}

.proxy-state {
  display: flex;
  align-items: center;
  gap: 4px;
}

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.proxy-state.running .state-dot { background: #4caf50; }
.proxy-state.stopped .state-dot { background: #e68a00; }
.proxy-state.running { color: #4caf50; }
.proxy-state.stopped { color: #e68a00; }

.proxy-pid {
  color: #888;
  margin-left: auto;
}

.proxy-traffic {
  display: flex;
  gap: 16px;
  margin-top: 6px;
  color: #aaa;
  font-family: monospace;
  font-size: 11px;
}

.proxy-clients {
  margin-top: 8px;
  border-top: 1px solid #333;
  padding-top: 6px;
}

.no-clients {
  color: #666;
  font-size: 11px;
}

.client-row {
  display: flex;
  gap: 10px;
  font-family: monospace;
  font-size: 11px;
  color: #aaa;
}

.client-address {
  min-width: 140px;
}

.client-role {
  color: #888;
  min-width: 60px;
}
</style>
