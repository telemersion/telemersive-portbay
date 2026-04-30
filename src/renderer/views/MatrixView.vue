<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { createPeerState } from '../state/peerState'
import { createRoster } from '../state/roster'
import { usePanelRow } from '../composables/usePanelRow'
import PeerRow from '../components/PeerRow.vue'
import PanelRow from '../components/PanelRow.vue'
import AddDevicePopup from '../components/AddDevicePopup.vue'
import RoomHeader from '../components/RoomHeader.vue'

const peerState = createPeerState()
const roster = createRoster()

const ownPeerId = ref('')
const ownPeerName = ref('')
const ownLocalIP = ref('')
const ownPublicIP = ref('')
const roomName = ref('')
const roomId = ref<number | string>('')

const CHANNEL_COUNT = 20

// ── Panel row split ──────────────────────────────────────────────
const panelRowHeight = ref(320)
const MIN_PANEL_HEIGHT = 160
let dragging = false
let dragStartY = 0
let dragStartHeight = 0

onMounted(async () => {
  const settings = await window.api.invoke('settings:load')
  if (typeof settings?.panelRowHeight === 'number') {
    panelRowHeight.value = settings.panelRowHeight
  }
})

function onDragHandleMousedown(e: MouseEvent) {
  dragging = true
  dragStartY = e.clientY
  dragStartHeight = panelRowHeight.value
  window.addEventListener('mousemove', onDragMousemove)
  window.addEventListener('mouseup', onDragMouseup)
  e.preventDefault()
}

function onDragMousemove(e: MouseEvent) {
  if (!dragging) return
  const delta = dragStartY - e.clientY
  panelRowHeight.value = Math.max(MIN_PANEL_HEIGHT, dragStartHeight + delta)
}

function onDragMouseup() {
  dragging = false
  window.removeEventListener('mousemove', onDragMousemove)
  window.removeEventListener('mouseup', onDragMouseup)
  window.api.invoke('settings:save', { panelRowHeight: panelRowHeight.value })
}

// ── Panel row state ──────────────────────────────────────────────
const panelRow = usePanelRow()
const panelRowVisible = computed(() => panelRow.panelRowVisible.value)
const panelAllSlots = computed(() => panelRow.allSlots.value)
const panelActiveId = computed(() => panelRow.activeId.value)

function selectedChannelForPeer(peerId: string): number | null {
  const id = panelRow.activeId.value
  if (!id) return null
  const dashIdx = id.lastIndexOf('-')
  if (dashIdx === -1) return null
  const aPeerId = id.slice(0, dashIdx)
  const aCh = id.slice(dashIdx + 1)
  if (aPeerId !== peerId) return null
  return Number(aCh)
}

// ── IPC event wiring ─────────────────────────────────────────────
window.api.invoke('bus:localPeer').then((info: any) => {
  if (info?.peerId) {
    ownPeerId.value = info.peerId
    ownPeerName.value = info.peerName || ''
    ownLocalIP.value = info.localIP || ''
    if (typeof info.roomId === 'number') roomId.value = info.roomId
    roster.setLocalPeer(info.peerId, info.peerName || '', info.localIP || '', '')
  }
})

window.api.invoke('bus:state').then((s: any) => {
  if (s?.roomName) roomName.value = s.roomName
  if (typeof s?.roomId === 'number') roomId.value = s.roomId
})

window.api.on('peer:id', (id: string) => { ownPeerId.value = id })
window.api.on('peer:localIP', (ip: string) => {
  ownLocalIP.value = ip
  if (ownPeerId.value) roster.setLocalPeer(ownPeerId.value, ownPeerName.value, ip, '')
})
window.api.on('peer:publicIP', (ip: string) => { ownPublicIP.value = ip })
window.api.on('peer:room:name', (name: string) => { roomName.value = name })
window.api.on('peer:room:id', (id: number) => { roomId.value = id })
window.api.on('peers:remote:joined', (info: any) => { roster.addPeer(info) })
window.api.on('peers:remote:left', (info: { peerName: string; peerId: string }) => {
  roster.removePeer(info.peerId)
  peerState.removePeer(info.peerId)
})
window.api.on('peers:clear', () => {
  const local = ownPeerId.value
  for (const id of Object.keys(roster.entries)) {
    if (id !== local) roster.removePeer(id)
  }
})
window.api.on('peers:append', (info: any) => { roster.addPeer(info) })
window.api.on('mqtt:message', (msg: { topic: string; payload: string }) => {
  peerState.applyTopic(msg.topic, msg.payload)
})

