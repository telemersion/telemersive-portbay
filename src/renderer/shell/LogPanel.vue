<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { pushCapped, type LogEntry } from '../../shared/log'

const entries = ref<LogEntry[]>([])
const showSub = ref(true)
const showPub = ref(true)
const showRecv = ref(true)
const showData = ref(true)
const showBus = ref(true)
const showPings = ref(false)
const autoScroll = ref(true)
const listEl = ref<HTMLDivElement | null>(null)
const copyFlash = ref(false)

const visible = computed(() => entries.value.filter(e => {
  if (e.source === 'data' && !showData.value) return false
  if (e.source === 'bus' && !showBus.value) return false
  if (e.source === 'keepalive' && !(showBus.value && showPings.value)) return false
  if (e.kind === 'sub' || e.kind === 'unsub') return showSub.value
  if (e.kind === 'pub') return showPub.value
  if (e.kind === 'recv') return showRecv.value
  return true
}))

function formatTs(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function kindLabel(e: LogEntry): string {
  switch (e.kind) {
    case 'sub': return 'SUB  '
    case 'unsub': return 'UNSUB'
    case 'pub': return e.retained ? 'PUB r' : 'PUB  '
    case 'recv': return e.retained ? 'RECVr' : 'RECV '
    case 'event': return 'EVT  '
    case 'warn': return 'WARN '
    case 'error': return 'ERR  '
  }
}

function formatEntry(e: LogEntry): string {
  const base = `[${formatTs(e.ts)}] ${kindLabel(e)} ${e.topic}`
  return e.value ? `${base} ${e.value}` : base
}

function onListScroll(): void {
  const el = listEl.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
  autoScroll.value = atBottom
}

watch(visible, async () => {
  if (!autoScroll.value) return
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
})

function onEntry(entry: LogEntry): void {
  pushCapped(entries.value, entry)
}

async function clear(): Promise<void> {
  await window.api.invoke('log:clear')
  entries.value = []
}

async function copy(): Promise<void> {
  const text = visible.value.map(formatEntry).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copyFlash.value = true
    setTimeout(() => { copyFlash.value = false }, 1200)
  } catch {}
}

onMounted(async () => {
  const initial = await window.api.invoke('log:get') as LogEntry[]
  entries.value = initial ?? []
  window.api.on('log:entry', onEntry)
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
})

onUnmounted(() => {
  window.api.removeAllListeners('log:entry')
})
</script>

<template>
  <aside class="log-panel">
    <header class="head">
      <span class="title">Activity log</span>
      <span class="count">{{ visible.length }} / {{ entries.length }}</span>
    </header>

    <div class="filters">
      <label><input type="checkbox" v-model="showSub" /> Sub</label>
      <label><input type="checkbox" v-model="showPub" /> Pub</label>
      <label><input type="checkbox" v-model="showRecv" /> Recv</label>
      <span class="sep" />
      <label title="Room data-plane topics (/peer/...)"><input type="checkbox" v-model="showData" /> Data</label>
      <label title="telemersive-bus handshake and control traffic with the room manager"><input type="checkbox" v-model="showBus" /> Bus</label>
      <label title="Periodic bus keepalive traffic (room alive and speed pings)" :class="{ dim: !showBus }"><input type="checkbox" v-model="showPings" :disabled="!showBus" /> Pings</label>
    </div>

    <div ref="listEl" class="list" @scroll="onListScroll">
      <div v-for="e in visible" :key="e.seq" class="row" :class="['k-' + e.kind, 's-' + e.source]">
        <span class="ts">{{ formatTs(e.ts) }}</span>
        <span class="kind">{{ kindLabel(e) }}</span>
        <span class="topic">{{ e.topic }}</span>
        <span v-if="e.value" class="value">{{ e.value }}</span>
      </div>
      <div v-if="visible.length === 0" class="empty">No entries.</div>
    </div>

    <footer class="actions">
      <button class="btn" @click="clear">Clear</button>
      <button class="btn" @click="copy">{{ copyFlash ? 'Copied!' : 'Copy to clipboard' }}</button>
    </footer>
  </aside>
</template>

<style scoped>
.log-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 48px;
  width: 400px;
  background: #161616;
  border-right: 1px solid #2a2a2a;
  color: #ddd;
  display: flex;
  flex-direction: column;
  z-index: 4;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.head {
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title { font-weight: 600; font-size: 12px; color: #eee; }
.count { font-size: 11px; color: #777; }

.filters {
  padding: 6px 12px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #aaa;
}
.filters label { display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
.filters label.dim { opacity: 0.4; cursor: default; }
.filters .sep { width: 1px; background: #2a2a2a; }

.list {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 4px 0;
  font-size: 11px;
  line-height: 1.45;
}

.row {
  padding: 1px 12px;
  white-space: nowrap;
  display: flex;
  gap: 6px;
}

.row:hover { background: #1e1e1e; }

.ts { color: #555; flex-shrink: 0; }
.kind { flex-shrink: 0; }
.topic { color: #ccc; }
.value { color: #7ec; flex-shrink: 0; }

.k-sub .kind, .k-unsub .kind { color: #9a8; }
.k-pub .kind { color: #f90; }
.k-recv .kind { color: #39f; }
.k-event .kind { color: #b9a3e3; }
.k-warn .kind { color: #e5c07b; }
.k-error .kind { color: #f55; }

.s-bus .topic { color: #b9a3e3; }
.s-keepalive .topic, .s-keepalive .value { color: #666; }

.empty {
  color: #555;
  font-size: 11px;
  padding: 20px 12px;
  text-align: center;
}

.actions {
  padding: 8px 12px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  gap: 8px;
}

.btn {
  background: #222;
  border: 1px solid #333;
  color: #ddd;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
}
.btn:hover { background: #2a2a2a; }
</style>
