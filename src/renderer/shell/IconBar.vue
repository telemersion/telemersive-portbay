<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { navItems, ICONS, type NavItem } from './navigation'
import { panelState, togglePanel } from './panelState'
import { initCompat, hasCompatIssues } from '../state/compat'

const route = useRoute()
const router = useRouter()

const topItems = computed(() => navItems.filter(i => i.position === 'top'))
const bottomItems = computed(() => navItems.filter(i => i.position === 'bottom'))

onMounted(() => initCompat())

function hasBadge(item: NavItem): boolean {
  return item.id === 'settings' && hasCompatIssues.value
}

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
