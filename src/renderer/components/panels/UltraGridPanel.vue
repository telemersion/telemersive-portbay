<script setup lang="ts">
import { useMqttBinding } from '../../composables/useMqttBinding'
import { computed, ref, watch } from 'vue'
import { type Backend, refreshTopic } from '../../../shared/topics'

const MONITOR_LOG_CAPACITY = 200

const VIDEO_FILTER_CHIPS = [
  'blank:10:10:50:20', 'flip', 'resize:1/2',
  'blank:10%:10%:3%:2%', 'grayscale', 'resize:1920x1080',
  'mirror', 'every:2', 'display:ndi'
] as const

const VIDEO_POSTPROCESS_CHIPS = [
  'crop:wdith=200:height=200:xoff=20:yoff=20',
  'border:color=#ff0000:width=20==8', 'flip',
  'double_framerate:d:nodelay', 'scale:200:20',
  'resize:1920x1080', 'split:2:2', 'grayscale'
] as const

const AUDIO_MAPPING_CHIPS = [
  '0:0', '0:0, 1:0', '0:0\\,:1', '0:0,0:1', '4:0\\,5:1'
] as const

const ADVANCED_PARAMS_CHIPS = [
  'audio-buffer-len=<ms>', 'low-latency-audio[=ultra]', 'no-dither',
  'audio-cap-frames=<f>', 'disable-keyboard-control',
  'udp-queue-len=<l>', 'audio-disable-adaptive-buffer',
  'lavc-use-codec=<c>', 'stdout-buf={no|line|full}', 'use-hw-accel',
  'audioenc-frame-duration=<ms>', 'resampler-quality=[0-10]',
  'ldgm-device={CPU|GPU}', 'window-title=<title>', 'errors-fatal',
  'lavc-h264-interlaced-dct', 'gl-disable-10b',
  'glfw-window-hint=<k>=<v>[:<k2>=<v2>...]'
] as const

const props = defineProps<{
  peerId: string
  channelIndex: number
  deviceState: any
  isLocal: boolean
  targetLocked: boolean
  peerSettings: any
}>()

const emit = defineEmits<{ remove: [] }>()

const gui = computed(() => props.deviceState?.device?.gui ?? {})
const network = computed(() => gui.value?.network ?? {})
const av = computed(() => gui.value?.audioVideo ?? {})
const videoCapture = computed(() => av.value?.videoCapture ?? {})
const videoReciever = computed(() => av.value?.videoReciever ?? {})
const audioCapture = computed(() => av.value?.audioCapture ?? {})
const audioReceiver = computed(() => av.value?.audioReceiver ?? {})
const monitor = computed(() => gui.value?.monitor ?? {})

const isEnabled = computed(() => gui.value?.enable === '1')
const isLocked = computed(() => isEnabled.value || (!props.isLocal && props.targetLocked))

const mode = computed(() => network.value?.mode ?? '1')
const connection = computed(() => av.value?.connection ?? '2')
const transmission = computed(() => av.value?.transmission ?? '2')
const videoType = computed(() => videoCapture.value?.type ?? '0')
const audioType = computed(() => audioCapture.value?.type ?? '0')
const audioRxType = computed(() => audioReceiver.value?.type ?? '0')

// Mode locks direction: mode=1 (send to router) forces connection=0 (send),
// mode=2 (receive from router) forces connection=1 (receive).
const directionLocked = computed(() => mode.value === '1' || mode.value === '2')
const showSendSide = computed(() => connection.value !== '1')
const showReceiveSide = computed(() => connection.value !== '0')
const showVideo = computed(() => transmission.value !== '1')
const showAudio = computed(() => transmission.value !== '0')

const VIDEO_COLOR = '#F0DE01'
const AUDIO_COLOR = '#00E411'

// UpStream SVG path (TX/Capture) — copied from DeviceCell.vue:109
const UPSTREAM_PATH = 'M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z'
// DownStream SVG path (RX/Receiver) — copied from DeviceCell.vue:115
const DOWNSTREAM_PATH = 'M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z'

const monitorGateOn = computed(() => monitor.value?.monitorGate === '1')
const monitorLog = computed(() => monitor.value?.log ?? '')

const monitorLogBuffer = ref<string[]>([])
const monitorLogText = computed(() => monitorLogBuffer.value.join('\n'))

