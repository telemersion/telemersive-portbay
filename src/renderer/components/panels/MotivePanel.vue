<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMqttBinding } from '../../composables/useMqttBinding'
import { useNetworkInterfaces, bestGuessInterfaceName } from '../../composables/useNetworkInterfaces'

const MONITOR_LOG_CAPACITY = 200

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  peerSettings?: any
  isLocal: boolean
  targetLocked: boolean
}>()

const emit = defineEmits<{ remove: [] }>()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const udp = computed(() => gui.value?.localudp ?? {})
const direction = computed(() => gui.value?.direction ?? {})
const monitor = computed(() => gui.value?.monitor ?? {})
const health = computed(() => gui.value?.health ?? {})

const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => isEnabled.value || (!props.isLocal && props.targetLocked))

const directionValue = computed(() => direction.value?.select ?? '1')
const isSource = computed(() => directionValue.value === '1')

const prefix = computed(() =>
  `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/device/gui`
)

function bind(subpath: string, getter: () => string | undefined) {
  return useMqttBinding(getter, `${prefix.value}/${subpath}`)
}

const enableBinding = bind('enable', () => gui.value?.enable)
const descBinding = bind('description', () => gui.value?.description)
const directionBinding = bind('direction/select', () => direction.value?.select)
const multicastIP = bind('localudp/multicastIP', () => udp.value?.multicastIP)
const dataPort = bind('localudp/dataPort', () => udp.value?.dataPort)
const cmdPort = bind('localudp/cmdPort', () => udp.value?.cmdPort)
const interfaceNameBinding = bind('localudp/interfaceName', () => udp.value?.interfaceName)
const motiveIP = bind('localudp/motiveIP', () => udp.value?.motiveIP)
const monitorGateBinding = bind('monitor/monitorGate', () => monitor.value?.monitorGate)

const monitorLog = computed(() => monitor.value?.log ?? '')
const monitorGateOn = computed(() => monitor.value?.monitorGate === '1')
const monitorLogBuffer = ref<string[]>([])
const monitorLogText = computed(() => monitorLogBuffer.value.join('\n'))

const healthState = computed<string>(() => health.value?.state ?? 'ok')

watch(monitorLog, (line) => {
  if (!line) return
  monitorLogBuffer.value.push(line)
  while (monitorLogBuffer.value.length > MONITOR_LOG_CAPACITY) {
    monitorLogBuffer.value.shift()
  }
})

function clearMonitorLog(): void {
  monitorLogBuffer.value = []
}

