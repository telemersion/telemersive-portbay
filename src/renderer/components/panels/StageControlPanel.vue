<script setup lang="ts">
import { useMqttBinding } from '../../composables/useMqttBinding'
import { useSessionInfo } from '../../composables/useSessionInfo'
import { computed } from 'vue'

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  isLocal: boolean
  targetLocked: boolean
}>()

const { brokerHost, roomId, roomName } = useSessionInfo()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const udp = computed(() => gui.value?.localudp ?? {})
const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => isEnabled.value || (!props.isLocal && props.targetLocked))

const prefix = computed(() =>
  `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/device/gui`
)

function bind(subpath: string, getter: () => string | undefined) {
  return useMqttBinding(getter, `${prefix.value}/${subpath}`)
}

const enableBinding = bind('enable', () => gui.value?.enable)
const descBinding = bind('description', () => gui.value?.description)
const outputIPOne = bind('localudp/outputIPOne', () => udp.value?.outputIPOne)
const outputPortOne = bind('localudp/outputPortOne', () => udp.value?.outputPortOne)
const enableTwo = bind('localudp/enableTwo', () => udp.value?.enableTwo)
const outputIPTwo = bind('localudp/outputIPTwo', () => udp.value?.outputIPTwo)
const outputPortTwo = bind('localudp/outputPortTwo', () => udp.value?.outputPortTwo)
const inputPort = bind('localudp/inputPort', () => udp.value?.inputPort)

const oscUrl = computed(() => {
  if (roomId.value <= 0) return ''
  const host = `${brokerHost.value}:${roomId.value * 1000 + 900}`
  if (!roomName.value) return `http://${host}`
  const cred = encodeURIComponent(roomName.value)
  return `http://${cred}:${cred}@${host}`
})

const emit = defineEmits<{ remove: [] }>()

function toggleEnable() {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

async function removeDevice() {
  const topic = `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: '0', retain: true })
  emit('remove')
}

async function resetDevice() {
  await window.api.invoke('mqtt:publish', {
    topic: `${prefix.value}/localudp/reset`,
    value: '1',
    retain: true
  })
}

function openOsc() {
  if (oscUrl.value) window.open(oscUrl.value, '_blank')
}
</script>

<template>
  <div class="stagec-panel">
    <div class="panel-header">
      <button
        class="enable-btn"
        :class="{ active: isEnabled }"
        :disabled="!isLocal && targetLocked"
        @click="toggleEnable"
      >
        {{ isEnabled ? 'ON' : 'OFF' }}
      </button>
      <input
        class="description-input"
        :value="descBinding.value.value"
        :disabled="isLocked"
        @change="descBinding.set(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="open-osc-row">
      <button
        class="open-osc-btn"
        :disabled="roomId === 0"
        :title="oscUrl || 'Join a room first'"
        @click="openOsc"
      >
        Open Stage Control ↗
      </button>
    </div>

    <section>
      <h4>Forward to</h4>
      <div class="field-row">
        <label>output 1</label>
        <input
          :value="outputIPOne.value.value"
          :disabled="isLocked"
          placeholder="IP address"
          @change="outputIPOne.set(($event.target as HTMLInputElement).value)"
        />
        <input
          class="port-input"
          :value="outputPortOne.value.value"
          :disabled="isLocked"
          placeholder="port"
          @change="outputPortOne.set(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-row">
        <button
          class="toggle-btn label-slot"
          :class="{ on: enableTwo.value.value === '1' }"
          :disabled="isLocked"
          @click="enableTwo.set(enableTwo.value.value === '1' ? '0' : '1')"
        >
          {{ enableTwo.value.value === '1' ? 'output 2' : 'output 2 off' }}
        </button>
        <template v-if="enableTwo.value.value === '1'">
          <input
            :value="outputIPTwo.value.value"
            :disabled="isLocked"
            placeholder="IP address"
            @change="outputIPTwo.set(($event.target as HTMLInputElement).value)"
          />
          <input
            class="port-input"
            :value="outputPortTwo.value.value"
            :disabled="isLocked"
            placeholder="port"
            @change="outputPortTwo.set(($event.target as HTMLInputElement).value)"
          />
        </template>
      </div>
    </section>

    <section>
      <h4>Receiving at</h4>
      <div class="field-row">
        <label>input</label>
        <input :value="udp.peerLocalIP" disabled placeholder="IP address" />
        <input class="port-input" :value="inputPort.value.value" disabled placeholder="port" />
      </div>
    </section>

    <div class="panel-actions">
      <button class="reset-btn" @click="resetDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Reset to Defaults
      </button>
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Remove Device
      </button>
    </div>
  </div>
</template>

<style scoped>
.stagec-panel { padding: 12px; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; background: #333; color: #ccc; }
.enable-btn.active { background: #1D9E75; color: white; border-color: #1D9E75; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
.open-osc-row { margin-bottom: 12px; }
.open-osc-btn { width: 100%; padding: 7px 12px; border-radius: 6px; border: 1px solid #FE5FF5; background: none; color: #FE5FF5; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.15s, color 0.15s; }
.open-osc-btn:hover:not(:disabled) { background: #FE5FF5; color: #111; }
.open-osc-btn:disabled { opacity: 0.35; cursor: not-allowed; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input { flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row input:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 72px !important; flex: none !important; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 11px; }
.toggle-btn.on { background: #FE5FF5; color: white; border-color: #FE5FF5; }
.toggle-btn.label-slot { min-width: 70px; text-align: center; }
.toggle-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; display: flex; gap: 8px; }
.reset-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #888; background: none; color: #aaa; cursor: pointer; font-size: 11px; }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