const videoCaptureAdvOpen = ref(false)
const videoReceiverAdvOpen = ref(false)
const audioCaptureAdvOpen = ref(false)
const audioReceiverAdvOpen = ref(false)
const globalAdvOpen = ref(false)

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

function clearField(binding: { set: (v: string) => void }) {
  binding.set('-none-')
}

function applyChip(binding: { set: (v: string) => void }, preset: string) {
  binding.set(preset)
}

function applyPeerIdAsKey() {
  encryptionKey.set(props.peerId)
}

const localMenus = computed(() => props.peerSettings?.localMenus ?? {})

const prefix = computed(() =>
  `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/device/gui`
)

function bind(subpath: string, getter: () => string | undefined) {
  return useMqttBinding(getter, `${prefix.value}/${subpath}`)
}

const enableBinding = bind('enable', () => gui.value?.enable)
const descBinding = bind('description', () => gui.value?.description)
const modeBinding = bind('network/mode', () => network.value?.mode)
const connectionBinding = bind('audioVideo/connection', () => av.value?.connection)
const transmissionBinding = bind('audioVideo/transmission', () => av.value?.transmission)

const videoTypeBinding = bind('audioVideo/videoCapture/type', () => videoCapture.value?.type)
const textureSel = bind(
  'audioVideo/videoCapture/texture/menu/selection',
  () => videoCapture.value?.texture?.menu?.selection
)
const ndiSel = bind(
  'audioVideo/videoCapture/ndi/menu/selection',
  () => videoCapture.value?.ndi?.menu?.selection
)
const videoCodec = bind(
  'audioVideo/videoCapture/advanced/compress/codec',
  () => videoCapture.value?.advanced?.compress?.codec
)
const videoBitrate = bind(
  'audioVideo/videoCapture/advanced/compress/bitrate',
  () => videoCapture.value?.advanced?.compress?.bitrate
)
const videoFps = bind(
  'audioVideo/videoCapture/advanced/texture/fps',
  () => videoCapture.value?.advanced?.texture?.fps
)

const videoRxName = bind(
  'audioVideo/videoReciever/texture/name',
  () => videoReciever.value?.texture?.name
)

const audioTypeBinding = bind('audioVideo/audioCapture/type', () => audioCapture.value?.type)
const portaudioSel = bind(
  'audioVideo/audioCapture/portaudio/menu/selection',
  () => audioCapture.value?.portaudio?.menu?.selection
)
const coreaudioSel = bind(
  'audioVideo/audioCapture/coreaudio/menu/selection',
  () => audioCapture.value?.coreaudio?.menu?.selection
)
const wasapiSel = bind(
  'audioVideo/audioCapture/wasapi/menu/selection',
  () => audioCapture.value?.wasapi?.menu?.selection
)
const jackSel = bind(
  'audioVideo/audioCapture/jack/menu/selection',
  () => audioCapture.value?.jack?.menu?.selection
)
const audioCodec = bind(
  'audioVideo/audioCapture/advanced/compress/codec',
  () => audioCapture.value?.advanced?.compress?.codec
)
const audioBitrate = bind(
  'audioVideo/audioCapture/advanced/compress/bitrate',
  () => audioCapture.value?.advanced?.compress?.bitrate
)
const audioChannels = bind(
  'audioVideo/audioCapture/advanced/channels/channels',
  () => audioCapture.value?.advanced?.channels?.channels
)
const audioSamplerate = bind(
  'audioVideo/audioCapture/advanced/compress/samplerate',
  () => audioCapture.value?.advanced?.compress?.samplerate
)

const audioRxTypeBinding = bind('audioVideo/audioReceiver/type', () => audioReceiver.value?.type)
const portaudioRxSel = bind(
  'audioVideo/audioReceiver/portaudio/menu/selection',
  () => audioReceiver.value?.portaudio?.menu?.selection
)
const coreaudioRxSel = bind(
  'audioVideo/audioReceiver/coreaudio/menu/selection',
  () => audioReceiver.value?.coreaudio?.menu?.selection
)
const wasapiRxSel = bind(
  'audioVideo/audioReceiver/wasapi/menu/selection',
  () => audioReceiver.value?.wasapi?.menu?.selection
)
const jackRxSel = bind(
  'audioVideo/audioReceiver/jack/menu/selection',
  () => audioReceiver.value?.jack?.menu?.selection
)