function toggleEnable(): void {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

function toggleMonitorGate(): void {
  monitorGateBinding.set(monitorGateOn.value ? '0' : '1')
}

function flipDirection(next: string): void {
  if (next === directionValue.value) return
  directionBinding.set(next)
}

async function removeDevice(): Promise<void> {
  const topic = `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: '0', retain: true })
  emit('remove')
}

async function resetDevice(): Promise<void> {
  await window.api.invoke('mqtt:publish', {
    topic: `${prefix.value}/localudp/reset`,
    value: '1',
    retain: true
  })
}

const { interfaces, loaded: interfacesLoaded } = useNetworkInterfaces()

const ownLocalIP = computed(() => props.peerSettings?.localIP ?? '')

watch(
  [interfacesLoaded, () => interfaceNameBinding.value.value, ownLocalIP],
  () => {
    if (!interfacesLoaded.value) return
    if (interfaceNameBinding.value.value) return
    if (!props.isLocal) return
    const guess = bestGuessInterfaceName(ownLocalIP.value, interfaces.value)
    if (guess) interfaceNameBinding.set(guess)
  },
  { immediate: true }
)

const interfaceMissing = computed(() =>
  !!interfaceNameBinding.value.value &&
  interfacesLoaded.value &&
  !interfaces.value.some((i) => i.name === interfaceNameBinding.value.value)
)

const healthLabel = computed(() => {
  switch (healthState.value) {
    case 'ok': return null
    case 'waiting_motive': return 'Waiting for Motive multicast data…'
    case 'waiting_consumer': return 'Waiting for a NatNet consumer (Unity / Unreal) to connect…'
    case 'no_proxy': return 'Proxy unreachable — handshake never returned.'
    case 'duplicate_source': return 'Another peer is already running a Motive Source on this channel.'
    case 'interface_missing': return `Network interface "${interfaceNameBinding.value.value}" not found on this host.`
    case 'port_conflict': return 'Port conflict with another Motive device on this peer. Check monitor log.'
    default: return null
  }
})
</script>

<template>
  <div class="motive-panel">
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

    <div v-if="healthLabel" class="health-banner" :class="`health-${healthState}`">
      {{ healthLabel }}
    </div>

    <section>
      <h4>Role</h4>
      <div class="role-row">
        <button
          class="role-btn"
          :class="{ active: isSource }"
          :disabled="isLocked"
          @click="flipDirection('1')"
        >Source</button>
        <button
          class="role-btn"
          :class="{ active: !isSource }"
          :disabled="isLocked"
          @click="flipDirection('2')"
        >Sink</button>
      </div>
      <p class="role-hint">
        <template v-if="isSource">
          This peer is on the same LAN as Motive — captures multicast NatNet
          and pushes it through the bridge.
        </template>
        <template v-else>
          This peer is on the same LAN as the consumer (Unity / Unreal) —
          receives bridged data and re-multicasts locally.
        </template>
      </p>
    </section>

    <section>
      <h4>Network</h4>
      <div class="field-row">
        <label>interface</label>
        <select
          :value="interfaceNameBinding.value.value"
          :disabled="isLocked || !isLocal"
          @change="interfaceNameBinding.set(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!interfaceNameBinding.value.value" value="">— pick an interface —</option>
          <option v-if="interfaceMissing" :value="interfaceNameBinding.value.value">
            {{ interfaceNameBinding.value.value }} (not found)
          </option>
          <option v-for="iface in interfaces" :key="iface.name" :value="iface.name">
            {{ iface.name }} — {{ iface.address }}
          </option>
        </select>
      </div>
      <div class="field-row">
        <label>multicast</label>
        <input
          :value="multicastIP.value.value"
          :disabled="isLocked"
          placeholder="239.255.42.99"
          @change="multicastIP.set(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="field-row">
        <label>data port</label>
        <input
          class="port-input"
          :value="dataPort.value.value"
          :disabled="isLocked"
          @change="dataPort.set(($event.target as HTMLInputElement).value)"
        />
        <label>cmd port</label>
        <input
          class="port-input"
          :value="cmdPort.value.value"
          :disabled="isLocked"
          @change="cmdPort.set(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div v-if="isSource" class="field-row">
        <label>motive ip</label>
        <input
          :value="motiveIP.value.value"
          :disabled="isLocked"
          placeholder="IP address of the Motive host"
          @change="motiveIP.set(($event.target as HTMLInputElement).value)"
        />
      </div>
    </section>

    <section>
      <h4>
        Monitor
        <span class="monitor-controls">
          <button class="toggle-btn" @click="clearMonitorLog" :disabled="monitorLogBuffer.length === 0">
            Clear
          </button>
          <button class="toggle-btn" :class="{ on: monitorGateOn }" @click="toggleMonitorGate">
            {{ monitorGateOn ? 'ON' : 'OFF' }}
          </button>
        </span>
      </h4>
      <pre v-if="monitorGateOn" class="monitor-log">{{ monitorLogText || '(no output)' }}</pre>
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
.motive-panel { padding: 12px; overflow-y: auto; flex: 1; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; background: #333; color: #ccc; }
.enable-btn.active { background: #E84E4E; color: #1a1a1a; border-color: #E84E4E; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
.health-banner { padding: 6px 10px; border-radius: 4px; font-size: 11px; margin-bottom: 12px; }
.health-waiting_motive, .health-waiting_consumer { background: #2a2a1a; color: #d0c080; border: 1px solid #4a4a2a; }
.health-no_proxy, .health-duplicate_source, .health-interface_missing, .health-port_conflict { background: #2a1a1a; color: #e07b7b; border: 1px solid #4a2a2a; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input, .field-row select { flex: 1; min-width: 0; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row input:disabled, .field-row select:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 80px !important; flex: none !important; }
.role-row { display: flex; gap: 6px; }
.role-btn { flex: 1; padding: 6px 12px; border-radius: 4px; border: 1px solid #555; background: #2a2a2a; color: #aaa; cursor: pointer; font-size: 12px; font-weight: 500; }
.role-btn.active { background: #E84E4E; color: #1a1a1a; border-color: #E84E4E; }
.role-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.role-hint { margin: 8px 0 0; font-size: 11px; color: #888; line-height: 1.4; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 10px; }
.toggle-btn.on { background: #E84E4E; color: #1a1a1a; border-color: #E84E4E; }
.toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.monitor-controls { display: flex; gap: 6px; }
.monitor-log { max-height: 160px; overflow-y: auto; background: #0d0d0d; border: 1px solid #333; border-radius: 4px; padding: 6px 8px; color: #fc9; font-family: monospace; font-size: 10px; white-space: pre-wrap; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; display: flex; gap: 8px; }
.reset-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #888; background: none; color: #aaa; cursor: pointer; font-size: 11px; }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
