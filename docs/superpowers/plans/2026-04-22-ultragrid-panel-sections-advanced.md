# UltraGrid Panel — Section Icons + Advanced Folds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add static direction-icons to the four UG audio/video section headings, and hide secondary fields (codec, bitrate, filter, etc.) behind a per-section "advanced" unfold — matching Max gateway parity. Also add a 5th panel-level "Advanced" section exposing the `encryption/key` and global `params` fields, with a clickable peerId suggestion.

**Architecture:** Pure renderer-side change to [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue). No main-process, handler, or config changes. All target wire fields are already declared in [src/main/devices/ultragrid/config.ts](../../../src/main/devices/ultragrid/config.ts) and already tracked by the publish/clear machinery. Fold state is ephemeral (`ref<boolean>`), resets on mount. Section icons are inline SVG paths reused verbatim from [src/renderer/components/DeviceCell.vue](../../../src/renderer/components/DeviceCell.vue).

**Tech Stack:** Vue 3 `<script setup>` SFC, TypeScript strict, existing `useMqttBinding` composable, inline SVGs.

---

## Background Context

### Design decisions (resolved in interview session 2026-04-22)

1. **Q1/Q2 — Section icons:** Static `UpStream` SVG for Capture sections, `DownStream` SVG for Receiver sections. Not mode-aware. Color depends on audio/video:
   - Video sections: `#F0DE01` (UG yellow)
   - Audio sections: `#00E411` (UG green)
