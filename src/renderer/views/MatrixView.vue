<script setup lang="ts">
import { computed, ref } from 'vue'
import { createPeerState } from '../state/peerState'
import { createRoster } from '../state/roster'
import PeerRow from '../components/PeerRow.vue'
import DevicePanel from '../components/DevicePanel.vue'
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
const PANEL_WIDTH = 380

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

window.api.on('peer:id', (id: string) => {
  ownPeerId.value = id
})

window.api.on('peer:localIP', (ip: string) => {
  ownLocalIP.value = ip
  if (ownPeerId.value) {
    roster.setLocalPeer(ownPeerId.value, ownPeerName.value, ip, '')
  }
})

window.api.on('peer:publicIP', (ip: string) => {
  ownPublicIP.value = ip
})

window.api.on('peer:room:name', (name: string) => {
  roomName.value = name
})

window.api.on('peer:room:id', (id: number) => {
  roomId.value = id
})

window.api.on('peers:remote:joined', (info: any) => {
  roster.addPeer(info)
})

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

window.api.on('peers:append', (info: any) => {
  roster.addPeer(info)
})

window.api.on('mqtt:message', (msg: { topic: string; payload: string }) => {
  peerState.applyTopic(msg.topic, msg.payload)
})

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

const panelOpen = ref(false)
const panelPeerId = ref('')
const panelChannel = ref(0)

function onCellClick(peerId: string, channelIndex: number) {
  const ch = peerState.peers[peerId]?.rack?.page_0?.[`channel.${channelIndex}`]
  if (ch?.loaded && ch.loaded !== '0') {
    panelPeerId.value = peerId
    panelChannel.value = channelIndex
    panelOpen.value = true
  }
}

function closePanel() {
  panelOpen.value = false
}

async function onAddDevice(peerId: string, channelIndex: number, deviceType: number) {
  const topic = `/peer/${peerId}/rack/page_0/channel.${channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: String(deviceType), retain: true })
}

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
  <div
    class="matrix-view"
    :style="{ marginRight: panelOpen ? PANEL_WIDTH + 'px' : '0' }"
  >
    <RoomHeader
      :room-name="roomName"
      :room-id="roomId"
      :peer-id="ownPeerId"
      :local-ip="ownLocalIP"
      :public-ip="ownPublicIP"
    />
    <div class="matrix-scroll">
      <div class="matrix-grid">
        <!-- Header row -->
        <div class="header-label">Peer</div>
        <div class="header-cells">
          <span v-for="i in CHANNEL_COUNT" :key="i - 1" class="ch-num">{{ i - 1 }}</span>
        </div>

        <!-- Peer rows -->
        <PeerRow
          v-for="peerId in sortedPeerIds"
          :key="peerId"
          :peer-id="peerId"
          :peer-name="roster.entries[peerId]?.peerName ?? peerId.slice(0, 6)"
          :peer-color="peerColor(peerId)"
          :peer-ip="peerIP(peerId)"
          :is-local="peerId === ownPeerId"
          :is-locked="isLocked(peerId)"
          :channels="peerChannels(peerId)"
          :channel-count="CHANNEL_COUNT"
          :selected-channel="panelOpen && panelPeerId === peerId ? panelChannel : null"
          @cell-click="(ch) => onCellClick(peerId, ch)"
          @open-popup="(ch, rect) => onOpenPopup(peerId, ch, rect)"
          @remove-device="(ch) => onRemoveDevice(peerId, ch)"
        />
      </div>
    </div>

    <p v-if="sortedPeerIds.length === 0" class="muted">Waiting for peer data...</p>

    <AddDevicePopup
      v-if="popupOpen && popupRect"
      :anchor-rect="popupRect"
      :target-local-props="peerSettings(popupPeerId)?.localProps"
      @select="onPopupSelect"
      @close="closePopup"
    />

    <DevicePanel
      v-if="panelOpen"
      :key="`${panelPeerId}-${panelChannel}`"
      :peer-id="panelPeerId"
      :channel-index="panelChannel"
      :peer-name="roster.entries[panelPeerId]?.peerName ?? ''"
      :room-name="''"
      :device-state="peerChannels(panelPeerId)[`channel.${panelChannel}`]"
      :peer-settings="peerSettings(panelPeerId)"
      :is-local="panelPeerId === ownPeerId"
      :target-locked="isLocked(panelPeerId)"
      @close="closePanel"
    />
  </div>
</template>

<style scoped>
.matrix-view {
  padding: 12px;
  transition: margin-right 0.15s;
}

.matrix-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-color: #555 transparent;
  scrollbar-width: thin;
  padding-bottom: 4px;
}

.matrix-scroll::-webkit-scrollbar {
  height: 8px;
}
.matrix-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.matrix-scroll::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}
.matrix-scroll::-webkit-scrollbar-thumb:hover {
  background: #777;
}

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
}
</style>
