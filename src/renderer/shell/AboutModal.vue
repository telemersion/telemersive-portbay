<script setup lang="ts">
import { closePanel } from './panelState'

const appVersion = __APP_VERSION__

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closePanel()
}
</script>

<template>
  <div class="about-overlay" @click="onOverlayClick">
    <div class="about-window">
      <button class="close-btn" @click="closePanel">✕</button>
      <div class="about-title">Telemersive Gateway</div>
      <p class="about-line version">{{ appVersion }}</p>
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
.about-line.version { font-size: 11px; color: #888; font-family: monospace; margin-bottom: 14px; }

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