const videoFilterParams = bind(
  'audioVideo/videoCapture/advanced/filter/params',
  () => videoCapture.value?.advanced?.filter?.params
)
const videoPostprocessParams = bind(
  'audioVideo/videoReciever/advanced/postprocessor/params',
  () => videoReciever.value?.advanced?.postprocessor?.params
)
const audioMappingParams = bind(
  'audioVideo/audioReceiver/advanced/channels/params',
  () => audioReceiver.value?.advanced?.channels?.params
)
const globalParams = bind(
  'audioVideo/advanced/advanced/params/params',
  () => av.value?.advanced?.advanced?.params?.params
)
const encryptionKey = bind(
  'audioVideo/advanced/advanced/encryption/key',
  () => av.value?.advanced?.advanced?.encryption?.key
)

const monitorGateBinding = bind('monitor/monitorGate', () => monitor.value?.monitorGate)

watch([mode, connection], ([m, c]) => {
  if (!props.isLocal) return
  const target = m === '1' ? '0' : m === '2' ? '1' : null
  if (target !== null && c !== target) connectionBinding.set(target)
}, { immediate: true })

function toggleEnable() {
  enableBinding.set(isEnabled.value ? '0' : '1')
}

function toggleMonitorGate() {
  monitorGateBinding.set(monitorGateOn.value ? '0' : '1')
}

async function removeDevice() {
  const topic = `/peer/${props.peerId}/rack/page_0/channel.${props.channelIndex}/loaded`
  await window.api.invoke('mqtt:publish', { topic, value: '0', retain: true })
  emit('remove')
}

function parseRange(raw: string): Array<{ index: string; label: string }> {
  if (!raw || raw === '-default-' || raw === '0') return []
  const entries: Array<{ index: string; label: string }> = []
  for (const entry of raw.split('|')) {
    const m = entry.match(/^(\d+)\s+(.+)$/)
    if (m) entries.push({ index: m[1], label: m[2] })
    else if (entry) entries.push({ index: entry, label: entry })
  }
  return entries
}

function parseTextureRange(raw: string): string[] {
  if (!raw || raw === '-default-') return []
  return raw.split('|').filter(Boolean)
}

const textureOptions = computed(() =>
  parseTextureRange(localMenus.value?.textureCaptureRange ?? '')
)
const ndiOptions = computed(() =>
  parseTextureRange(localMenus.value?.ndiRange ?? '')
)
const portaudioCaptureOptions = computed(() =>
  parseRange(localMenus.value?.portaudioCaptureRange ?? '')
)
const coreaudioCaptureOptions = computed(() =>
  parseRange(localMenus.value?.coreaudioCaptureRange ?? '')
)
const wasapiCaptureOptions = computed(() =>
  parseRange(localMenus.value?.wasapiCaptureRange ?? '')
)
const jackCaptureOptions = computed(() =>
  parseRange(localMenus.value?.jackCaptureRange ?? '')
)
const portaudioReceiveOptions = computed(() =>
  parseRange(localMenus.value?.portaudioReceiveRange ?? '')
)
const coreaudioReceiveOptions = computed(() =>
  parseRange(localMenus.value?.coreaudioReceiveRange ?? '')
)
const wasapiReceiveOptions = computed(() =>
  parseRange(localMenus.value?.wasapiReceiveRange ?? '')
)
const jackReceiveOptions = computed(() =>
  parseRange(localMenus.value?.jackReceiveRange ?? '')
)

const modeSupported = computed(() => mode.value === '1' || mode.value === '4')
const modeLabels: Record<string, string> = {
  '1': 'send to router',
  '2': 'receive from router',
  '4': 'peer to peer (automatic)',
  '5': 'peer to peer (manual)',
  '7': 'capture to local'
}

async function triggerRefresh(backend: Backend) {
  if (isEnabled.value || isLocked.value) return
  await window.api.invoke('mqtt:publish', {
    topic: refreshTopic(props.peerId, backend),
    value: '1',
    retain: false
  })
}
</script>

