<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const error = ref('')
const connecting = ref(false)

const config = reactive({
  host: 'telemersion.zhdk.ch',
  port: 3883,
  username: 'peer',
  password: 'telemersion2021',
  localIP: ''
})

window.api.invoke('settings:load').then((settings: any) => {
  if (settings) {
    config.host = settings.brokerUrl || config.host
    config.port = settings.brokerPort || config.port
    config.username = settings.brokerUser || config.username
    config.password = settings.brokerPwd || config.password
  }
})

window.api.on('peer:localIP', (ip: string) => {
  config.localIP = ip
})

window.api.on('broker:connected', (connected: boolean) => {
  if (connected) {
    connecting.value = false
    router.push('/rooms')
  } else {
    connecting.value = false
    error.value = 'Connection failed'
  }
})

async function connect() {
  error.value = ''
  connecting.value = true
  window.api.send('bus:configure', { ...config })
  try {
    await window.api.invoke('bus:connect')
  } catch (e: any) {
    connecting.value = false
    error.value = e.message || 'Connection failed'
  }
}
</script>

<template>
  <div class="connect-view">
    <h2>Connect to Broker</h2>
    <div class="form-row">
      <label>Host</label>
      <input v-model="config.host" />
    </div>
    <div class="form-row">
      <label>Port</label>
      <input v-model.number="config.port" type="number" />
    </div>
    <div class="form-row">
      <label>Username</label>
      <input v-model="config.username" />
    </div>
    <div class="form-row">
      <label>Password</label>
      <input v-model="config.password" type="password" />
    </div>
    <button @click="connect" :disabled="connecting">
      {{ connecting ? 'Connecting...' : 'Connect' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.connect-view { max-width: 400px; margin: 40px auto; }
.form-row { margin-bottom: 8px; }
.form-row label { display: inline-block; min-width: 80px; }
.form-row input { width: 240px; }
.error { color: #f44; margin-top: 8px; }
</style>
