<script setup lang="ts">
import { useMqttBinding } from '../../composables/useMqttBinding'
import { computed, ref, watch } from 'vue'

const MONITOR_LOG_CAPACITY = 200

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  isLocal: boolean
  targetLocked: boolean
}>()

const emit = defineEmits<{ remove: [] }>()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const udp = computed(() => gui.value?.localudp ?? {})
const direction = computed(() => gui.value?.direction ?? {})
const natnet = computed(() => gui.value?.natnet ?? {})
const monitor = computed(() => gui.value?.monitor ?? {})

const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => isEnabled.value || (!props.isLocal && props.targetLocked))

// Direction values mirror NatNetDevice.Direction enum:
//   0 = SendToRouter, 1 = SendToLocal — both require NatNetThree2OSC CLI (Windows-only).
//   2 = ReceiveFromRouter — pure UDP relay, cross-platform.
const directionValue = computed(() => direction.value?.select ?? '2')
const showCliParams = computed(() => directionValue.value === '0' || directionValue.value === '1')

const localOs = computed(() => gui.value?.remoteValues?.local_os ?? '')
const cliAvailable = computed(() => localOs.value === 'windows')

const prefix = computed(() =>
  `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/device/gui`
)

function bind(subpath: string, getter: () => string | undefined) {
  return useMqttBinding(getter, `${prefix.value}/${subpath}`)
}

const enableBinding = bind('enable', () => gui.value?.enable)
const enableTwoBinding = bind('enableTwo', () => gui.value?.enableTwo)
const descBinding = bind('description', () => gui.value?.description)
const directionBinding = bind('direction/select', () => direction.value?.select)
const enableNatNetBinding = bind('direction/enableNatNet', () => direction.value?.enableNatNet)

const outputIPOne = bind('localudp/outputIPOne', () => udp.value?.outputIPOne)
const outputPortOne = bind('localudp/outputPortOne', () => udp.value?.outputPortOne)
const outputIPTwo = bind('localudp/outputIPTwo', () => udp.value?.outputIPTwo)
const outputPortTwo = bind('localudp/outputPortTwo', () => udp.value?.outputPortTwo)
const listeningIP = bind('localudp/listeningIP', () => udp.value?.listeningIP)
const inputPort = bind('localudp/inputPort', () => udp.value?.inputPort)

const cmdPort = bind('natnet/cmdPort', () => natnet.value?.cmdPort)
const dataPort = bind('natnet/dataPort', () => natnet.value?.dataPort)
const motiveIP = bind('natnet/motiveIP', () => natnet.value?.motiveIP)
const multicastIP = bind('natnet/multicastIP', () => natnet.value?.multicastIP)
const codec = bind('natnet/codec', () => natnet.value?.codec)
const frameModulo = bind('natnet/frameModulo', () => natnet.value?.frameModulo)

const defaultLocalIP = bind('natnet/defaultLocalIP', () => natnet.value?.defaultLocalIP)
const autoReconnect = bind('natnet/autoReconnect', () => natnet.value?.autoReconnect)
const bundled = bind('natnet/bundled', () => natnet.value?.bundled)
const invmatrix = bind('natnet/invmatrix', () => natnet.value?.invmatrix)
const matrix = bind('natnet/matrix', () => natnet.value?.matrix)
const leftHanded = bind('natnet/leftHanded', () => natnet.value?.leftHanded)
const yUp2zUp = bind('natnet/yUp2zUp', () => natnet.value?.yUp2zUp)
const sendMarkerInfos = bind('natnet/sendMarkerInfos', () => natnet.value?.sendMarkerInfos)
const sendOtherMarkerInfos = bind('natnet/sendOtherMarkerInfos', () => natnet.value?.sendOtherMarkerInfos)
const sendSkeletons = bind('natnet/sendSkeletons', () => natnet.value?.sendSkeletons)
const verbose = bind('natnet/verbose', () => natnet.value?.verbose)

