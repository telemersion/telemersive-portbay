<script setup lang="ts">
import { computed } from 'vue'
import IconBar from './shell/IconBar.vue'
import LogPanel from './shell/LogPanel.vue'
import { panelState } from './shell/panelState'
import { initCompat } from './state/compat'
import { initSession } from './state/session'

initCompat()
initSession()

const ICON_BAR_WIDTH = 48
const LOG_PANEL_WIDTH = 400

const contentLeft = computed(() => {
  const base = ICON_BAR_WIDTH
  return panelState.openPanelId === 'log' ? base + LOG_PANEL_WIDTH : base
})
</script>

<template>
  <IconBar />
  <LogPanel v-if="panelState.openPanelId === 'log'" />
  <main class="app-content" :style="{ marginLeft: contentLeft + 'px' }">
    <router-view />
  </main>
</template>

<style>
.app-content {
  transition: margin-left 0.15s;
  min-height: 100vh;
}
</style>