// ── Peer state helpers ───────────────────────────────────────────
const sortedPeerIds = computed(() => {
  const ids = Object.keys(roster.entries)
  return [
    ...ids.filter(id => id === ownPeerId.value),
    ...ids.filter(id => id !== ownPeerId.value)
  ]
})

function peerChannels(peerId: string) {
  return peerState.peers[peerId]?.rack?.page_0 ?? {}
}

function peerSettings(peerId: string) {
  return peerState.peers[peerId]?.settings ?? {}
}

function peerColor(peerId: string) {
  return peerState.peers[peerId]?.settings?.background?.color ?? ''
}

function peerIP(peerId: string) {
  return roster.entries[peerId]?.localIP ?? ''
}

function isLocked(peerId: string) {
  return peerState.peers[peerId]?.settings?.lock?.enable === '1'
}

function getDeviceState(peerId: string, channelIndex: number) {
  return peerChannels(peerId)[`channel.${channelIndex}`]
}

function getPeerName(peerId: string) {
  return roster.entries[peerId]?.peerName ?? peerId.slice(0, 6)
}

// ── Cell interaction ─────────────────────────────────────────────
function onCellClick(peerId: string, channelIndex: number) {
  const ch = peerState.peers[peerId]?.rack?.page_0?.[`channel.${channelIndex}`]
  if (ch?.loaded && ch.loaded !== '0') {
    panelRow.activateCell(peerId, channelIndex)
  } else {
    panelRow.clearSelection()
  }
}

// ── Panel row event handlers ─────────────────────────────────────
function onPanelPin(_id: string) {
  panelRow.pinFloating()
}

function onPanelClose(id: string) {
  panelRow.closePinned(id)
}

function onPanelActivate(id: string) {
  panelRow.activateSlot(id)
}

function onPanelReorder(fromIndex: number, toIndex: number) {
  panelRow.reorderPinned(fromIndex, toIndex)
}

function onPanelRemove(peerId: string, channelIndex: number) {
  panelRow.closePinned(`${peerId}-${channelIndex}`)
  panelRow.clearSelection()
  onRemoveDevice(peerId, channelIndex)
}

// ── Add device popup ─────────────────────────────────────────────
const popupOpen = ref(false)
const popupPeerId = ref('')
const popupChannel = ref(0)
const popupRect = ref<DOMRect | null>(null)

function onOpenPopup(peerId: string, channelIndex: number, rect: DOMRect) {
  popupPeerId.value = peerId
  popupChannel.value = channelIndex
  popupRect.value = rect
  popupOpen.value = true
}

function onPopupSelect(deviceType: number) {
  const peerId = popupPeerId.value
  const channel = popupChannel.value
  popupOpen.value = false
  onAddDevice(peerId, channel, deviceType)
}

function closePopup() {
  popupOpen.value = false
}