<template>
  <div class="ug-panel">
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
      <h4>Network</h4>
      <div class="field-row">
        <label>mode</label>
        <select
          :value="mode"
          :disabled="isLocked"
          @change="modeBinding.set(($event.target as HTMLSelectElement).value)"
        >
          <option value="1">send to router (UDP)</option>
          <option value="2">receive from router</option>
          <option value="4">peer to peer (automatic)</option>
          <option value="5">peer to peer (manual)</option>
          <option value="7">capture to local</option>
        </select>
      </div>
    </section>

    <div v-if="!modeSupported" class="unsupported-mode">
      Mode {{ mode }} ({{ modeLabels[mode] ?? 'unknown' }}) not yet supported (M2c).
      Switch to mode 1 or 4 to continue.
    </div>

    <template v-else>
      <section>
        <h4>Connection</h4>
        <div class="field-row">
          <label>direction</label>
          <select
            :value="connection"
            :disabled="isLocked || directionLocked"
            @change="connectionBinding.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="0">send</option>
            <option value="1">receive</option>
            <option value="2">both</option>
          </select>
        </div>
        <div class="field-row">
          <label>transmission</label>
          <select
            :value="transmission"
            :disabled="isLocked"
            @change="transmissionBinding.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="0">video</option>
            <option value="1">audio</option>
            <option value="2">video+audio</option>
          </select>
        </div>
      </section>

      <section v-if="showSendSide && showVideo" class="ug-section">
        <h4>
          <svg class="section-icon" viewBox="0 0 200 200" width="18" height="18"
            stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
            <path :d="UPSTREAM_PATH" :fill="VIDEO_COLOR" :stroke="VIDEO_COLOR"/>
          </svg>
          Video Capture
        </h4>
        <div class="field-row">
          <label>source</label>
          <select
            :value="videoType"
            :disabled="isLocked"
            @change="videoTypeBinding.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="0">texture</option>
            <option value="1">ndi</option>
          </select>
        </div>

        <div v-if="videoType === '0'" class="field-row">
          <label>texture</label>
          <select
            :value="textureSel.value.value"
            :disabled="isLocked"
            @change="textureSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in textureOptions" :key="name" :value="name">{{ name }}</option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('textureCapture')" title="Refresh">↻</button>
        </div>

        <div v-if="videoType === '1'" class="field-row">
          <label>ndi source</label>
          <select
            :value="ndiSel.value.value"
            :disabled="isLocked"
            @change="ndiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in ndiOptions" :key="name" :value="name">{{ name }}</option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('ndi')" title="Refresh">↻</button>
        </div>

        <div class="advanced-row">
          <button class="advanced-pill" @click="videoCaptureAdvOpen = !videoCaptureAdvOpen">
            advanced {{ videoCaptureAdvOpen ? '▾' : '▸' }}
          </button>
        </div>

        <div v-if="videoCaptureAdvOpen" class="advanced-fold">
          <div class="field-row">
            <label>codec</label>
            <select
              :value="videoCodec.value.value"
              :disabled="isLocked"
              @change="videoCodec.set(($event.target as HTMLSelectElement).value)"
            >
              <option value="2">H.264</option>
              <option value="1">JPEG</option>
            </select>
          </div>
          <div class="field-row">
            <label>bitrate (M)</label>
            <input
              class="port-input"
              :value="videoBitrate.value.value"
              :disabled="isLocked"
              @change="videoBitrate.set(($event.target as HTMLInputElement).value)"
            />
            <label>fps</label>
            <input
              class="port-input"
              :value="videoFps.value.value"
              :disabled="isLocked"
              @change="videoFps.set(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-row">
            <label>filter</label>
            <input
              :value="videoFilterParams.value.value"
              :disabled="isLocked"
              @change="videoFilterParams.set(($event.target as HTMLInputElement).value)"
            />
            <button class="clear-btn" :disabled="isLocked" @click="clearField(videoFilterParams)">clear</button>
          </div>
          <div class="chip-row">
            <button
              v-for="preset in VIDEO_FILTER_CHIPS"
              :key="preset"
              class="chip-btn"
              :disabled="isLocked"
              @click="applyChip(videoFilterParams, preset)"
            >{{ preset }}</button>
          </div>
        </div>
      </section>

      <section v-if="mode === '4' && showReceiveSide && showVideo">
        <h4>Video Receiver (Mode 4)</h4>
        <div class="field-row">
          <label>spout name</label>
          <input
            :value="videoRxName.value.value"
            :disabled="isLocked"
            @change="videoRxName.set(($event.target as HTMLInputElement).value)"
          />
        </div>
      </section>

      <section v-if="showSendSide && showAudio">
        <h4>Audio Capture</h4>
        <div class="field-row">
          <label>backend</label>
          <select
            :value="audioType"
            :disabled="isLocked"
            @change="audioTypeBinding.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="0">portaudio</option>
            <option value="1">coreaudio</option>
            <option value="2">wasapi</option>
            <option value="3">jack</option>
          </select>
        </div>

        <div v-if="audioType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioSel.value.value"
            :disabled="isLocked"
            @change="portaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('portaudioCapture')" title="Refresh">↻</button>
        </div>
        <div v-if="audioType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioSel.value.value"
            :disabled="isLocked"
            @change="coreaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('coreaudioCapture')" title="Refresh">↻</button>
        </div>
        <div v-if="audioType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiSel.value.value"
            :disabled="isLocked"
            @change="wasapiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('wasapiCapture')" title="Refresh">↻</button>
        </div>
        <div v-if="audioType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackSel.value.value"
            :disabled="isLocked"
            @change="jackSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('jackCapture')" title="Refresh">↻</button>
        </div>

        <div class="field-row">
          <label>codec</label>
          <select
            :value="audioCodec.value.value"
            :disabled="isLocked"
            @change="audioCodec.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="1">OPUS</option>
          </select>
        </div>
        <div class="field-row">
          <label>bitrate</label>
          <input
            class="port-input"
            :value="audioBitrate.value.value"
            :disabled="isLocked"
            @change="audioBitrate.set(($event.target as HTMLInputElement).value)"
          />
          <label>channels</label>
          <input
            class="port-input"
            :value="audioChannels.value.value"
            :disabled="isLocked"
            @change="audioChannels.set(($event.target as HTMLInputElement).value)"
          />
        </div>
      </section>

      <section v-if="mode === '4' && showReceiveSide && showAudio">
        <h4>Audio Receiver (Mode 4)</h4>
        <div class="field-row">
          <label>backend</label>
          <select
            :value="audioRxType"
            :disabled="isLocked"
            @change="audioRxTypeBinding.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="0">portaudio</option>
            <option value="1">coreaudio</option>
            <option value="2">wasapi</option>
            <option value="3">jack</option>
          </select>
        </div>

        <div v-if="audioRxType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioRxSel.value.value"
            :disabled="isLocked"
            @change="portaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('portaudioReceive')" title="Refresh">↻</button>
        </div>
        <div v-if="audioRxType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioRxSel.value.value"
            :disabled="isLocked"
            @change="coreaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('coreaudioReceive')" title="Refresh">↻</button>
        </div>
        <div v-if="audioRxType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiRxSel.value.value"
            :disabled="isLocked"
            @change="wasapiRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('wasapiReceive')" title="Refresh">↻</button>
        </div>
        <div v-if="audioRxType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackRxSel.value.value"
            :disabled="isLocked"
            @change="jackRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('jackReceive')" title="Refresh">↻</button>
        </div>
      </section>
    </template>

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
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Remove Device
      </button>
    </div>
  </div>
