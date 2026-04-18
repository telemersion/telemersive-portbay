# Telemersive Gateway NG — Claude Code Context Document

Read this fully before writing any code. It captures all architectural decisions
and protocol knowledge from a prior design conversation.

---

## 1. Project Overview

Redesign of https://github.com/telemersion/telemersive-gateway — a peer-to-peer
telematic performance tool currently built in Max MSP.

**What we keep:**
- The `telemersive-bus` npm package (MQTT-based peer protocol)
- The MQTT topic schema (fully documented below)
- CLI process management for UltraGrid and NatNetThree2OSC
- The room/peer/channel/device conceptual model

**What we replace:**
- Max MSP entirely — new stack is Electron + Vue 3 + Node.js

**Related repos:**
- telemersive-bus: https://www.npmjs.com/package/telemersive-bus
- telemersive-router: runs Mosquitto MQTT broker + busManager on a public server
- UltraGrid: https://www.ultragrid.cz/ (CLI app, bundled in externals/)
- NatNetThree2OSC: https://github.com/tecartlab/app_NatNetThree2OSC (CLI app)

---

## 2. Core Architecture

```
Electron app (one instance = one peer)
├── Renderer process (Vue 3 + Vite)
│   ├── mqttState.js         — reactive peer state tree (all peers in room)
│   ├── PeerMatrix view      — the main peers × channels grid UI
│   ├── Device panels        — UltraGrid, NatNet, OSC, StageControl
│   ├── useMqttBinding.js    — composable: topic <-> reactive value + publish on set
│   └── MonitorLog / CliPreview — log streaming UI
│
└── Main process (Node.js)
    ├── mqttBridge.js        — mqtt.js client, all pub/sub, gate logic
    ├── publishGate.js       — recently-published set, loop prevention
    ├── topicParser.js       — topic string <-> path array conversion
    ├── ipc.js               — IPC bridge: state to renderer, actions from renderer
    ├── busClient.js         — telemersive-bus npm wrapper
    ├── devices/
    │   ├── deviceRouter.js  — routes topic changes to correct device handler
    │   ├── UltraGridDevice.js
    │   ├── NatNetDevice.js
    │   ├── OscDevice.js
    │   └── StageControlDevice.js
    └── system/
        ├── networkInfo.js   — local IP, public IP detection
        └── osInfo.js        — platform -> remoteValues/local_os
```

---

## 3. MQTT Protocol — Critical Details

### 3.1 Topic Schema

Every piece of state is a retained MQTT topic:

```
/peer/{peerId}/rack/page_{n}/channel.{n}/device/gui/{path/to/leaf}  ->  value
/peer/{peerId}/rack/page_{n}/channel.{n}/loaded                      ->  {channelNumber}
/peer/{peerId}/rack/page_{n}/channel.{n}/device/#                    ->  (wildcard subscription)
```

### 3.2 The Echo Pattern (CRITICAL)

Every gateway subscribes to ALL topics in the room, including its own.
This is intentional — it is the only way to know when a remote peer has changed your settings.

Flow:
1. UI user changes value
2. publish to MQTT (retain=true)
3. broker fans out to ALL subscribers (including yourself)
4. YOU receive your own message back
5. UI state updates (always)
6. execution layer fires (only if NOT in publishGate)

There is NO direct state mutation from the UI. All state changes flow through MQTT.
The UI never assumes a publish succeeded — it waits for the echo.

### 3.3 The Publish Gate

Prevents execution loops when you receive your own published messages:

```javascript
// publishGate.js
const recentlySent = new Map() // topic -> value, cleared after ~100ms

function publishWithGate(topic, value) {
  recentlySent.set(topic, value)
  mqttClient.publish(topic, String(value), { retain: true })
  setTimeout(() => recentlySent.delete(topic), 100)
}

function isGated(topic, value) {
  return recentlySent.get(topic) === String(value)
}
```