const monitorGateBinding = bind('monitor/monitorGate', () => monitor.value?.monitorGate)
const monitorLog = computed(() => monitor.value?.log ?? '')
const monitorGateOn = computed(() => monitor.value?.monitorGate === '1')
const monitorLogBuffer = ref<string[]>([])
const monitorLogText = computed(() => monitorLogBuffer.value.join('\n'))

const cliAdvOpen = ref(false)

watch(monitorLog, (line) => {
  if (!line) return
  monitorLogBuffer.value.push(line)
  while (monitorLogBuffer.value.length > MONITOR_LOG_CAPACITY) {
    monitorLogBuffer.value.shift()
  }
})

function clearMonitorLog() {
  monitorLogBuffer.value = []
}

function toggleEnable() {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

function toggleEnableTwo() {
  enableTwoBinding.set(gui.value?.enableTwo === '1' ? '0' : '1')
}

function toggleEnableNatNet() {
  enableNatNetBinding.set(direction.value?.enableNatNet === '1' ? '0' : '1')
}

function toggleMonitorGate() {
  monitorGateBinding.set(monitorGateOn.value ? '0' : '1')
}

function toggleBoolField(binding: { value: { value: string }; set: (v: string) => void }) {
  binding.set(binding.value.value === '1' ? '0' : '1')
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

const enableTwoOn = computed(() => gui.value?.enableTwo === '1')
const enableNatNetOn = computed(() => direction.value?.enableNatNet === '1')
</script>

<template>
  <div class="natnet-panel">
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

    <section>
      <h4>Mode</h4>
      <div class="field-row">
        <label>direction</label>
        <select
          :value="directionValue"
          :disabled="isLocked"
          @change="directionBinding.set(($event.target as HTMLSelectElement).value)"
        >
          <option value="2">receive from router</option>
          <option value="0">send to router</option>
          <option value="1">send to local</option>
        </select>
      </div>
      <div v-if="showCliParams && !cliAvailable" class="cli-warning">
        NatNetThree2OSC is required for send modes and is currently Windows-only
        ({{ localOs || 'unknown OS' }} detected).
      </div>
    </section>

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
          :class="{ on: enableTwoOn }"
          :disabled="isLocked"
          @click="toggleEnableTwo"
        >
          {{ enableTwoOn ? 'output 2' : 'output 2 off' }}
        </button>
        <template v-if="enableTwoOn">
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
        <input
          :value="listeningIP.value.value"
          :disabled="isLocked"
          placeholder="IP address"
          @change="listeningIP.set(($event.target as HTMLInputElement).value)"
        />
        <input class="port-input" :value="inputPort.value.value" disabled placeholder="port" />
      </div>
    </section>

    <section v-if="showCliParams">
      <h4>
        NatNet
        <button
          class="toggle-btn"
          :class="{ on: enableNatNetOn }"
          :disabled="isLocked || !cliAvailable"
          @click="toggleEnableNatNet"
        >
          {{ enableNatNetOn ? 'ON' : 'OFF' }}
        </button>
      </h4>
      <div class="field-row">
        <label>motive ip</label>
        <input
          :value="motiveIP.value.value"
          :disabled="isLocked"
          placeholder="IP address"
          @change="motiveIP.set(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="field-row">
        <label>multicast</label>
        <input
          :value="multicastIP.value.value"
          :disabled="isLocked"
          placeholder="IP address"
          @change="multicastIP.set(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="field-row">
        <label>cmd port</label>
        <input
          class="port-input"
          :value="cmdPort.value.value"
          :disabled="isLocked"
          @change="cmdPort.set(($event.target as HTMLInputElement).value)"
        />
        <label>data port</label>
        <input
          class="port-input"
          :value="dataPort.value.value"
          :disabled="isLocked"
          @change="dataPort.set(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="field-row">
        <label>codec</label>
        <select
          :value="codec.value.value"
          :disabled="isLocked"
          @change="codec.set(($event.target as HTMLSelectElement).value)"
        >
          <option value="0">NatNet 2.x</option>
          <option value="1">NatNet 3.x</option>
          <option value="2">NatNet 4.x</option>
          <option value="3">auto</option>
        </select>
        <label>frame %</label>
        <input
          class="port-input"
          :value="frameModulo.value.value"
          :disabled="isLocked"
          @change="frameModulo.set(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="advanced-row">
        <button class="advanced-pill" @click="cliAdvOpen = !cliAdvOpen">
          advanced {{ cliAdvOpen ? '▾' : '▸' }}
        </button>
      </div>

      <div v-if="cliAdvOpen" class="advanced-fold">
        <div class="flag-grid">
          <button class="flag-btn" :class="{ on: defaultLocalIP.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(defaultLocalIP)">default local IP</button>
          <button class="flag-btn" :class="{ on: autoReconnect.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(autoReconnect)">auto reconnect</button>
          <button class="flag-btn" :class="{ on: bundled.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(bundled)">bundled</button>
          <button class="flag-btn" :class="{ on: matrix.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(matrix)">matrix</button>
          <button class="flag-btn" :class="{ on: invmatrix.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(invmatrix)">inv matrix</button>
          <button class="flag-btn" :class="{ on: leftHanded.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(leftHanded)">left handed</button>
          <button class="flag-btn" :class="{ on: yUp2zUp.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(yUp2zUp)">Y-up → Z-up</button>
          <button class="flag-btn" :class="{ on: sendSkeletons.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(sendSkeletons)">skeletons</button>
          <button class="flag-btn" :class="{ on: sendMarkerInfos.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(sendMarkerInfos)">marker infos</button>
          <button class="flag-btn" :class="{ on: sendOtherMarkerInfos.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(sendOtherMarkerInfos)">other markers</button>
          <button class="flag-btn" :class="{ on: verbose.value.value === '1' }" :disabled="isLocked" @click="toggleBoolField(verbose)">verbose</button>
        </div>
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
.natnet-panel { padding: 12px; overflow-y: auto; flex: 1; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; background: #333; color: #ccc; }
.enable-btn.active { background: #FFA126; color: #1a1a1a; border-color: #FFA126; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input, .field-row select { flex: 1; min-width: 0; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row input:disabled, .field-row select:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 80px !important; flex: none !important; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 10px; }
.toggle-btn.on { background: #FFA126; color: #1a1a1a; border-color: #FFA126; }
.toggle-btn.label-slot { min-width: 70px; text-align: center; font-size: 11px; }
.toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.monitor-controls { display: flex; gap: 6px; }
.monitor-log { max-height: 160px; overflow-y: auto; background: #0d0d0d; border: 1px solid #333; border-radius: 4px; padding: 6px 8px; color: #fc9; font-family: monospace; font-size: 10px; white-space: pre-wrap; }
.cli-warning { padding: 6px 8px; margin: 6px 0 4px; border: 1px dashed #555; border-radius: 4px; color: #c88; font-size: 11px; }
.advanced-row { display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 4px; }
.advanced-pill { padding: 3px 10px; border-radius: 10px; border: 1px solid #555; background: #2a2a2a; color: #aaa; cursor: pointer; font-size: 10px; text-transform: lowercase; }
.advanced-pill:hover { background: #333; color: #ddd; }
.advanced-fold { margin-top: 4px; padding: 8px; border: 1px solid #333; border-radius: 4px; background: #1a1a1a; }
.flag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.flag-btn { padding: 4px 6px; border-radius: 4px; border: 1px solid #444; background: #262626; color: #bbb; cursor: pointer; font-size: 10px; font-family: monospace; text-align: left; }
.flag-btn:hover:not(:disabled) { background: #333; color: #fff; }
.flag-btn.on { background: #FFA126; color: #1a1a1a; border-color: #FFA126; }
.flag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; display: flex; gap: 8px; }
.reset-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #888; background: none; color: #aaa; cursor: pointer; font-size: 11px; }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