</template>

<style scoped>
.ug-panel { padding: 12px; overflow-y: auto; flex: 1; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.enable-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #555; cursor: pointer; font-weight: 600; background: #333; color: #ccc; }
.enable-btn.active { background: #1D9E75; color: white; border-color: #1D9E75; }
.description-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #555; background: #222; color: white; text-align: center; font-size: 14px; }
section { margin-bottom: 12px; }
h4 { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; padding: 4px 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row label { min-width: 70px; font-size: 11px; color: #888; }
.field-row input, .field-row select { flex: 1; min-width: 0; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; font-family: monospace; font-size: 12px; }
.field-row select { text-overflow: ellipsis; }
.field-row input:disabled, .field-row select:disabled { color: #666; cursor: not-allowed; }
.port-input { max-width: 80px !important; flex: none !important; }
.toggle-btn { padding: 2px 8px; border-radius: 4px; border: 1px solid #555; background: none; color: #888; cursor: pointer; font-size: 10px; }
.toggle-btn.on { background: #36ABFF; color: white; border-color: #36ABFF; }
.toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.monitor-controls { display: flex; gap: 6px; }
.unsupported-mode { padding: 16px; margin: 8px 0; border: 1px dashed #555; border-radius: 4px; color: #aaa; font-size: 12px; text-align: center; }
.monitor-log { max-height: 160px; overflow-y: auto; background: #0d0d0d; border: 1px solid #333; border-radius: 4px; padding: 6px 8px; color: #9c9; font-family: monospace; font-size: 10px; white-space: pre-wrap; }
.panel-actions { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; display: flex; gap: 8px; }
.remove-btn { padding: 6px 12px; border-radius: 4px; border: 1px solid #a33; background: none; color: #a33; cursor: pointer; font-size: 11px; }
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.refresh-icon {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.refresh-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
