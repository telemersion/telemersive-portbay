<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet's default marker icons rely on webpack asset paths that don't resolve
// in Vite/Electron. Point them at the CDN copies instead.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const props = defineProps<{
  peerId: string
  peerName: string
  localIP: string
  publicIP: string
  peerColor: string
  isLocked: boolean
  isLocal: boolean
}>()

defineEmits<{ close: [] }>()

const colorSwatch = computed(() => {
  if (!props.peerColor) return null
  const parts = props.peerColor.split(' ').map(Number)
  if (parts.length < 3) return null
  return `rgb(${Math.round(parts[0] * 255)},${Math.round(parts[1] * 255)},${Math.round(parts[2] * 255)})`
})

const colorHex = computed(() => {
  if (!props.peerColor) return '#ffffff'
  const parts = props.peerColor.split(' ').map(Number)
  if (parts.length < 3) return '#ffffff'
  return '#' + [parts[0], parts[1], parts[2]]
    .map(v => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')
})

const colorInputEl = ref<HTMLInputElement | null>(null)

function openColorPicker() {
  colorInputEl.value?.click()
}

function onColorChange(e: Event) {
  const hex = (e.target as HTMLInputElement).value
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const value = `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} 1`
  window.api.invoke('mqtt:publish', {
    topic: `/peer/${props.peerId}/settings/background/color`,
    value,
    retain: true
  })
}

interface GeoResult {
  city?: string
  regionName?: string
  region?: string
  country?: string
  countryCode?: string
  zip?: string
  timezone?: string
  lat?: number
  lon?: number
  isp?: string
  org?: string
}

const geo = ref<GeoResult | null>(null)
const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null

onMounted(async () => {
  const ip = props.isLocal ? undefined : (props.publicIP || undefined)
  const result = await window.api.invoke('geo:lookup', ip) as GeoResult | null
  if (result) geo.value = result
})

watch([geo, mapEl], ([geoVal, el]) => {
  if (!geoVal?.lat || !geoVal?.lon || !el) return
  if (map) { map.remove(); map = null }
  map = L.map(el, { zoomControl: true, attributionControl: false })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
  L.marker([geoVal.lat, geoVal.lon]).addTo(map)
  map.setView([geoVal.lat, geoVal.lon], 10)
})

onUnmounted(() => {
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <aside class="peer-detail">
    <header class="head">
      <div class="title-row">
        <div v-if="colorSwatch" class="color-dot" :style="{ background: colorSwatch }" />
        <span class="title">{{ peerName }}</span>
        <span v-if="isLocal" class="tag">you</span>
      </div>
    </header>

    <div class="body">
      <div class="field">
        <span class="label">Peer ID</span>
        <span class="value mono">{{ peerId }}</span>
      </div>
      <div v-if="localIP" class="field">
        <span class="label">Local IP</span>
        <span class="value mono">{{ localIP }}</span>
      </div>
      <div v-if="publicIP" class="field">
        <span class="label">Public IP</span>
        <span class="value mono">{{ publicIP }}</span>
      </div>
      <div class="field">
        <span class="label">Lock</span>
        <span class="value" :class="isLocked ? 'locked' : 'unlocked'">
          {{ isLocked ? 'Locked' : 'Unlocked' }}
        </span>
      </div>
      <div v-if="colorSwatch" class="field">
        <span class="label">Color</span>
        <button class="color-preview" :style="{ background: colorSwatch }" title="Click to change color" @click="openColorPicker" />
        <input ref="colorInputEl" type="color" :value="colorHex" class="color-input-hidden" @change="onColorChange" />
      </div>

      <template v-if="geo">
        <div class="divider" />
        <div v-if="geo.city || geo.regionName || geo.country" class="field">
          <span class="label">Location</span>
          <span class="value">
            {{ [geo.city, geo.regionName, geo.country].filter(Boolean).join(', ') }}
            <span v-if="geo.countryCode" class="muted">({{ geo.countryCode }})</span>
          </span>
        </div>
        <div v-if="geo.zip" class="field">
          <span class="label">ZIP</span>
          <span class="value mono">{{ geo.zip }}</span>
        </div>
        <div v-if="geo.timezone" class="field">
          <span class="label">Timezone</span>
          <span class="value">{{ geo.timezone }}</span>
        </div>
        <div v-if="geo.lat != null && geo.lon != null" class="field">
          <span class="label">Coordinates</span>
          <span class="value mono">{{ geo.lat.toFixed(4) }}, {{ geo.lon.toFixed(4) }}</span>
        </div>
        <div v-if="geo.isp" class="field">
          <span class="label">ISP</span>
          <span class="value">{{ geo.isp }}</span>
        </div>
        <div v-if="geo.org && geo.org !== geo.isp" class="field">
          <span class="label">Org</span>
          <span class="value">{{ geo.org }}</span>
        </div>

        <div v-if="geo.lat != null && geo.lon != null" class="map-wrap">
          <div ref="mapEl" class="map" />
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.peer-detail {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: #161616;
  border-left: 1px solid #2a2a2a;
  color: #ddd;
  display: flex;
  flex-direction: column;
  z-index: 20;
  font-family: inherit;
}

.head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid #2a2a2a;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: #eee;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #252525;
  color: #888;
  flex-shrink: 0;
}

.body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 10px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.value {
  font-size: 12px;
  color: #ccc;
}

.value.mono {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
}

.muted { color: #666; font-size: 11px; }

.locked { color: #e6b800; }
.unlocked { color: #5a5; }

.color-preview {
  width: 28px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid #333;
  cursor: pointer;
  padding: 0;
}
.color-preview:hover {
  border-color: #888;
}
.color-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.divider {
  border-top: 1px solid #2a2a2a;
  margin: 2px 0;
}

.map-wrap {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #2a2a2a;
  margin-top: 2px;
}

.map {
  width: 100%;
  height: 180px;
}
</style>