async function onAddDevice(peerId: string, channelIndex: number, deviceType: number) {
  const topic = `/peer/${peerId}/rack/page_0/channel.${channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: String(deviceType), retain: true })
  panelRow.activateCell(peerId, channelIndex)
}

async function onRemoveDevice(peerId: string, channelIndex: number) {
  const confirmed = window.confirm('Remove this device? The device will be stopped and all its settings cleared.')
  if (!confirmed) return
  const base = `/peer/${peerId}/rack/page_0/channel.${channelIndex}`
  // Disable first so the handler shuts down cleanly before teardown.
  await window.api.invoke('mqtt:publish', { topic: `${base}/device/gui/enable`, value: '0', retain: true })
  await window.api.invoke('mqtt:publish', { topic: `${base}/loaded`, value: '0', retain: true })
}
</script>

<template>
  <div class="matrix-view">
    <!-- Top: matrix area -->
    <div
      class="matrix-area"
      :style="{ bottom: panelRowVisible ? panelRowHeight + 'px' : '0' }"
    >
      <RoomHeader
        :room-name="roomName"
        :room-id="roomId"
        :peer-id="ownPeerId"
        :local-ip="ownLocalIP"
        :public-ip="ownPublicIP"
      />
      <div class="matrix-scroll" @click.self="panelRow.clearSelection()">
        <div class="matrix-grid" @click.self="panelRow.clearSelection()">
          <div class="header-label">Peer</div>
          <div class="header-cells">
            <span v-for="i in CHANNEL_COUNT" :key="i - 1" class="ch-num">{{ i - 1 }}</span>
          </div>
          <PeerRow
            v-for="peerId in sortedPeerIds"
            :key="peerId"
            :peer-id="peerId"
            :peer-name="getPeerName(peerId)"
            :peer-color="peerColor(peerId)"
            :peer-ip="peerIP(peerId)"
            :is-local="peerId === ownPeerId"
            :is-locked="isLocked(peerId)"
            :channels="peerChannels(peerId)"
            :channel-count="CHANNEL_COUNT"
            :selected-channel="selectedChannelForPeer(peerId)"
            @cell-click="(ch) => onCellClick(peerId, ch)"
            @open-popup="(ch, rect) => onOpenPopup(peerId, ch, rect)"
            @remove-device="(ch) => onRemoveDevice(peerId, ch)"
          />
        </div>
      </div>
      <p v-if="sortedPeerIds.length === 0" class="muted">Waiting for peer data...</p>
    </div>

    <!-- Drag handle -->
    <div
      v-if="panelRowVisible"
      class="drag-handle"
      :style="{ bottom: panelRowHeight + 'px' }"
      @mousedown="onDragHandleMousedown"
    />

    <!-- Bottom: panel row -->
    <div
      v-if="panelRowVisible"
      class="panel-row-area"
      :style="{ height: panelRowHeight + 'px' }"
    >
      <PanelRow
        :slots="panelAllSlots"
        :active-id="panelActiveId"
        :get-device-state="getDeviceState"
        :get-device-settings="peerSettings"
        :get-peer-name="getPeerName"
        :is-local="(peerId: string) => peerId === ownPeerId.value"
        :is-locked="isLocked"
        @pin="onPanelPin"
        @close="onPanelClose"
        @activate="onPanelActivate"
        @reorder="onPanelReorder"
        @remove="onPanelRemove"
      />
    </div>

    <AddDevicePopup
      v-if="popupOpen && popupRect"
      :anchor-rect="popupRect"
      :target-local-props="peerSettings(popupPeerId)?.localProps"
      @select="onPopupSelect"
      @close="closePopup"
    />
  </div>
</template>

<style scoped>
.matrix-view {
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.matrix-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  overflow: hidden;
  transition: bottom 0.15s;
  display: flex;
  flex-direction: column;
}

.matrix-scroll {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  min-height: 0;
  scrollbar-color: #555 transparent;
  scrollbar-width: thin;
  padding: 12px;
  padding-bottom: 4px;
}

.matrix-scroll::-webkit-scrollbar { height: 8px; }
.matrix-scroll::-webkit-scrollbar-track { background: transparent; }
.matrix-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
.matrix-scroll::-webkit-scrollbar-thumb:hover { background: #777; }

.matrix-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 4px;
  width: max-content;
  min-width: 100%;
}

.header-label {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #1a1a1a;
  min-width: 150px;
  max-width: 150px;
  font-size: 11px;
  color: #888;
  padding: 0 10px 4px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: flex-end;
}

.header-cells {
  display: flex;
  gap: 2px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
  align-items: flex-end;
}

.ch-num {
  min-width: 50px;
  width: 50px;
  text-align: center;
  font-size: 10px;
  color: #555;
}

.muted {
  color: #888;
  font-size: 12px;
  margin-top: 16px;
  padding: 0 12px;
}

.drag-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  background: #2a2a2a;
  cursor: ns-resize;
  z-index: 10;
  transition: background 0.1s;
}

.drag-handle:hover {
  background: #444;
}

.panel-row-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  overflow: hidden;
}
</style>
