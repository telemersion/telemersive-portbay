<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const error = ref('')
const connecting = ref(false)
const joining = ref(false)
const isConnected = ref(false)
const isJoined = ref(false)
const rooms = ref<string[]>([])

const config = reactive({
  host: 'telemersion.zhdk.ch',
  port: 3883,
  username: 'peer',
  password: 'telemersion2021',
  localIP: ''
})

const form = reactive({
  peerName: '',
  roomName: '',
  roomPwd: ''
})

window.api.invoke('settings:load').then((settings: any) => {
  if (settings) {
    config.host = settings.brokerUrl || config.host
    config.port = settings.brokerPort || config.port
    config.username = settings.brokerUser || config.username
    config.password = settings.brokerPwd || config.password
    form.peerName = settings.peerName || ''
    form.roomName = settings.lastRoomName || ''
    form.roomPwd = settings.lastRoomPwd || ''
  }
})

onMounted(async () => {
  const state = await window.api.invoke('bus:state') as {
    connected: boolean; joined: boolean; peerName: string; roomName: string
  }
  if (state) {
    isConnected.value = state.connected
    isJoined.value = state.joined
    if (state.peerName) form.peerName = state.peerName
    if (state.roomName) form.roomName = state.roomName
  }
})

window.api.on('peer:localIP', (ip: string) => {
  config.localIP = ip
})

window.api.on('broker:connected', (connected: boolean) => {
  connecting.value = false
  isConnected.value = connected
  if (!connected) {
    isJoined.value = false
    if (!error.value) error.value = 'Disconnected'
  }
})

window.api.on('rooms:clear', () => { rooms.value = [] })
window.api.on('rooms:append', (name: string) => { rooms.value.push(name) })

window.api.on('peer:joined', (joined: boolean) => {
  joining.value = false
  isJoined.value = joined
  if (joined) router.push('/matrix')
})

async function connect() {
  error.value = ''
  connecting.value = true
  const settings = await window.api.invoke('settings:load')
  await window.api.invoke('settings:save', {
    ...settings,
    brokerUrl: config.host,
    brokerPort: config.port,
    brokerUser: config.username,
    brokerPwd: config.password
  })
  window.api.send('bus:configure', { ...config })
  try {
    await window.api.invoke('bus:connect')
  } catch (e: any) {
    connecting.value = false
    error.value = e.message || 'Connection failed'
  }
}

async function disconnect() {
  error.value = ''
  if (isJoined.value) {
    try { await window.api.invoke('bus:leave') } catch {}
    isJoined.value = false
  }
  try { await window.api.invoke('bus:disconnect') } catch {}
  isConnected.value = false
  rooms.value = []
}

function selectRoom(name: string) {
  form.roomName = name
}

async function join() {
  joining.value = true
  const settings = await window.api.invoke('settings:load')
  await window.api.invoke('settings:save', {
    ...settings,
    peerName: form.peerName,
    lastRoomName: form.roomName,
    lastRoomPwd: form.roomPwd
  })
  await window.api.invoke('bus:join', form.peerName, form.roomName, form.roomPwd)
}

async function leave() {
  try { await window.api.invoke('bus:leave') } catch {}
  isJoined.value = false
}
</script>

<template>
  <div class="session-view">
    <section class="card">
      <h3>connect to the telemersive-router</h3>

      <div class="form-row">
        <label>RouterURL</label>
        <input v-model="config.host" :disabled="isConnected" />
      </div>
      <div class="form-row">
        <label>RouterPort</label>
        <input v-model.number="config.port" type="number" :disabled="isConnected" />
      </div>
      <div class="form-row">
        <label>RouterUser</label>
        <input v-model="config.username" :disabled="isConnected" />
      </div>
      <div class="form-row">
        <label>RouterPwd</label>
        <input v-model="config.password" type="password" :disabled="isConnected" />
      </div>

      <div class="btn-row">
        <button class="btn-connect" :class="{ active: isConnected, pending: connecting }" :disabled="isConnected || connecting" @click="connect">
          {{ isConnected ? 'connected' : (connecting ? 'connecting…' : 'connect') }}
        </button>
        <button class="btn-disconnect" :disabled="!isConnected" @click="disconnect">
          disconnect
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-if="isConnected" class="card">
      <h3>create / join a room</h3>

      <div v-if="rooms.length > 0" class="room-list">
        <div class="form-row">
          <label>All Rooms:</label>
          <select :value="form.roomName" @change="selectRoom(($event.target as HTMLSelectElement).value)" :disabled="isJoined">
            <option value="">— pick a room —</option>
            <option v-for="name in rooms" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <label>PeerName</label>
        <input v-model="form.peerName" :disabled="isJoined" />
      </div>
      <div class="form-row">
        <label>RoomName</label>
        <input v-model="form.roomName" :disabled="isJoined" />
      </div>
      <div class="form-row">
        <label>RoomPwd</label>
        <input v-model="form.roomPwd" type="password" :disabled="isJoined" />
      </div>

      <div class="btn-row">
        <button class="btn-connect" :class="{ active: isJoined, pending: joining }" :disabled="isJoined || joining || !form.peerName || !form.roomName" @click="join">
          {{ isJoined ? 'joined' : (joining ? 'joining…' : 'join') }}
        </button>
        <button class="btn-disconnect" :disabled="!isJoined" @click="leave">
          leave
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.session-view {
  max-width: 520px;
  margin: 32px auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: #ddd;
}

.card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 16px 20px;
}

h3 {
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
  margin: 4px 0 16px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.form-row label {
  min-width: 100px;
  font-size: 12px;
  color: #aaa;
}

.form-row input,
.form-row select {
  flex: 1;
  background: #222;
  border: 1px solid #333;
  color: #ddd;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
}

.form-row input:disabled,
.form-row select:disabled {
  background: #1e1e1e;
  color: #888;
}

.btn-row {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  justify-content: center;
}

button {
  flex: 1;
  padding: 10px;
  border: 0;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}

.btn-connect {
  background: #2d7a2d;
  color: #fff;
}
.btn-connect:hover:not(:disabled) { background: #389038; }
.btn-connect.active {
  background: #b8e0b8;
  color: #2d5a2d;
  cursor: default;
}
.btn-connect.pending { opacity: 0.7; }
.btn-connect:disabled:not(.active) {
  background: #2a4a2a;
  color: #6a8a6a;
  cursor: default;
}

.btn-disconnect {
  background: #c03030;
  color: #fff;
}
.btn-disconnect:hover:not(:disabled) { background: #d03838; }
.btn-disconnect:disabled {
  background: #4a2828;
  color: #8a5a5a;
  cursor: default;
}

.error {
  color: #f66;
  font-size: 12px;
  margin-top: 10px;
  text-align: center;
}
</style>