In the message handler:
```javascript
mqttClient.on('message', (topic, payload) => {
  const value = payload.toString()

  // ALWAYS: update Vue reactive state -> UI stays in sync
  setNestedValue(peerState, topicToPath(topic), value)

  // ONLY execute locally if: local peer's topic AND not gated
  if (isLocalPeerTopic(topic) && !isGated(topic, value)) {
    deviceRouter.handle(topic, value)
  }
})
```

### 3.4 Channel Initialization Sequence

When a channel loads:
1. Publish all default values (often 0) for every parameter
2. Publish actual configured values
3. Publish channel.N/loaded N as commit/sync signal
4. Subscribe to channel.N/device/# — broker replays all retained values

### 3.5 Key Topics Per Device

**Common to all devices:**
```
.../device/gui/description          -> device type label: "OSC", "ultragrid", "MoCap"
.../device/gui/enable               -> 0 or 1
.../device/gui/indicators           -> space-separated values e.g. "0 0 0"
.../device/gui/monitor/monitorGate  -> 0 or 1 (open/close log stream)
.../device/gui/monitor/log          -> log line string (NOT retained)
.../device/gui/remoteValues/local_os -> "osx" | "win" | "linux"
.../device/gui/print_cli            -> assembled CLI command string
.../channel.N/loaded                -> N (channel number, sync signal)
```

**OSC / localudp device:**
```
.../device/gui/localudp/inputPort
.../device/gui/localudp/outputPortOne
.../device/gui/localudp/outputPortTwo
.../device/gui/localudp/outputIPOne
.../device/gui/localudp/outputIPTwo
.../device/gui/localudp/peerLocalIP
.../device/gui/localudp/enableTwo   -> 0 or 1 (enable second output)
.../device/gui/localudp/reset       -> 0 then 1 (trigger)
.../device/gui/inputIndicator       -> 0 or 1
.../device/gui/outputIndicator      -> 0 or 1
```

**UltraGrid device:**
```
.../device/gui/audioVideo/connection     -> 0=TX, 1=RX, 2=both
.../device/gui/audioVideo/transmission  -> 0=video, 1=audio, 2=video+audio
.../device/gui/network/mode             -> enum (see Section 4.8)
.../device/gui/network/holepuncher/stunServer  -> "stun4.l.google.com:19302"
.../device/gui/network/local/customSending     -> "0.0.0.0:11022"
.../device/gui/network/ports/receiveChannel    -> 0
.../device/gui/network/ports/alternativeChannel -> 0
.../device/gui/audioVideo/videoCapture/type    -> 0=syphon/texture, 1=ndi, 2=custom
.../device/gui/audioVideo/videoCapture/ndi/menu/selection
.../device/gui/audioVideo/videoCapture/texture/menu/selection
.../device/gui/audioVideo/videoCapture/advanced/compress/codec
.../device/gui/audioVideo/videoCapture/advanced/compress/bitrate
.../device/gui/audioVideo/videoCapture/advanced/texture/fps
.../device/gui/audioVideo/videoCapture/advanced/filter/params
.../device/gui/audioVideo/videoCapture/custom/customFlags/flags
.../device/gui/audioVideo/videoReciever/type   -> 0=syphon/texture, 1=ndi, 2=custom
.../device/gui/audioVideo/videoReciever/texture/name
.../device/gui/audioVideo/videoReciever/texture/closedWindow
.../device/gui/audioVideo/videoReciever/ndi/name
.../device/gui/audioVideo/videoReciever/advanced/postprocessor/params
.../device/gui/audioVideo/audioCapture/type    -> 0=portaudio,1=coreaudio,2=wasapi,3=jack,4=testcard,5=custom
.../device/gui/audioVideo/audioCapture/portaudio/menu/selection
.../device/gui/audioVideo/audioCapture/coreaudio/menu/selection
.../device/gui/audioVideo/audioCapture/wasapi/menu/selection
.../device/gui/audioVideo/audioCapture/jack/menu/selection
.../device/gui/audioVideo/audioCapture/testcard/frequency
.../device/gui/audioVideo/audioCapture/testcard/volume
.../device/gui/audioVideo/audioCapture/advanced/compress/codec
.../device/gui/audioVideo/audioCapture/advanced/compress/bitrate
.../device/gui/audioVideo/audioCapture/advanced/compress/samplerate
.../device/gui/audioVideo/audioCapture/advanced/channels/channels
.../device/gui/audioVideo/audioReceiver/type
.../device/gui/audioVideo/audioReceiver/portaudio/menu/selection
.../device/gui/audioVideo/audioReceiver/coreaudio/menu/selection
.../device/gui/audioVideo/audioReceiver/wasapi/menu/selection
.../device/gui/audioVideo/audioReceiver/jack/menu/selection
.../device/gui/audioVideo/audioReceiver/advanced/channels/params
.../device/gui/audioVideo/advanced/custom/customFlags/flags
.../device/gui/audioVideo/advanced/advanced/params/params
.../device/gui/audioVideo/advanced/advanced/encryption/key
.../device/gui/updateMenu  -> "{component} {type}" e.g. "audioCapture jack"
                               triggers CLI query to populate device menus
```

