<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const rooms = ref<string[]>([])
const joining = ref(false)

const form = reactive({
  peerName: '',
  roomName: '',
  roomPwd: ''
})

window.api.invoke('settings:load').then((settings: any) => {
  if (settings) {
    form.peerName = settings.peerName || ''
    form.roomName = settings.lastRoomName || ''
    form.roomPwd = settings.lastRoomPwd || ''
  }
})

window.api.on('rooms:clear', () => { rooms.value = [] })
window.api.on('rooms:append', (name: string) => { rooms.value.push(name) })

window.api.on('peer:joined', (joined: boolean) => {
  if (joined) {
    joining.value = false
    router.push('/matrix')
  }
})

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
</script>

<template>
  <div class="room-picker">
    <h2>Join Room</h2>

    <div v-if="rooms.length > 0" class="room-list">
      <h3>Available Rooms</h3>
      <div
        v-for="name in rooms"
        :key="name"
        class="room-item"
        :class="{ selected: form.roomName === name }"
        @click="selectRoom(name)"
      >
        {{ name }}
      </div>
    </div>
    <p v-else class="muted">No rooms found — type a name to create one.</p>

    <div class="form-row">
      <label>Peer Name</label>
      <input v-model="form.peerName" placeholder="your display name" />
    </div>
    <div class="form-row">
      <label>Room</label>
      <input v-model="form.roomName" placeholder="room name" />
    </div>
    <div class="form-row">
      <label>Password</label>
      <input v-model="form.roomPwd" type="password" placeholder="room password" />
    </div>
    <button @click="join" :disabled="joining || !form.peerName || !form.roomName">
      {{ joining ? 'Joining...' : 'Join' }}
    </button>
  </div>
</template>

<style scoped>
.room-picker { max-width: 400px; margin: 40px auto; }
.form-row { margin-bottom: 8px; }
.form-row label { display: inline-block; min-width: 100px; }
.form-row input { width: 220px; }
.room-list { margin-bottom: 16px; }
.room-item { padding: 4px 8px; cursor: pointer; border-radius: 4px; }
.room-item:hover { background: #333; }
.room-item.selected { background: #2563eb; color: white; }
.muted { color: #888; font-size: 12px; }
</style>