2. **Q3 — Panel-level advanced:** A 5th "Advanced" section at panel bottom (no section icon) containing `encryption/key` + `advanced/params/params`.
3. **Q4 — Fold contents:** Max-parity. Move `codec`, `bitrate`, `fps`, `channels` *into* the fold; primary view keeps only source/device selectors.
4. **Q5 — Unfold affordance:** Separate `[advanced ▾]` pill button below primary content. Click expands inner block. Primary section `<h4>` is not interactive.
5. **Q6 — Fold state:** Ephemeral `ref<boolean>`, resets every mount. Not persisted.
6. **Q7/Q8 — Chips:** Click replaces the field entirely. Chip arrays inline in the component. A separate "clear" button per chipped field resets to `-none-`.
7. **Q9/Q10 — Encrypt key:** `props.peerId` (channel-owner's id) shown always-visible below the key input, clickable to apply.

### Wire fields exposed (all pre-existing in [config.ts](../../../src/main/devices/ultragrid/config.ts))

- `audioVideo/videoCapture/advanced/filter/params` (new UI binding)
- `audioVideo/videoReciever/advanced/postprocessor/params` (new UI binding)
- `audioVideo/audioCapture/advanced/compress/samplerate` (new UI binding)
- `audioVideo/audioReceiver/advanced/channels/params` (new UI binding)
- `audioVideo/advanced/advanced/params/params` (new UI binding)
- `audioVideo/advanced/advanced/encryption/key` (new UI binding)

### Chip arrays (verbatim from Max screenshots)

```typescript
const videoFilterChips = [
  'blank:10:10:50:20', 'flip', 'resize:1/2',
  'blank:10%:10%:3%:2%', 'grayscale', 'resize:1920x1080',
  'mirror', 'every:2', 'display:ndi'
]

const videoPostprocessChips = [
  'crop:wdith=200:height=200:xoff=20:yoff=20',
  'border:color=#ff0000:width=20==8', 'flip',
  'double_framerate:d:nodelay', 'scale:200:20',
  'resize:1920x1080', 'split:2:2', 'grayscale'
]

const audioMappingChips = [
  '0:0', '0:0, 1:0', '0:0\\,:1', '0:0,0:1', '4:0\\,5:1'
]

const advancedParamsChips = [
  'audio-buffer-len=<ms>', 'low-latency-audio[=ultra]', 'no-dither',
  'audio-cap-frames=<f>', 'disable-keyboard-control',
  'udp-queue-len=<l>', 'audio-disable-adaptive-buffer',
  'lavc-use-codec=<c>', 'stdout-buf={no|line|full}', 'use-hw-accel',
  'audioenc-frame-duration=<ms>', 'resampler-quality=[0-10]',
  'ldgm-device={CPU|GPU}', 'window-title=<title>', 'errors-fatal',
  'lavc-h264-interlaced-dct', 'gl-disable-10b',
  'glfw-window-hint=<k>=<v>[:<k2>=<v2>...]'
]
```

**Note on the strange strings:** `border:color=#ff0000:width=20==8` and `crop:wdith=...` (sic — "wdith" misspelling) are copied **verbatim** from the Max screenshots. Do not "fix" them. They are what the Max gateway ships. If they contain typos, users edit the string after clicking the chip.

### SVG paths (copy verbatim from [DeviceCell.vue](../../../src/renderer/components/DeviceCell.vue))

**UpStream** (TX, up arrow) — already at [DeviceCell.vue:109](../../../src/renderer/components/DeviceCell.vue#L109):
```
M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z
```

**DownStream** (RX, down arrow) — already at [DeviceCell.vue:115](../../../src/renderer/components/DeviceCell.vue#L115):
```
M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z
```

Both use `viewBox="0 0 200 200"` and `stroke-width="10"`. For section headings, render at `width="18" height="18"` inline-block.

---

## File Structure

**Single file modified:**
- [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue)

No new files. No test file (no renderer test harness for Vue components in this repo — see [tests/renderer/](../../../tests/renderer/) which only tests state reducers, not components).

**Verification approach:**
- `npm run typecheck` after each change.
- Manual UI test via `npm run dev` at the end (per CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser").

---

## Task 1: Add new MQTT bindings for advanced fields

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — bindings block at the top of `<script setup>`

- [ ] **Step 1: Add the six new bindings**

In [UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue), after the existing `audioChannels` binding (around line 124), add:

```typescript
const audioSamplerate = bind(
  'audioVideo/audioCapture/advanced/compress/samplerate',
  () => audioCapture.value?.advanced?.compress?.samplerate
)
```

After the existing `jackRxSel` binding (around line 143), add:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no output. The bindings are of type `{ value: ComputedRef<string>; set: (v: string | number) => void }` — TS infers this from `useMqttBinding`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: add bindings for advanced wire fields"
```

---

## Task 2: Add chip arrays and fold state refs

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — `<script setup>` after the existing reactive refs

- [ ] **Step 1: Add the chip arrays**

After the `MONITOR_LOG_CAPACITY` constant (around line 6), add:

```typescript
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
```

- [ ] **Step 2: Add fold-state refs**

After the `monitorLogBuffer` ref declaration (around line 41), add:

```typescript
const videoCaptureAdvOpen = ref(false)
const videoReceiverAdvOpen = ref(false)
const audioCaptureAdvOpen = ref(false)
const audioReceiverAdvOpen = ref(false)
const globalAdvOpen = ref(false)
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: add chip presets and advanced-fold state refs"
```

---

## Task 3: Add section-icon and helper computeds

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — after the existing computeds block

- [ ] **Step 1: Add color/icon constants**

After the `showAudio` computed added in the previous pass (around line 44), add:

```typescript
const VIDEO_COLOR = '#F0DE01'
const AUDIO_COLOR = '#00E411'

// UpStream SVG path (TX/Capture) — copied from DeviceCell.vue:109
const UPSTREAM_PATH = 'M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z'
// DownStream SVG path (RX/Receiver) — copied from DeviceCell.vue:115
const DOWNSTREAM_PATH = 'M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z'
```

- [ ] **Step 2: Add a helper for resetting chipped fields**

After the `clearMonitorLog` function (around line 52), add:

```typescript
function clearField(binding: { set: (v: string) => void }) {
  binding.set('-none-')
}

function applyChip(binding: { set: (v: string) => void }, preset: string) {
  binding.set(preset)
}
```

- [ ] **Step 3: Add peerId suggestion accessor**

After `applyChip`, add:

```typescript
function applyPeerIdAsKey() {
  encryptionKey.set(props.peerId)
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: add section-icon constants and chip/peerId helpers"
```

---

## Task 4: Update Video Capture section — icon + advanced fold

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — `<template>`, the Video Capture `<section>` block (around lines 314–381)

- [ ] **Step 1: Replace the Video Capture section entirely**

Locate the block starting with `<section v-if="showSendSide && showVideo">` and containing `<h4>Video Capture</h4>`. Replace the **entire section** (from opening `<section>` to closing `</section>`) with:

```vue
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
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: Video Capture section icon + advanced fold + filter chips"
```

---

## Task 5: Update Video Receiver section — icon + advanced fold

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — the Video Receiver `<section>` block (`<section v-if="mode === '4' && showReceiveSide && showVideo">`)

- [ ] **Step 1: Replace the Video Receiver section entirely**

Locate the block with `<h4>Video Receiver (Mode 4)</h4>`. Replace the **entire section** with:

```vue
<section v-if="mode === '4' && showReceiveSide && showVideo" class="ug-section">
  <h4>
    <svg class="section-icon" viewBox="0 0 200 200" width="18" height="18"
      stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
      <path :d="DOWNSTREAM_PATH" :fill="VIDEO_COLOR" :stroke="VIDEO_COLOR"/>
    </svg>
    Video Receiver
  </h4>
  <div class="field-row">
    <label>spout name</label>
    <input
      :value="videoRxName.value.value"
      :disabled="isLocked"
      @change="videoRxName.set(($event.target as HTMLInputElement).value)"
    />
  </div>

  <div class="advanced-row">
    <button class="advanced-pill" @click="videoReceiverAdvOpen = !videoReceiverAdvOpen">
      advanced {{ videoReceiverAdvOpen ? '▾' : '▸' }}
    </button>
  </div>

  <div v-if="videoReceiverAdvOpen" class="advanced-fold">
    <div class="field-row">
      <label>postprocess</label>
      <input
        :value="videoPostprocessParams.value.value"
        :disabled="isLocked"
        @change="videoPostprocessParams.set(($event.target as HTMLInputElement).value)"
      />
      <button class="clear-btn" :disabled="isLocked" @click="clearField(videoPostprocessParams)">clear</button>
    </div>
    <div class="chip-row">
      <button
        v-for="preset in VIDEO_POSTPROCESS_CHIPS"
        :key="preset"
        class="chip-btn"
        :disabled="isLocked"
        @click="applyChip(videoPostprocessParams, preset)"
      >{{ preset }}</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: Video Receiver section icon + postprocess fold + chips"
```

---

## Task 6: Update Audio Capture section — icon + advanced fold (no chips)

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — the Audio Capture `<section>` block

- [ ] **Step 1: Replace the Audio Capture section entirely**

Locate the block with `<h4>Audio Capture</h4>`. Replace the **entire section** with:

```vue
<section v-if="showSendSide && showAudio" class="ug-section">
  <h4>
    <svg class="section-icon" viewBox="0 0 200 200" width="18" height="18"
      stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
      <path :d="UPSTREAM_PATH" :fill="AUDIO_COLOR" :stroke="AUDIO_COLOR"/>
    </svg>
    Audio Capture
  </h4>
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

  <div class="advanced-row">
    <button class="advanced-pill" @click="audioCaptureAdvOpen = !audioCaptureAdvOpen">
      advanced {{ audioCaptureAdvOpen ? '▾' : '▸' }}
    </button>
  </div>

  <div v-if="audioCaptureAdvOpen" class="advanced-fold">
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
      <label>sample</label>
      <input
        class="port-input"
        :value="audioSamplerate.value.value"
        :disabled="isLocked"
        @change="audioSamplerate.set(($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="field-row">
      <label>channels</label>
      <input
        class="port-input"
        :value="audioChannels.value.value"
        :disabled="isLocked"
        @change="audioChannels.set(($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</section>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: Audio Capture section icon + codec/bitrate/sample/channels fold"
```

---

## Task 7: Update Audio Receiver section — icon + advanced fold + mapping chips

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — the Audio Receiver `<section>` block

- [ ] **Step 1: Replace the Audio Receiver section entirely**

Locate the block with `<h4>Audio Receiver (Mode 4)</h4>`. Replace the **entire section** with:

```vue
<section v-if="mode === '4' && showReceiveSide && showAudio" class="ug-section">
  <h4>
    <svg class="section-icon" viewBox="0 0 200 200" width="18" height="18"
      stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
      <path :d="DOWNSTREAM_PATH" :fill="AUDIO_COLOR" :stroke="AUDIO_COLOR"/>
    </svg>
    Audio Receiver
  </h4>
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

  <div class="advanced-row">
    <button class="advanced-pill" @click="audioReceiverAdvOpen = !audioReceiverAdvOpen">
      advanced {{ audioReceiverAdvOpen ? '▾' : '▸' }}
    </button>
  </div>

  <div v-if="audioReceiverAdvOpen" class="advanced-fold">
    <div class="field-row">
      <label>mapping</label>
      <input
        :value="audioMappingParams.value.value"
        :disabled="isLocked"
        @change="audioMappingParams.set(($event.target as HTMLInputElement).value)"
      />
      <button class="clear-btn" :disabled="isLocked" @click="clearField(audioMappingParams)">clear</button>
    </div>
    <div class="chip-row">
      <button
        v-for="preset in AUDIO_MAPPING_CHIPS"
        :key="preset"
        class="chip-btn"
        :disabled="isLocked"
        @click="applyChip(audioMappingParams, preset)"
      >{{ preset }}</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: Audio Receiver section icon + mapping fold + chips"
```

---

## Task 8: Add panel-level Advanced section

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — `<template>`, insert between the closing `</template>` of the mode-supported block and the existing `<section>Monitor` block

- [ ] **Step 1: Insert the Advanced section**

Find the closing `</template>` of the `<template v-else>` block that wraps modes 1 & 4 content (it comes right before the Monitor `<section>` around line 573 of the current file). The Advanced section goes *inside* the `<template v-else>` block, after the Audio Receiver section but **before** that closing `</template>`.

Insert:

```vue
<section class="ug-section">
  <h4>Advanced</h4>
  <div class="advanced-row">
    <button class="advanced-pill" @click="globalAdvOpen = !globalAdvOpen">
      advanced {{ globalAdvOpen ? '▾' : '▸' }}
    </button>
  </div>

  <div v-if="globalAdvOpen" class="advanced-fold">
    <div class="field-row">
      <label>params</label>
      <input
        :value="globalParams.value.value"
        :disabled="isLocked"
        @change="globalParams.set(($event.target as HTMLInputElement).value)"
      />
      <button class="clear-btn" :disabled="isLocked" @click="clearField(globalParams)">clear</button>
    </div>
    <div class="chip-row">
      <button
        v-for="preset in ADVANCED_PARAMS_CHIPS"
        :key="preset"
        class="chip-btn"
        :disabled="isLocked"
        @click="applyChip(globalParams, preset)"
      >{{ preset }}</button>
    </div>
    <div class="field-row">
      <label>encrypt key</label>
      <input
        :value="encryptionKey.value.value"
        :disabled="isLocked"
        @change="encryptionKey.set(($event.target as HTMLInputElement).value)"
      />
      <button class="clear-btn" :disabled="isLocked" @click="clearField(encryptionKey)">clear</button>
    </div>
    <div class="peerid-row">
      <span class="peerid-label">use peerId:</span>
      <button
        class="peerid-suggest"
        :disabled="isLocked"
        @click="applyPeerIdAsKey"
        :title="'Click to use this peerId as the encrypt key'"
      >{{ props.peerId }}</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: add panel-level Advanced section with params + encrypt key + peerId suggest"
```

---

## Task 9: Add scoped styles for new UI primitives

**Files:**
- Modify: [src/renderer/components/panels/UltraGridPanel.vue](../../../src/renderer/components/panels/UltraGridPanel.vue) — `<style scoped>` block at end of file

- [ ] **Step 1: Append styles**

At the end of the existing `<style scoped>` block (just before the closing `</style>`), add:

```css
.section-icon {
  vertical-align: middle;
  margin-right: 6px;
}
.advanced-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  margin-bottom: 4px;
}
.advanced-pill {
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid #555;
  background: #2a2a2a;
  color: #aaa;
  cursor: pointer;
  font-size: 10px;
  font-family: inherit;
  text-transform: lowercase;
}
.advanced-pill:hover {
  background: #333;
  color: #ddd;
}
.advanced-fold {
  margin-top: 4px;
  padding: 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a1a;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  margin-bottom: 2px;
}
.chip-btn {
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #444;
  background: #262626;
  color: #bbb;
  cursor: pointer;
  font-size: 10px;
  font-family: monospace;
}
.chip-btn:hover:not(:disabled) {
  background: #333;
  color: #fff;
}
.chip-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.clear-btn {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: #aaa;
  cursor: pointer;
  font-size: 10px;
}
.clear-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.peerid-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.peerid-label {
  min-width: 70px;
  font-size: 11px;
  color: #888;
}
.peerid-suggest {
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #222;
  color: #9cf;
  cursor: pointer;
  font-family: monospace;
  font-size: 11px;
  text-align: left;
}
.peerid-suggest:hover:not(:disabled) {
  background: #2a2a2a;
  color: #cef;
}
.peerid-suggest:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "ug-panel: styles for section icons, advanced pills, chips, and peerId suggest"
```

---

## Task 10: Full verification

**Files:** none modified (verification only).

- [ ] **Step 1: Run all automated checks**

```bash
npm run typecheck && npm test
```

Expected: typecheck passes; test suite passes. If any pre-existing test fails, it's unrelated to this change — note it but do not fix.

- [ ] **Step 2: Manual UI smoke test**

```bash
npm run dev
```

In the running app (per CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser"):

1. **Join the default room** with an UltraGrid device added to a channel.
2. **Section icons:** Open the UG panel. Confirm:
   - Video Capture header shows a **yellow up-arrow** SVG to the left of the text.
   - Video Receiver header (mode 4 only) shows a **yellow down-arrow** SVG.
   - Audio Capture header shows a **green up-arrow** SVG.
   - Audio Receiver header (mode 4 only) shows a **green down-arrow** SVG.
   - Advanced header shows **no icon** (it's panel-level).
3. **Advanced folds:** Each of the 5 sections has a small `[advanced ▸]` pill at the bottom. Click → fold opens, pill becomes `[advanced ▾]`. Click again → closes.
4. **Advanced fold contents:**
   - Video Capture fold shows codec/bitrate/fps/filter + 9 chip buttons + a clear button.
   - Video Receiver fold shows postprocess + 8 chip buttons + clear.
   - Audio Capture fold shows codec/bitrate/sample/channels (no chips).
   - Audio Receiver fold shows mapping + 5 chip buttons + clear.
   - Advanced fold shows params + 18 chip buttons + clear; encrypt key + clear; "use peerId:" row with the current peerId as a clickable button.
5. **Chip click:** In the Advanced fold, click the `no-dither` chip. The params field should change to exactly `no-dither`.
6. **Clear click:** Click the clear button next to the params field. The field should become `-none-`.
7. **Encrypt key → peerId:** In the Advanced fold, click the peerId suggest button. The encrypt key field should become the peerId string.
8. **Typed edit still works:** Edit the params field directly; the value should publish on blur/change.
9. **Mount resets folds:** Navigate away from the channel and back. All folds should be closed again (ephemeral state, per design Q6A).
10. **Gating regression check:** Flip `network/mode` to `2` (receive from router). Confirm Video Capture and Audio Capture sections disappear, but the Advanced section stays visible. (Mode 2 is still under the "unsupported-mode" block per prior session — the Advanced section is inside `<template v-else>` so it won't render under mode 2. That's correct: Advanced is only meaningful for supported modes.)
11. **Disabled state:** Toggle the device ON. All inputs, chip buttons, clear buttons, and the peerId suggest button should become disabled (greyed). Toggle OFF — re-enabled.

- [ ] **Step 3: If all manual checks pass, stop**

No final commit — each task already committed its piece. Plan complete.

- [ ] **Step 4: If any manual check fails**

Do NOT mark this task done. Fix the failing behavior in whichever prior task's code is responsible, re-run verification, commit the fix as a separate commit with message `fix: <what>`.

---

## Out of scope (do NOT do in this plan)

- Changes to [config.ts](../../../src/main/devices/ultragrid/config.ts) or any main-process code.
- Wiring `encryption/key` or `advanced/params/params` into the CLI builder ([cliBuilder.ts](../../../src/main/devices/ultragrid/cliBuilder.ts)) — those args are not currently assembled. That's a separate CLI-gating task.
- Unsupported-mode handling (mode 2/5/7). Still blocked as today.
- Persistent fold state across sessions.
- Chip-set editing or customization.
- "Live stream: preview" toggle from the Max screenshot (no wire topic; out of scope per Q4A).
- Automated Vue component tests — no renderer component test harness exists in this repo; adding one is out of scope.