**NatNet/MoCap device:**
```
.../device/gui/direction/enableNatNet -> 0 or 1
.../device/gui/direction/select       -> 0, 1, or 2
.../device/gui/natnet/motiveIP
.../device/gui/natnet/multicastIP     -> "239.255.42.99"
.../device/gui/natnet/cmdPort         -> 1510
.../device/gui/natnet/dataPort        -> 1511
.../device/gui/natnet/codec           -> 0,1,2,3
.../device/gui/natnet/frameModulo     -> 1
.../device/gui/natnet/autoReconnect
.../device/gui/natnet/bundled
.../device/gui/natnet/leftHanded
.../device/gui/natnet/matrix
.../device/gui/natnet/invmatrix
.../device/gui/natnet/yUp2zUp
.../device/gui/natnet/verbose
.../device/gui/natnet/sendSkeletons
.../device/gui/natnet/sendMarkerInfos
.../device/gui/natnet/sendOtherMarkerInfos
.../device/gui/natnet/defaultLocalIP
.../device/gui/localudp/inputPort
.../device/gui/localudp/listeningIP
.../device/gui/localudp/outputIPOne
.../device/gui/localudp/outputIPTwo
.../device/gui/localudp/outputPortOne
.../device/gui/localudp/outputPortTwo
.../device/gui/localudp/reset
.../device/gui/enableTwo             -> 0 or 1
.../device/gui/indicators            -> "0 0 0" (3 space-separated values)
```

---

## 4. UI Specification

### 4.1 Matrix Layout

- Header row: roomName (colored pill), localIP, publicIP, roomID, peerID
- Column headers: fixed "channel.0" through "channel.19" (no user-defined names)
  NOTE: description field is per-device not per-column
- Peer rows: local peer first (with collapse, lock, locate buttons), then remote peers
- Default view: ~10 channels, expandable to all 20

### 4.2 Peer Row Colors

Each peer sets their own color via MQTT (exact topic TBD — check telemersive-bus source).
Usage:
- Row background: dark tinted version of peer color
- Left border: 2px, full saturation
- Cell borders: low opacity version
- Text: light tinted version

### 4.3 Device Cell Rendering

Each occupied cell:
- Device box (36x36px, border-radius 6px): colored background + SVG icon
- Device label (9px): description string
- + button on hover (top-right corner badge)
- Stopped state: opacity 0.28 on box + faded label

Each empty cell:
- Centered + icon (low opacity, full on hover)
- Clicking opens add-device popup

Locked peer cells: no + affordance, cursor:default

### 4.4 Device Type Colors

