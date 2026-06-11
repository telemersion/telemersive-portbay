<script setup lang="ts">
import { ref } from 'vue'
import { closePanel } from './panelState'
import { updaterState, checkForUpdates, downloadUpdate, installUpdate } from '../state/updater'

const appVersion = __APP_VERSION__
const checkedManually = ref(false)

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closePanel()
}

function onCheckForUpdates() {
  checkedManually.value = true
  checkForUpdates()
}
</script>

<template>
  <div class="about-overlay" @click="onOverlayClick">
    <div class="about-window">
      <button class="close-btn" @click="closePanel">✕</button>
      <div class="about-title">Telemersive Gateway</div>
      <p class="about-line version">{{ appVersion }}</p>

      <div class="update-block">
        <p v-if="updaterState.status.state === 'checking'" class="about-line small muted">Checking for updates…</p>
        <template v-else-if="updaterState.status.state === 'not-available'">
          <p v-if="checkedManually" class="about-line small muted">Up to date</p>
          <button class="update-btn" @click="onCheckForUpdates">Check for Updates</button>
        </template>
        <template v-else-if="updaterState.status.state === 'available'">
          <p class="about-line small">Update v{{ updaterState.status.version }} available</p>
          <button class="update-btn" @click="downloadUpdate">Download</button>
        </template>
        <p v-else-if="updaterState.status.state === 'downloading'" class="about-line small muted">
          Downloading… {{ updaterState.status.percent }}%
        </p>
        <template v-else-if="updaterState.status.state === 'downloaded'">
          <p class="about-line small">Update v{{ updaterState.status.version }} ready</p>
          <button class="update-btn" @click="installUpdate">Restart &amp; Install</button>
        </template>
        <template v-else-if="updaterState.status.state === 'error'">
          <p class="about-line small muted">{{ updaterState.status.message }}</p>
          <button class="update-btn" @click="onCheckForUpdates">Check for Updates</button>
        </template>
        <button v-else class="update-btn" @click="onCheckForUpdates">Check for Updates</button>
      </div>

      <p class="about-line muted">created by</p>
      <p class="about-line">Martin Fröhlich</p>
      <p class="about-line muted">and</p>
      <p class="about-line small">
        Florian Bruggisser (telemersive-bus),<br>
        Joel Gähwiler and<br>
        Roman Häfeli (telemersive-switchboard)
      </p>
      <p class="about-line muted">realized for SNF Project</p>
      <a class="about-project" href="https://data.snf.ch/grants/grant/192745" target="_blank">Spatial Dis/Continuities ↗</a>
      <p class="about-line muted">(c) 2026 immersive-arts.ch</p>
    </div>
  </div>
</template>

<style scoped>
.about-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.about-window {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 32px 40px 28px;
  min-width: 300px;
  max-width: 380px;
  text-align: center;
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

.about-title {
  display: inline-block;
  background: #FFA126;
  color: #1a1a1a;
  font-weight: 600;
  font-size: 13px;
  border-radius: 6px;
  padding: 6px 18px;
  margin-bottom: 18px;
}

.about-line {
  margin: 5px 0;
  font-size: 12px;
  color: #ddd;
  line-height: 1.6;
}
.about-line.muted { color: #777; }
.about-line.small { font-size: 11px; color: #aaa; }
.about-line.version { font-size: 11px; color: #888; font-family: monospace; margin-bottom: 4px; }

.update-block {
  margin-bottom: 14px;
  min-height: 20px;
}

.update-btn {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #ddd;
  font-size: 11px;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  margin-top: 4px;
}
.update-btn:hover { background: #333; }

.about-project {
  display: inline-block;
  background: #FFA126;
  color: #1a1a1a;
  font-weight: 600;
  font-size: 12px;
  border-radius: 6px;
  padding: 4px 14px;
  margin: 10px 0 6px;
  text-decoration: none;
}
.about-project:hover { background: #ffb347; }
</style>
