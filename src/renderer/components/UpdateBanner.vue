<script setup lang="ts">
import { updaterState, downloadUpdate, installUpdate } from '../state/updater'
</script>

<template>
  <section v-if="updaterState.status.state === 'available'" class="card">
    <p class="banner-text">Update v{{ updaterState.status.version }} available</p>
    <button class="banner-btn" @click="downloadUpdate">Download &amp; Install</button>
  </section>
  <section v-else-if="updaterState.status.state === 'downloading'" class="card">
    <p class="banner-text">Downloading update… {{ updaterState.status.percent }}%</p>
    <button class="banner-btn" disabled>Downloading…</button>
  </section>
  <section v-else-if="updaterState.status.state === 'downloaded'" class="card">
    <p class="banner-text">Update v{{ updaterState.status.version }} ready to install</p>
    <button class="banner-btn" @click="installUpdate">Restart &amp; Install</button>
  </section>
</template>

<style scoped>
.card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #ddd;
}

.banner-text {
  font-size: 13px;
  margin: 0;
}

.banner-btn {
  background: #2d7a2d;
  color: #fff;
  border: 0;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.banner-btn:hover:not(:disabled) { background: #389038; }
.banner-btn:disabled {
  background: #2a4a2a;
  color: #6a8a6a;
  cursor: default;
}
</style>