From original Max HSB patcher, converted to RGB hex:

```javascript
export const DEVICE_COLORS = {
  osc:           { on: '#36ABFF', off: '#0A00DE' },
  mocap:         { on: '#FFA126', off: '#B20009' },
  ug_video:      { on: '#F0DE01', off: '#826B1A', iconFill: '#665800' },
  ug_audio:      { on: '#00E411', off: '#006B0A', iconFill: '#003308' },
  ug_videoaudio: { on: '#1BFEE9', off: '#668700', iconFill: '#006655' },
  stagecontrol:  { on: '#FE5FF5', off: '#78732D' },
}

// UltraGrid subtype from audioVideo/transmission:
// 0 -> ug_video, 1 -> ug_audio, 2 -> ug_videoaudio
```

### 4.5 SVG Icon Paths (viewBox "0 0 200 200")

Ground/platform base (all icons that touch the local machine include this):
```
GROUND = "m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z"
```

Arrow paths (combine with GROUND for full icon):
```javascript
export const ICON_PATHS = {
  UpStream:        "M 119.98763,149.94015 118.84557,59.940148 H 99.416606 l 29.999994,-40 30,40 h -20.57103 l 1.14206,90.000002 z",
  DownStream:      "m 80.01231,19.999998 1.14206,90.059852 h 19.42897 l -30,39.94015 -30,-39.94015 H 61.15437 L 60.01231,19.999998 Z",
  ToServer:        "M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z",
  FromServer:      "M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z",
  ToPeerTX:        "M 89.470833,51.467598 149.47083,51.72248 V 31.467598 l 40,30 -40,30 V 71.722479 l -40,-0.254881 v 69.930342 l -19.999997,0.13928 z",
  ToPeerRX:        "m 90.045214,51.309795 0.25488,59.999995 H 70.045216 l 29.999984,40 30,-40 H 110.30008 L 110.0452,71.309795 h 69.93036 l 0.13928,-20 z",
  ToLocal:         "m 90,60 60,0.254882 V 40 l 40,30 -40,30 V 80.254881 L 110,80 v 69.93036 l -20,0.13928 z",
  FromLocal:       "m 144.15955,60.595724 v 49.999996 h 20 l -30,39.94015 -30,-39.94015 h 20 V 80.595724 l -51.997483,0.393303 0.0838,70.085463 -22.350659,0.20395 0.09425,-90.602178 z",
  UpLocal:         "m 110,60 40,0.254882 V 40 l 40,30 -40,30 V 80.254881 L 130,80 v 69.93036 l -20,0.13928 z",
  DownLocal:       "m 69.326146,92.99619 v 31.94097 H 82.098857 L 62.93979,150.4517 43.780725,124.93716 h 12.77271 V 105.77258 H 31.05249 L 30.96354,92.996191 Z",
  UpStreamMinor:   "m 135.74171,150.16519 -0.56693,-44.85035 h -9.64464 l 14.89216,-19.933489 14.89216,19.933489 h -10.21157 l 0.56692,44.85035 z",
  DownStreamMinor: "m 64.332575,85.396692 0.56301,44.571838 h 9.5779 l -14.7891,19.76692 -14.7891,-19.76692 h 10.1409 l -0.563,-44.571838 z",
  Sink:            "m 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z",
  // ToPeerRXTX uses scale(0.26458333) transform — handle separately
  ToPeerRXTX_raw:  "m 564.92969,118.93359 v 76.55274 L 338.1582,194.52344 v 226.53515 l 75.58985,-0.52539 V 270.11328 l 151.18164,0.96289 v 74.62891 L 716.10938,232.31836 Z M 338.1582,421.05859 H 261.60352 L 374.99023,572.24023 488.375,421.05859 h -74.62695 z",
}
```

### 4.6 Add Device Popup

