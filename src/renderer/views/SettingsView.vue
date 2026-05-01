<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  compatState,
  initCompat,
  recheckCompat,
  locateTool,
  openDownloadPage,
  revealToolsFolder
} from '../state/compat'
import type { ToolStatus } from '../../shared/toolRequirements'

const settingsPath = ref('')
const revealLabel = computed(() => {
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) return 'Finder'
  if (p.includes('win')) return 'Explorer'
  return 'file manager'
})

onMounted(async () => {
  initCompat()
  settingsPath.value = await window.api.invoke('settings:get-path')
})

function revealSettings(): void {
  window.api.invoke('settings:reveal')
}

function openSettingsInEditor(): void {
  window.api.invoke('settings:open-in-editor')
}

const lastCheckedLabel = computed(() => {
  const t = compatState.status?.lastCheckedAt
  if (!t) return '—'
  return new Date(t).toLocaleString()
})

function statusLabel(s: ToolStatus): string {
  switch (s.status) {
    case 'ok': return 'OK'
    case 'missing': return 'not installed'
    case 'version-mismatch': return `version mismatch (found ${s.installed})`
    case 'unsupported-os': return 'not required on this OS'
    case 'checking': return 'checking…'
    case 'error': return s.error || 'error'
  }
}

function statusClass(s: ToolStatus): string {
  return `status-${s.status}`
}

function canDownload(s: ToolStatus): boolean {
  return s.status === 'missing' || s.status === 'version-mismatch'
}

function canLocate(s: ToolStatus): boolean {
  return s.status !== 'unsupported-os'
}
</script>

<template>
  <section class="settings-view">
    <header class="page-header">
      <h1>Settings</h1>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>Configuration File</h2>
      </div>
      <dl class="tool-fields">
        <div>
          <dt>Path</dt>
          <dd :title="settingsPath">{{ settingsPath || '—' }}</dd>
        </div>
      </dl>
      <div class="tool-actions">
        <button class="btn" :disabled="!settingsPath" @click="revealSettings()">
          Reveal in {{ revealLabel }}
        </button>
        <button class="btn" :disabled="!settingsPath" @click="openSettingsInEditor()">
          Open in default editor
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>Tools &amp; Compatibility</h2>
        <div class="meta">
          <span>NG version: <strong>{{ compatState.status?.ngVersion ?? '—' }}</strong></span>
          <span>Last check: {{ lastCheckedLabel }}</span>
          <button class="btn ghost" :disabled="compatState.loading" @click="recheckCompat()">
            {{ compatState.loading ? 'Checking…' : 'Re-check all' }}
          </button>
          <button class="btn ghost" @click="revealToolsFolder()">Reveal app data folder</button>
        </div>
      </div>

      <div v-if="!compatState.status" class="empty">Loading…</div>

      <ul v-else class="tool-list">
        <li v-for="tool in compatState.status.tools" :key="tool.id" class="tool-row">
          <div class="tool-head">
            <span class="tool-name">{{ tool.label }}</span>
            <span class="tool-status" :class="statusClass(tool)">{{ statusLabel(tool) }}</span>
          </div>
          <dl class="tool-fields">
            <div>
              <dt>Required</dt>
              <dd>{{ tool.required || '—' }}</dd>
            </div>
            <div>
              <dt>Installed</dt>
              <dd>{{ tool.installed ?? '—' }}</dd>
            </div>
            <div class="path-row">
              <dt>Path</dt>
              <dd :title="tool.path ?? ''">{{ tool.path ?? '—' }}</dd>
            </div>
          </dl>
          <div class="tool-actions">
            <button
              class="btn"
              :disabled="!canLocate(tool) || compatState.loading"
              @click="locateTool(tool.id)"
            >Locate…</button>
            <button
              class="btn"
              :disabled="!canDownload(tool)"
              @click="openDownloadPage(tool.id)"
            >Download required build from official website ↗</button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.settings-view {
  padding: 24px;
  color: #ddd;
  max-width: 880px;
}
.page-header h1 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 500;
  color: #fff;
}
.card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 16px;
}
.card + .card {
  margin-top: 16px;
}
.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #2a2a2a;
}
.card-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: #888;
}
.meta strong {
  color: #ddd;
  font-weight: 500;
}
.empty {
  color: #666;
  padding: 24px 0;
  text-align: center;
}
.tool-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tool-row {
  background: #141414;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 12px 16px;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.tool-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}
.tool-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.status-ok { background: #1f3a25; color: #6dd383; }
.status-missing { background: #3a1f1f; color: #e07b7b; }
.status-version-mismatch { background: #3a311f; color: #e0c46d; }
.status-unsupported-os { background: #2a2a2a; color: #888; }
.status-checking { background: #1f2a3a; color: #6db1e0; }
.status-error { background: #3a1f1f; color: #e07b7b; }

.tool-fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 12px;
  row-gap: 4px;
  margin: 0 0 12px;
  font-size: 12px;
}
.tool-fields > div {
  display: contents;
}
.tool-fields dt {
  color: #777;
}
.tool-fields dd {
  color: #ccc;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, monospace;
  word-break: break-all;
}
.path-row dd {
  font-size: 11px;
}
.tool-actions {
  display: flex;
  gap: 8px;
}
.btn {
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s;
}
.btn:hover:not(:disabled) {
  background: #333;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
}
</style>
