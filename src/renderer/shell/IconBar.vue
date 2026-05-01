<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { navItems, ICONS, type NavItem, type NavGate } from './navigation'
import { panelState, togglePanel, closePanel } from './panelState'
import { initCompat, hasCompatIssues, compatState } from '../state/compat'
import { initSession, sessionState } from '../state/session'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  initCompat()
  initSession()
})

function gateMet(gate: NavGate): boolean {
  if (gate === 'always') return true
  if (!compatState.status) return false
  if (hasCompatIssues.value) return false
  if (gate === 'compat-ok') return true
  if (gate === 'joined') return sessionState.joined
  return true
}

const visibleItems = computed(() => navItems.filter(i => gateMet(i.gate)))
const topItems = computed(() => visibleItems.value.filter(i => i.position === 'top'))
const bottomItems = computed(() => visibleItems.value.filter(i => i.position === 'bottom'))

function hasBadge(item: NavItem): boolean {
  return item.id === 'settings' && hasCompatIssues.value
}

// If the user is on a route that becomes ungated (compat issue appears, or they
// leave a room), bounce them to the most appropriate visible route.
let bouncedToSettings = false
watch(
  () => visibleItems.value.map(i => i.id).join(','),
  () => {
    const current = navItems.find(i => i.kind === 'route' && i.target === route.path)
    // First-time release: user was forced to /settings before compat resolved;
    // once it goes green, send them to /.
    if (
      bouncedToSettings &&
      route.path === '/settings' &&
      compatState.status &&
      !hasCompatIssues.value
    ) {
      bouncedToSettings = false
      router.replace('/')
      return
    }
    if (!current) return
    if (gateMet(current.gate)) return
    if (hasCompatIssues.value || !compatState.status) {
      bouncedToSettings = true
      router.replace('/settings')
    } else if (current.gate === 'joined' && !sessionState.joined) {
      router.replace('/')
    }
    // Close any panel whose item is no longer visible.
    if (panelState.openPanelId) {
      const panelItem = navItems.find(i => i.kind === 'panel' && i.target === panelState.openPanelId)
      if (panelItem && !gateMet(panelItem.gate)) closePanel()
    }
  },
  { immediate: true }
)

function activate(item: NavItem): void {
  if (item.kind === 'route') {
    router.push(item.target)
  } else {
    togglePanel(item.target)
  }
}

function isActive(item: NavItem): boolean {
  if (item.kind === 'route') return route.path === item.target
  return panelState.openPanelId === item.target
}
</script>

<template>
  <nav class="icon-bar" aria-label="Primary navigation">
    <div class="group">
      <button
        v-for="item in topItems"
        :key="item.id"
        class="icon-btn"
        :class="{ active: isActive(item) }"
        :title="item.label"
        :aria-label="item.label"
        @click="activate(item)"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[item.icon]" />
        </svg>
      </button>
    </div>

    <div class="group bottom">
      <button
        v-for="item in bottomItems"
        :key="item.id"
        class="icon-btn"
        :class="{ active: isActive(item) }"
        :title="item.label"
        :aria-label="item.label"
        @click="activate(item)"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[item.icon]" />
        </svg>
        <span v-if="hasBadge(item)" class="badge" title="Tool compatibility issue — see Settings"></span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.icon-bar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 48px;
  background: #141414;
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 5;
  padding: 8px 0;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  margin: 0 4px;
  border: 0;
  background: transparent;
  color: #888;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}

.icon-btn:hover {
  background: #1f1f1f;
  color: #ddd;
}

.icon-btn.active {
  background: #2a2a2a;
  color: #fff;
}

.icon-btn {
  position: relative;
}

.badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e0c46d;
  border: 1px solid #141414;
  pointer-events: none;
}
</style>