Clicking + on any cell of an unlocked peer shows:
```
add to {peerName} ch.{N}
... osc device
... ultragrid device
... natnet2OSC device
```
Available from any peer to any unlocked peer (full remote control).
Dismiss by clicking outside.

### 4.7 Breadcrumb in Device Panels

```
{roomName} > {peerName} > {deviceDescription} > channel {N}
```
Assembled from separate state values, not from the topic path.

### 4.8 UltraGrid Panel — Conditional Rendering

network/mode enum (VERIFY from Max source):
- 0 = send to router
- 1 = receive from router
- 2 = peer to peer (automatic)  <- adds stun url field
- 3 = peer to peer (manual)     <- adds send-to IP field
- 4 = capture to local          <- video only, no audio sections
- 5 = (check — may be another mode)

connection enum: 0=TX, 1=RX, 2=both
transmission enum: 0=video, 1=audio, 2=video+audio

Section visibility:
- TX video:  hasTX && hasVideo && mode != receiveFromRouter
- TX audio:  hasTX && hasAudio && mode != receiveFromRouter && mode != captureToLocal
- RX video:  hasRX && hasVideo && mode != sendToRouter
- RX audio:  hasRX && hasAudio && mode != sendToRouter && mode != captureToLocal

Each section has: type dropdown + advanced device dropdown + reset/clear buttons.

---

## 5. Vue Patterns

### 5.1 useMqttBinding

```javascript
export function useMqttBinding(topic) {
  const value = computed(() => getNestedValue(mqttState, topicToPath(topic)))
  const set = (val) => {
    window.ipcRenderer.invoke('mqtt:publish', { topic, value: String(val), retain: true })
  }
  return { value, set }
}
```

All device panel widgets use this. No direct state mutation ever.

### 5.2 State tree update from IPC

```javascript
ipcRenderer.on('mqtt:message', (_, { topic, value }) => {
  setNestedValue(peerState, topicToPath(topic), value)
})
```

### 5.3 Topic utilities

```javascript
const topicToPath = (topic) => topic.replace(/^\//, '').split('/')
const pathToTopic = (path) => '/' + path.join('/')
```

---

## 6. CLI Process Management

stdout/stderr piped to MQTT monitor/log topic (not retained):

```javascript
proc.stdout.on('data', (data) => {
  mqttClient.publish(
    `/peer/${localPeerId}/rack/page_0/channel.${ch}/device/gui/monitor/log`,
    data.toString(),
    { retain: false }
  )
})
```

Externals location:
```
externals/ultragrid/uv-qt           (macOS binary)
externals/ultragrid/uv-qt.exe       (Windows)
externals/natnet/NatNetThree2OSC    (macOS)
externals/natnet/NatNetThree2OSC.exe
```

---

## 7. Open Questions (Resolve Before Implementing)

1. Exact MQTT topic for peer color and peer human-readable name
2. Exact enum values for network/mode, connection, transmission
3. Login/authentication flow with telemersive-router
4. StageControl device — needs more investigation
5. Device panel open mechanism — modal, drawer, or inline expanded row?
6. TypeScript vs JavaScript?
7. Full updateMenu CLI command mapping per component type
8. Lock state MQTT topic location

---

## 8. Recommended Build Order

1. Scaffold with electron-vite (Vue template)
2. mqttBridge + publishGate + topicParser (main process)
3. IPC bridge
4. mqttState + useMqttBinding (renderer)
5. PeerMatrix + ChannelCell (display only, no panels)
6. OSC device panel (simplest — validates full stack)
7. UltraGrid device panel (most complex)
8. NatNet device panel
9. UltraGridDevice.js execution layer (child_process)
10. NatNetDevice.js execution layer
11. Login flow
12. StageControl device

```bash
npm create electron-vite@latest telemersive-gateway-ng
cd telemersive-gateway-ng
npm install mqtt telemersive-bus
cp CLAUDE_CONTEXT.md telemersive-gateway-ng/
```