<script setup lang="ts">
import { computed } from 'vue'
import IconBar from './shell/IconBar.vue'
import LogPanel from './shell/LogPanel.vue'
import AboutModal from './shell/AboutModal.vue'
import { panelState } from './shell/panelState'
import { panelWidths, panelResize } from './shell/panelWidths'
import { initCompat } from './state/compat'
import { initSession } from './state/session'
import { initBusWiring } from './state/localPeer'

initCompat()
initSession()
initBusWiring()

const ICON_BAR_WIDTH = 48

const contentLeft = computed(() => {
  const base = ICON_BAR_WIDTH
  return panelState.openPanelId === 'log' ? base + panelWidths.log : base
})
</script>

<template>
  <IconBar />
  <LogPanel v-if="panelState.openPanelId === 'log'" :icon-bar-width="ICON_BAR_WIDTH" />
  <AboutModal v-if="panelState.openPanelId === 'about'" />
  <main
    class="app-content"
    :class="{ resizing: panelResize.active }"
    :style="{ marginLeft: contentLeft + 'px' }"
  >
    <router-view />
  </main>
</template>

<style>
.app-content {
  transition: margin-left 0.15s;
  min-height: 100vh;
}
.app-content.resizing { transition: none; }
</style>
