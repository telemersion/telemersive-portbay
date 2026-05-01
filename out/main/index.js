"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const events = require("events");
const dgram = require("dgram");
const dns = require("dns");
const util = require("util");
const child_process = require("child_process");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const dgram__namespace = /* @__PURE__ */ _interopNamespaceDefault(dgram);
const dns__namespace = /* @__PURE__ */ _interopNamespaceDefault(dns);
const BUFFER_CAP = 500;
const buffer = [];
let seq = 0;
let sink = null;
function setLogSink(win) {
  sink = win;
}
function logEvent(ev) {
  const entry = { seq: ++seq, ts: Date.now(), ...ev };
  buffer.push(entry);
  if (buffer.length > BUFFER_CAP) buffer.shift();
  if (sink && !sink.isDestroyed()) {
    sink.webContents.send("log:entry", entry);
  }
}
function getLogBuffer() {
  return buffer.slice();
}
function clearLogBuffer() {
  buffer.length = 0;
}
const APPVERSION = "TeGateway_v0612";
let BusClientClass;
try {
  const telemersion = require("telemersive-bus");
  BusClientClass = telemersion.BusClient;
} catch (err) {
  console.error("Failed to load telemersive-bus:", err);
}
class TBusClient extends events.EventEmitter {
  client;
  constructor() {
    super();
    if (!BusClientClass) {
      throw new Error("telemersive-bus module not available");
    }
    this.client = new BusClientClass(APPVERSION);
    this.client.setCallback((message, content) => {
      this.handleCallback(message, content);
    });
  }
  get peerId() {
    return this.client.peerId;
  }
  async init() {
    return this.client.init();
  }
  configure(config) {
    const brokerUrl = "mqtt://" + config.host;
    this.client.configureServer(brokerUrl, config.port, config.username, config.password, config.localIP);
  }
  connect() {
    this.client.connectServer();
  }
  disconnect() {
    this.client.disconnectServer();
  }
  join(peerName, roomName2, roomPwd) {
    this.client.join(peerName, roomName2, roomPwd);
  }
  leave() {
    this.client.leave();
  }
  publish(retained, topic, ...values) {
    this.client.peer.mqttClient.publish(retained, topic, values);
  }
  subscribe(topic) {
    this.client.peer.mqttClient.subscribe(topic);
    logEvent({ kind: "sub", topic });
  }
  unsubscribe(topic) {
    this.client.peer.mqttClient.unsubscribe(topic);
    logEvent({ kind: "unsub", topic });
  }
  handleCallback(message, content) {
    if (message === "bus") {
      this.parseBusEvent(content);
    } else if (message === "mqtt") {
      const [topic, ...rest] = content;
      const payload = rest.join(" ");
      logEvent({ kind: "recv", topic, value: payload });
      this.emit("mqtt:message", { topic, payload });
    } else if (message === "chat") {
      this.emit("chat", content);
    }
  }
  parseBusEvent(content) {
    if (content.length === 0) return;
    const c = content;
    if (c[0] === "broker" && c[1] === "connected") {
      this.emit("broker:connected", c[2] === 1);
      return;
    }
    if (c[0] === "peer") {
      switch (c[1]) {
        case "joined":
          this.emit("peer:joined", c[2] === 1);
          break;
        case "id":
          this.emit("peer:id", String(c[2]));
          break;
        case "name":
          this.emit("peer:name", String(c[2]));
          break;
        case "localIP":
          this.emit("peer:localIP", String(c[2]));
          break;
        case "publicIP":
          this.emit("peer:publicIP", String(c[2]));
          break;
        case "room":
          if (c[2] === "name") this.emit("peer:room:name", String(c[3]));
          else if (c[2] === "id") this.emit("peer:room:id", Number(c[3]));
          else if (c[2] === "uuid") this.emit("peer:room:uuid", String(c[3]));
          break;
      }
      return;
    }
    if (c[0] === "peers") {
      if (c[1] === "remote") {
        if (c[2] === "joined") {
          const info = {
            peerName: String(c[3]),
            peerId: String(c[4]),
            localIP: String(c[5]),
            publicIP: String(c[6])
          };
          this.emit("peers:remote:joined", info);
        } else if (c[2] === "left") {
          this.emit("peers:remote:left", { peerName: String(c[3]), peerId: String(c[4]) });
        }
      } else if (c[1] === "menu") {
        if (c[2] === "clear") this.emit("peers:clear");
        else if (c[2] === "append") {
          const info = {
            peerName: String(c[3]),
            peerId: String(c[4]),
            localIP: String(c[5]),
            publicIP: String(c[6])
          };
          this.emit("peers:append", info);
        }
      } else if (c[1] === "done") {
        this.emit("peers:done");
      }
      return;
    }
    if (c[0] === "rooms") {
      if (c[1] === "menu") {
        if (c[2] === "clear") this.emit("rooms:clear");
        else if (c[2] === "append") this.emit("rooms:append", String(c[3]));
      } else if (c[1] === "listing") {
        this.emit("rooms:listing", c.length > 2 ? String(c[2]) : null);
      } else if (c[1] === "done") {
        this.emit("rooms:done");
      }
      return;
    }
    if (c[0] === "ready") {
      this.emit("ready");
      return;
    }
  }
}
const DEFAULTS = {
  peerName: "",
  peerColor: "",
  brokerUrl: "telemersion.zhdk.ch",
  brokerPort: 3883,
  brokerUser: "peer",
  brokerPwd: "telemersion2021",
  lastRoomName: "",
  lastRoomPwd: "",
  panelRowHeight: 320,
  settingsVersion: 1,
  appVersion: "",
  ugPath: "",
  natnetOscPath: "",
  lastCompatCheckAt: null
};
function settingsPath() {
  return path.join(electron.app.getPath("userData"), "settings.json");
}
function loadSettings() {
  const path2 = settingsPath();
  if (!fs.existsSync(path2)) return { ...DEFAULTS };
  try {
    const raw = fs.readFileSync(path2, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings(settings) {
  const path2 = settingsPath();
  fs.writeFileSync(path2, JSON.stringify(settings, null, 2), "utf-8");
}
function isRackEligibleTail(tail) {
  if (tail.startsWith("settings/localMenus/")) return false;
  if (tail.startsWith("settings/localProps/")) return false;
  return true;
}
function buildRackSnapshot(retainedTopics2, peerId) {
  if (!peerId) return {};
  const prefix = `/peer/${peerId}/`;
  const snap = {};
  for (const [topic, value] of retainedTopics2) {
    if (!topic.startsWith(prefix)) continue;
    const tail = topic.slice(prefix.length);
    if (!isRackEligibleTail(tail)) continue;
    snap[tail] = value;
  }
  return snap;
}
function rackPath() {
  return path.join(electron.app.getPath("userData"), "rack.json");
}
function loadRack() {
  const path2 = rackPath();
  if (!fs.existsSync(path2)) return {};
  try {
    const raw = fs.readFileSync(path2, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveRack(snapshot) {
  const path2 = rackPath();
  fs.writeFileSync(path2, JSON.stringify(snapshot, null, 2), "utf-8");
}
const topics = {
  channelLoaded(peerId, channel) {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/loaded`;
  },
  deviceGui(peerId, channel, field) {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/${field}`;
  },
  localudp(peerId, channel, field) {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/localudp/${field}`;
  },
  monitor(peerId, channel, field) {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/gui/monitor/${field}`;
  },
  settings(peerId, subpath) {
    return `/peer/${peerId}/settings/${subpath}`;
  },
  deviceSubscribe(peerId, channel) {
    return `/peer/${peerId}/rack/page_0/channel.${channel}/device/#`;
  },
  loadedSubscribe(peerId) {
    return `/peer/${peerId}/rack/+/+/loaded`;
  },
  settingsSubscribe(peerId) {
    return `/peer/${peerId}/settings/#`;
  }
};
const CHANNEL_RE = /^\/peer\/([^/]+)\/rack\/page_0\/channel\.(\d+)\/(.+)$/;
const SETTINGS_RE = /^\/peer\/([^/]+)\/settings\/(.+)$/;
function parseTopic(topic) {
  let match = CHANNEL_RE.exec(topic);
  if (match) {
    const peerId = match[1];
    const channelIndex = parseInt(match[2], 10);
    const rest = match[3];
    if (rest === "loaded") {
      return { peerId, type: "loaded", channelIndex, value: void 0 };
    }
    if (rest.startsWith("device/")) {
      return { peerId, type: "device", channelIndex, subpath: rest.slice("device/".length) };
    }
    return null;
  }
  match = SETTINGS_RE.exec(topic);
  if (match) {
    return { peerId: match[1], type: "settings", subpath: match[2] };
  }
  return null;
}
const BACKEND_TOPIC_TAIL = {
  textureCapture: "localMenus/textureCaptureRange",
  ndi: "localMenus/ndiRange",
  portaudioCapture: "localMenus/portaudioCaptureRange",
  portaudioReceive: "localMenus/portaudioReceiveRange",
  coreaudioCapture: "localMenus/coreaudioCaptureRange",
  coreaudioReceive: "localMenus/coreaudioReceiveRange",
  wasapiCapture: "localMenus/wasapiCaptureRange",
  wasapiReceive: "localMenus/wasapiReceiveRange",
  jackCapture: "localMenus/jackCaptureRange",
  jackReceive: "localMenus/jackReceiveRange"
};
const BACKEND_FALLBACK = {
  textureCapture: "-default-",
  ndi: "-default-",
  portaudioCapture: "0",
  portaudioReceive: "0",
  coreaudioCapture: "0",
  coreaudioReceive: "0",
  wasapiCapture: "0",
  wasapiReceive: "0",
  jackCapture: "0",
  jackReceive: "0"
};
const UG_REFRESH_TAIL = {
  textureCapture: "localProps/ug_refresh_textureCapture",
  ndi: "localProps/ug_refresh_ndi",
  portaudioCapture: "localProps/ug_refresh_portaudioCapture",
  portaudioReceive: "localProps/ug_refresh_portaudioReceive",
  coreaudioCapture: "localProps/ug_refresh_coreaudioCapture",
  coreaudioReceive: "localProps/ug_refresh_coreaudioReceive",
  wasapiCapture: "localProps/ug_refresh_wasapiCapture",
  wasapiReceive: "localProps/ug_refresh_wasapiReceive",
  jackCapture: "localProps/ug_refresh_jackCapture",
  jackReceive: "localProps/ug_refresh_jackReceive"
};
const REFRESH_TAIL_TO_BACKEND = Object.fromEntries(
  Object.entries(UG_REFRESH_TAIL).map(([b, tail]) => [tail, b])
);
function backendTopic(peerId, backend) {
  return topics.settings(peerId, BACKEND_TOPIC_TAIL[backend]);
}
function backendFallback(backend) {
  return BACKEND_FALLBACK[backend];
}
function ugEnableTopic(peerId) {
  return topics.settings(peerId, "localProps/ug_enable");
}
function backendFromRefreshTopic(peerId, topic) {
  const parsed = parseTopic(topic);
  if (!parsed || parsed.type !== "settings") return null;
  if (parsed.peerId !== peerId) return null;
  return REFRESH_TAIL_TO_BACKEND[parsed.subpath] ?? null;
}
function applicableBackends() {
  const all = [
    "textureCapture",
    "ndi",
    "portaudioCapture",
    "portaudioReceive"
  ];
  if (process.platform === "darwin") {
    all.push("coreaudioCapture", "coreaudioReceive");
  }
  if (process.platform === "linux") {
    all.push("jackCapture", "jackReceive");
  }
  if (process.platform === "win32") {
    all.push("wasapiCapture", "wasapiReceive");
  }
  return all;
}
class DeviceRouter {
  handlers = /* @__PURE__ */ new Map();
  ownPeerId;
  bus;
  handlerFactory;
  publish;
  constructor(bus2, ownPeerId, handlerFactory, publish) {
    this.bus = bus2;
    this.ownPeerId = ownPeerId;
    this.handlerFactory = handlerFactory;
    this.publish = publish;
  }
  onMqttMessage(topic, value) {
    const parsed = parseTopic(topic);
    if (!parsed) return;
    if (parsed.peerId !== this.ownPeerId) return;
    if (parsed.type === "loaded") {
      this.handleLoaded(parsed.channelIndex, parseInt(value, 10) || 0);
    } else if (parsed.type === "device") {
      const handler = this.handlers.get(parsed.channelIndex);
      if (handler) {
        handler.onTopicChanged(parsed.subpath, value);
      }
    }
  }
  handleLoaded(channel, deviceType) {
    const existing = this.handlers.get(channel);
    if (deviceType === 0) {
      if (existing) {
        this.unloadChannel(channel);
      }
      return;
    }
    if (existing) {
      if (existing.deviceType === deviceType) return;
      this.unloadChannel(channel);
    }
    const handler = this.handlerFactory(deviceType, channel);
    if (!handler) return;
    this.handlers.set(channel, handler);
    handler.publishDefaults();
    this.bus.subscribe(topics.deviceSubscribe(this.ownPeerId, channel));
  }
  unloadChannel(channel) {
    const handler = this.handlers.get(channel);
    if (!handler) return;
    this.bus.unsubscribe(topics.deviceSubscribe(this.ownPeerId, channel));
    const publishedTopics = handler.teardown();
    for (const t of publishedTopics) {
      this.publish(1, t, "");
    }
    handler.destroy();
    this.handlers.delete(channel);
  }
  destroyAll() {
    for (const channel of [...this.handlers.keys()]) {
      this.unloadChannel(channel);
    }
  }
}
const LOCAL_PREFIX = 10;
function portBase(prefix, channelIndex) {
  return prefix * 1e3 + channelIndex * 10;
}
function allocateLocalPorts(channelIndex) {
  const base = portBase(LOCAL_PREFIX, channelIndex);
  return {
    outputPortOne: base + 8,
    outputPortTwo: base + 7,
    inputPort: base + 9
  };
}
function allocateRoomPorts(roomId2, channelIndex) {
  const base = portBase(roomId2, channelIndex);
  return {
    outputPortOne: base + 8,
    outputPortTwo: base + 7,
    inputPort: base + 9
  };
}
function allocateUgPorts(roomId2, channelIndex) {
  const base = portBase(roomId2, channelIndex);
  return {
    videoPort: base + 2,
    audioPort: base + 4
  };
}
function allocateUgRxPorts(roomId2, channelIndex) {
  const base = portBase(roomId2, channelIndex);
  return {
    videoPort: base + 6,
    audioPort: base + 8
  };
}
function allocateStageControlPort(roomId2) {
  return roomId2 * 1e3 + 902;
}
function allocateMocapLocalPorts(channelIndex) {
  const base = portBase(LOCAL_PREFIX, channelIndex);
  return {
    outputPort: base + 0,
    inputPort: base + 1
  };
}
function allocateMocapRoomPorts(roomId2, channelIndex) {
  const base = portBase(roomId2, channelIndex);
  return {
    outputPort: base + 0,
    inputPort: base + 1
  };
}
const dnsLookup$1 = util.promisify(dns__namespace.lookup);
const HEARTBEAT$1 = Buffer.from([47, 104, 98, 0, 44, 0, 0, 0]);
const HEARTBEAT_INTERVAL_MS$1 = 5e3;
class OscDevice {
  channelIndex;
  deviceType;
  peerId;
  localIP;
  brokerHost;
  localPorts;
  roomPorts;
  stageControlPort;
  publishedTopics = [];
  publish;
  hasRetained;
  enabled = false;
  enableTwo = false;
  outputIPOne;
  outputIPTwo;
  // Single UDP socket per device, bound on local inputPort.
  // - Receives from local OSC app → forwards to proxy (room port)
  // - Receives from proxy (after it learns our src tuple on first send) → forwards to local outputPort(s)
  socket = null;
  proxyIP = null;
  heartbeatTimer = null;
  _isRunning = false;
  get isRunning() {
    return this._isRunning;
  }
  // Indicator debouncing: publish '1' on first packet in a window, '0' after silence.
  inputIndicatorOn = false;
  outputIndicatorOn = false;
  inputIndicatorTimer = null;
  outputIndicatorTimer = null;
  static INDICATOR_HOLD_MS = 150;
  constructor(channelIndex, peerId, localIP2, roomId2, publish, deviceType = 1, hasRetained = () => false, brokerHost = "telemersion.zhdk.ch") {
    this.channelIndex = channelIndex;
    this.deviceType = deviceType;
    this.peerId = peerId;
    this.localIP = localIP2;
    this.brokerHost = brokerHost;
    this.localPorts = allocateLocalPorts(channelIndex);
    this.roomPorts = allocateRoomPorts(roomId2, channelIndex);
    this.stageControlPort = allocateStageControlPort(roomId2);
    this.publish = publish;
    this.hasRetained = hasRetained;
    this.outputIPOne = localIP2;
    this.outputIPTwo = localIP2;
  }
  roomDestPort() {
    return this.deviceType === 4 ? this.stageControlPort : this.roomPorts.inputPort;
  }
  publishDefaults() {
    this.emitDefaults(false);
  }
  emitDefaults(force) {
    const pub = (field, value) => {
      const topic = this.isLocaludp(field) ? topics.localudp(this.peerId, this.channelIndex, field) : this.isMonitor(field) ? topics.monitor(this.peerId, this.channelIndex, field) : topics.deviceGui(this.peerId, this.channelIndex, field);
      this.publishedTopics.push(topic);
      if (!force && this.hasRetained(topic)) return;
      this.publish(1, topic, value);
    };
    pub("peerLocalIP", this.localIP);
    pub("enableTwo", "0");
    pub("inputPort", String(this.localPorts.inputPort));
    pub("outputIPOne", this.localIP);
    pub("outputIPTwo", this.localIP);
    pub("outputPortOne", String(this.localPorts.outputPortOne));
    pub("outputPortTwo", String(this.localPorts.outputPortTwo));
    pub("reset", "0");
    pub("log", "0");
    pub("monitorGate", "0");
    pub("description", this.deviceType === 4 ? "StageC" : "OSC");
    pub("enable", "0");
    pub("inputIndicator", "0");
    pub("outputIndicator", "0");
  }
  isLocaludp(field) {
    return [
      "peerLocalIP",
      "enableTwo",
      "inputPort",
      "outputIPOne",
      "outputIPTwo",
      "outputPortOne",
      "outputPortTwo",
      "reset"
    ].includes(field);
  }
  isMonitor(field) {
    return ["log", "monitorGate"].includes(field);
  }
  onTopicChanged(subpath, value) {
    switch (subpath) {
      case "gui/enable":
        this.handleEnable(value === "1");
        break;
      case "gui/localudp/outputIPOne":
        if (value && value !== "0") this.outputIPOne = value;
        break;
      case "gui/localudp/outputIPTwo":
        if (value && value !== "0") this.outputIPTwo = value;
        break;
      case "gui/localudp/enableTwo":
        this.enableTwo = value === "1";
        break;
      case "gui/localudp/outputPortOne":
        this.localPorts.outputPortOne = parseInt(value, 10) || this.localPorts.outputPortOne;
        break;
      case "gui/localudp/outputPortTwo":
        this.localPorts.outputPortTwo = parseInt(value, 10) || this.localPorts.outputPortTwo;
        break;
      case "gui/localudp/inputPort":
        this.localPorts.inputPort = parseInt(value, 10) || this.localPorts.inputPort;
        break;
      case "gui/localudp/reset":
        if (value === "1" && !this.enabled) {
          this.resetToDefaults();
        }
        break;
    }
  }
  resetToDefaults() {
    this.localPorts = allocateLocalPorts(this.channelIndex);
    this.outputIPOne = this.localIP;
    this.outputIPTwo = this.localIP;
    this.enableTwo = false;
    this.emitDefaults(true);
  }
  handleEnable(enable) {
    if (enable && !this.enabled) {
      this.enabled = true;
      void this.startRelay();
    } else if (!enable && this.enabled) {
      this.enabled = false;
      this.stopRelay();
    }
  }
  async startRelay() {
    try {
      const { address } = await dnsLookup$1(this.brokerHost, { family: 4 });
      this.proxyIP = address;
    } catch (err) {
      console.error(`[OSC ch.${this.channelIndex}] DNS lookup failed for ${this.brokerHost}:`, err.message);
      this.disableOnError();
      return;
    }
    if (!this.enabled) return;
    try {
      this.socket = dgram__namespace.createSocket({ type: "udp4", reuseAddr: true });
      this.socket.on("message", (msg, rinfo) => {
        if (rinfo.address === this.proxyIP) {
          this.pulseOutputIndicator();
          this.socket.send(msg, 0, msg.length, this.localPorts.outputPortOne, this.outputIPOne);
          if (this.enableTwo) {
            this.socket.send(msg, 0, msg.length, this.localPorts.outputPortTwo, this.outputIPTwo);
          }
        } else {
          this.pulseInputIndicator();
          this.socket.send(msg, 0, msg.length, this.roomDestPort(), this.proxyIP);
        }
      });
      this.socket.on("error", (err) => {
        console.error(`[OSC ch.${this.channelIndex}] socket error:`, err.message);
        this.disableOnError();
      });
      this.socket.bind(this.localPorts.inputPort, this.localIP, () => {
        this._isRunning = true;
        console.log(`[OSC ch.${this.channelIndex}] relay up — local in:${this.localPorts.inputPort} out:${this.localPorts.outputPortOne} → proxy ${this.proxyIP}:${this.roomDestPort()}`);
        this.sendHeartbeat();
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS$1);
      });
    } catch (err) {
      console.error(`[OSC ch.${this.channelIndex}] failed to start relay:`, err.message);
      this.disableOnError();
    }
  }
  pulseInputIndicator() {
    if (!this.inputIndicatorOn) {
      this.inputIndicatorOn = true;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "inputIndicator"), "1");
    }
    if (this.inputIndicatorTimer) clearTimeout(this.inputIndicatorTimer);
    this.inputIndicatorTimer = setTimeout(() => {
      this.inputIndicatorOn = false;
      this.inputIndicatorTimer = null;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "inputIndicator"), "0");
    }, OscDevice.INDICATOR_HOLD_MS);
  }
  pulseOutputIndicator() {
    if (!this.outputIndicatorOn) {
      this.outputIndicatorOn = true;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "outputIndicator"), "1");
    }
    if (this.outputIndicatorTimer) clearTimeout(this.outputIndicatorTimer);
    this.outputIndicatorTimer = setTimeout(() => {
      this.outputIndicatorOn = false;
      this.outputIndicatorTimer = null;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "outputIndicator"), "0");
    }, OscDevice.INDICATOR_HOLD_MS);
  }
  disableOnError() {
    this.stopRelay();
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "enable"), "0");
  }
  sendHeartbeat() {
    if (!this.socket || !this.proxyIP) return;
    this.socket.send(HEARTBEAT$1, 0, HEARTBEAT$1.length, this.roomDestPort(), this.proxyIP);
  }
  stopRelay() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
      }
      this.socket = null;
    }
    this.proxyIP = null;
    if (this.inputIndicatorTimer) {
      clearTimeout(this.inputIndicatorTimer);
      this.inputIndicatorTimer = null;
    }
    if (this.outputIndicatorTimer) {
      clearTimeout(this.outputIndicatorTimer);
      this.outputIndicatorTimer = null;
    }
    if (this.inputIndicatorOn) {
      this.inputIndicatorOn = false;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "inputIndicator"), "0");
    }
    if (this.outputIndicatorOn) {
      this.outputIndicatorOn = false;
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "outputIndicator"), "0");
    }
    this._isRunning = false;
  }
  teardown() {
    this.stopRelay();
    return [...this.publishedTopics];
  }
  destroy() {
    this.stopRelay();
  }
}
const dnsLookup = util.promisify(dns__namespace.lookup);
const HEARTBEAT = Buffer.from([47, 104, 98, 0, 44, 0, 0, 0]);
const HEARTBEAT_INTERVAL_MS = 5e3;
function localOsTag() {
  if (process.platform === "darwin") return "osx";
  if (process.platform === "win32") return "windows";
  return process.platform;
}
class NatNetDevice {
  channelIndex;
  deviceType = 3;
  peerId;
  localIP;
  brokerHost;
  localPorts;
  roomPorts;
  publishedTopics = [];
  publish;
  hasRetained;
  enabled = false;
  enableTwo = false;
  direction = 2;
  // Local forwarding targets — where received packets are forwarded on this machine.
  outputPortOne;
  outputPortTwo;
  outputIPOne;
  outputIPTwo;
  listeningIP;
  // Receive-from-router relay state (direction = 2).
  socket = null;
  proxyIP = null;
  heartbeatTimer = null;
  // Indicator slot 1 ("minor") pulses on inbound proxy traffic.
  minorIndicatorOn = false;
  minorIndicatorTimer = null;
  static INDICATOR_HOLD_MS = 150;
  constructor(channelIndex, peerId, localIP2, roomId2, publish, hasRetained = () => false, brokerHost = "telemersion.zhdk.ch") {
    this.channelIndex = channelIndex;
    this.peerId = peerId;
    this.localIP = localIP2;
    this.brokerHost = brokerHost;
    this.localPorts = allocateMocapLocalPorts(channelIndex);
    this.roomPorts = allocateMocapRoomPorts(roomId2, channelIndex);
    this.publish = publish;
    this.hasRetained = hasRetained;
    this.outputPortOne = this.localPorts.inputPort;
    this.outputPortTwo = this.localPorts.inputPort;
    this.outputIPOne = localIP2;
    this.outputIPTwo = localIP2;
    this.listeningIP = localIP2;
  }
  publishDefaults() {
    this.emitDefaults(false);
  }
  emitDefaults(force) {
    const pub = (field, value) => {
      const topic = topics.deviceGui(this.peerId, this.channelIndex, field);
      this.publishedTopics.push(topic);
      if (!force && this.hasRetained(topic)) return;
      this.publish(1, topic, ...value.split(" "));
    };
    pub("direction/select", String(
      2
      /* ReceiveFromRouter */
    ));
    pub("direction/enableNatNet", "0");
    pub("localudp/inputPort", String(this.localPorts.inputPort));
    pub("localudp/listeningIP", this.localIP);
    pub("localudp/outputIPOne", this.localIP);
    pub("localudp/outputIPTwo", this.localIP);
    pub("localudp/outputPortOne", String(this.outputPortOne));
    pub("localudp/outputPortTwo", String(this.outputPortTwo));
    pub("localudp/reset", "0");
    pub("natnet/defaultLocalIP", "0");
    pub("natnet/autoReconnect", "0");
    pub("natnet/bundled", "0");
    pub("natnet/cmdPort", "1510");
    pub("natnet/codec", "3");
    pub("natnet/dataPort", "1511");
    pub("natnet/frameModulo", "1");
    pub("natnet/invmatrix", "0");
    pub("natnet/leftHanded", "0");
    pub("natnet/matrix", "0");
    pub("natnet/motiveIP", this.localIP);
    pub("natnet/multicastIP", "239.255.42.99");
    pub("natnet/sendMarkerInfos", "0");
    pub("natnet/sendOtherMarkerInfos", "0");
    pub("natnet/sendSkeletons", "0");
    pub("natnet/verbose", "0");
    pub("natnet/yUp2zUp", "0");
    pub("monitor/log", "0");
    pub("monitor/monitorGate", "0");
    pub("remoteValues/local_os", localOsTag());
    pub("description", "MoCap");
    pub("enable", "0");
    pub("enableTwo", "0");
    pub("indicators", "0 0 0");
  }
  onTopicChanged(subpath, value) {
    switch (subpath) {
      case "gui/enable":
        this.handleEnable(value === "1");
        break;
      case "gui/enableTwo":
        this.enableTwo = value === "1";
        break;
      case "gui/direction/select":
        this.direction = parseInt(value, 10) || 0;
        break;
      case "gui/direction/enableNatNet":
        break;
      case "gui/localudp/outputIPOne":
        if (value && value !== "0") this.outputIPOne = value;
        break;
      case "gui/localudp/outputIPTwo":
        if (value && value !== "0") this.outputIPTwo = value;
        break;
      case "gui/localudp/listeningIP":
        if (value && value !== "0") this.listeningIP = value;
        break;
      case "gui/localudp/outputPortOne":
        this.outputPortOne = parseInt(value, 10) || this.outputPortOne;
        break;
      case "gui/localudp/outputPortTwo":
        this.outputPortTwo = parseInt(value, 10) || this.outputPortTwo;
        break;
      case "gui/localudp/inputPort":
        this.localPorts.inputPort = parseInt(value, 10) || this.localPorts.inputPort;
        break;
      case "gui/localudp/reset":
        if (value === "1" && !this.enabled) {
          this.resetToDefaults();
        }
        break;
    }
  }
  resetToDefaults() {
    this.localPorts = allocateMocapLocalPorts(this.channelIndex);
    this.outputPortOne = this.localPorts.inputPort;
    this.outputPortTwo = this.localPorts.inputPort;
    this.outputIPOne = this.localIP;
    this.outputIPTwo = this.localIP;
    this.listeningIP = this.localIP;
    this.enableTwo = false;
    this.emitDefaults(true);
  }
  handleEnable(enable) {
    if (enable === this.enabled) return;
    if (enable) {
      if (this.direction === 2) {
        this.enabled = true;
        void this.startReceiveRelay();
        return;
      }
      const mode = this.direction === 4 ? "send-to-local" : "send-to-router";
      console.log(`[NatNet ch.${this.channelIndex}] enable=1 (direction=${mode}) — handler not implemented yet`);
      this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "enable"), "0");
      return;
    }
    this.enabled = false;
    this.stopReceiveRelay();
    console.log(`[NatNet ch.${this.channelIndex}] enable=0`);
  }
  // Receive-from-router (direction=2): bind roomPorts.inputPort (proxy many_port = base+1),
  // send periodic heartbeats to stay registered as a sink, forward received packets
  // to outputPortOne (and outputPortTwo if enableTwo).
  async startReceiveRelay() {
    try {
      const { address } = await dnsLookup(this.brokerHost, { family: 4 });
      this.proxyIP = address;
    } catch (err) {
      console.error(`[NatNet ch.${this.channelIndex}] DNS lookup failed for ${this.brokerHost}:`, err.message);
      this.disableOnError();
      return;
    }
    if (!this.enabled) return;
    try {
      this.socket = dgram__namespace.createSocket({ type: "udp4", reuseAddr: true });
      this.socket.on("message", (msg, rinfo) => {
        if (rinfo.address !== this.proxyIP) return;
        this.pulseMinorIndicator();
        this.socket.send(msg, 0, msg.length, this.outputPortOne, this.outputIPOne);
        if (this.enableTwo) {
          this.socket.send(msg, 0, msg.length, this.outputPortTwo, this.outputIPTwo);
        }
      });
      this.socket.on("error", (err) => {
        console.error(`[NatNet ch.${this.channelIndex}] socket error:`, err.message);
        this.disableOnError();
      });
      this.socket.bind(this.roomPorts.inputPort, this.listeningIP, () => {
        console.log(
          `[NatNet ch.${this.channelIndex}] receive relay up — proxy ${this.proxyIP}:${this.roomPorts.inputPort} → local ${this.outputPortOne}${this.enableTwo ? `/${this.outputPortTwo}` : ""}`
        );
        this.sendHeartbeat();
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
      });
    } catch (err) {
      console.error(`[NatNet ch.${this.channelIndex}] failed to start receive relay:`, err.message);
      this.disableOnError();
    }
  }
  sendHeartbeat() {
    if (!this.socket || !this.proxyIP) return;
    this.socket.send(HEARTBEAT, 0, HEARTBEAT.length, this.roomPorts.inputPort, this.proxyIP);
  }
  pulseMinorIndicator() {
    if (!this.minorIndicatorOn) {
      this.minorIndicatorOn = true;
      this.publishIndicators();
    }
    if (this.minorIndicatorTimer) clearTimeout(this.minorIndicatorTimer);
    this.minorIndicatorTimer = setTimeout(() => {
      this.minorIndicatorOn = false;
      this.minorIndicatorTimer = null;
      this.publishIndicators();
    }, NatNetDevice.INDICATOR_HOLD_MS);
  }
  publishIndicators() {
    const minor = this.minorIndicatorOn ? "1" : "0";
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "indicators"), "0", minor, "0");
  }
  disableOnError() {
    this.stopReceiveRelay();
    this.enabled = false;
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "enable"), "0");
  }
  stopReceiveRelay() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
      }
      this.socket = null;
    }
    this.proxyIP = null;
    if (this.minorIndicatorTimer) {
      clearTimeout(this.minorIndicatorTimer);
      this.minorIndicatorTimer = null;
    }
    if (this.minorIndicatorOn) {
      this.minorIndicatorOn = false;
      this.publishIndicators();
    }
  }
  teardown() {
    this.stopReceiveRelay();
    return [...this.publishedTopics];
  }
  destroy() {
    this.enabled = false;
    this.stopReceiveRelay();
  }
}
const DEFAULT_SPAWN_GRACE_MS = 2e3;
const DEFAULT_ZOMBIE_ESCAPE_MS = 2e3;
class ChildProcessLifecycle {
  constructor(opts) {
    this.opts = opts;
  }
  child = null;
  spawnedAt = 0;
  stopRequested = false;
  escapeTimer = null;
  stdoutBuf = "";
  stderrBuf = "";
  start() {
    if (this.child) return;
    this.stopRequested = false;
    this.stdoutBuf = "";
    this.stderrBuf = "";
    this.spawnedAt = Date.now();
    let child;
    try {
      child = child_process.spawn(this.opts.binary, this.opts.args, {
        env: this.opts.env ?? process.env,
        detached: true
      });
    } catch {
      this.opts.onExit?.("spawn-failure", null);
      return;
    }
    this.child = child;
    child.stdout?.on("data", (chunk) => {
      this.stdoutBuf = this.emitLines(this.stdoutBuf + chunk.toString(), this.opts.onStdout);
    });
    child.stderr?.on("data", (chunk) => {
      this.stderrBuf = this.emitLines(this.stderrBuf + chunk.toString(), this.opts.onStderr);
    });
    child.on("error", () => {
      this.finalize("spawn-failure", null);
    });
    child.on("exit", (code) => {
      if (this.stdoutBuf) {
        this.opts.onStdout?.(this.stdoutBuf);
        this.stdoutBuf = "";
      }
      if (this.stderrBuf) {
        this.opts.onStderr?.(this.stderrBuf);
        this.stderrBuf = "";
      }
      if (this.stopRequested) {
        this.finalize("killed", code);
      } else if (Date.now() - this.spawnedAt < (this.opts.spawnGraceMs ?? DEFAULT_SPAWN_GRACE_MS)) {
        this.finalize("spawn-failure", code);
      } else {
        this.finalize("crash", code);
      }
    });
  }
  stop() {
    if (!this.child || this.stopRequested) return;
    this.stopRequested = true;
    const child = this.child;
    this.signalGroup(child, "SIGKILL");
    this.escapeTimer = setTimeout(() => {
      this.escapeTimer = null;
      if (this.child === child) this.finalize("killed", null);
    }, this.opts.zombieEscapeMs ?? DEFAULT_ZOMBIE_ESCAPE_MS);
  }
  signalGroup(child, signal) {
    if (typeof child.pid !== "number") return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
      }
    }
  }
  isRunning() {
    return this.child !== null && !this.stopRequested;
  }
  emitLines(buffer2, emit) {
    if (!emit) return "";
    const parts = buffer2.split(/\r?\n/);
    const remainder = parts.pop() ?? "";
    for (const line of parts) emit(line);
    return remainder;
  }
  finalize(reason, code) {
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
    this.child = null;
    this.opts.onExit?.(reason, code);
  }
}
function defaultUltraGridConfig() {
  return {
    audioVideo: {
      videoCapture: {
        type: "0",
        texture: { menu: { selection: "-default-" } },
        ndi: { menu: { selection: "-default-" } },
        custom: { customFlags: { flags: "-none-" } },
        advanced: {
          compress: { codec: "2", bitrate: "10" },
          texture: { fps: "0" },
          filter: { params: "-none-" }
        }
      },
      videoReciever: {
        type: "0",
        texture: { name: "s_channel_0", closedWindow: "0" },
        ndi: { name: "s_channel_0" },
        custom: { customFlags: { flags: "-none-" } },
        advanced: { postprocessor: { params: "-none-" } }
      },
      audioCapture: {
        type: "0",
        portaudio: { menu: { selection: "-default-" } },
        coreaudio: { menu: { selection: "-default-" } },
        wasapi: { menu: { selection: "-default-" } },
        jack: { menu: { selection: "-default-" } },
        testcard: { frequency: "440", volume: "-18" },
        custom: { customFlags: { flags: "-none-" } },
        advanced: {
          compress: { codec: "1", bitrate: "64000", samplerate: "32000" },
          channels: { channels: "1" }
        }
      },
      audioReceiver: {
        type: "0",
        portaudio: { menu: { selection: "-default-" } },
        coreaudio: { menu: { selection: "-default-" } },
        wasapi: { menu: { selection: "-default-" } },
        jack: { menu: { selection: "-default-" } },
        custom: { customFlags: { flags: "-none-" } },
        advanced: { channels: { params: "-none-" } }
      },
      advanced: {
        custom: { customFlags: { flags: "-none-" } },
        advanced: {
          params: { params: "-none-" },
          encryption: { key: "-none-" }
        }
      },
      connection: "2",
      transmission: "2"
    },
    network: {
      mode: "1",
      holepuncher: { stunServer: "stun4.l.google.com:19302" },
      local: { customSending: "0.0.0.0:0" },
      ports: { alternativeChannel: "0", receiveChannel: "0" }
    },
    monitor: {
      log: "0",
      monitorGate: "0"
    },
    remoteValues: {
      local_os: "osx"
    },
    enable: "0",
    print_cli: "0"
  };
}
const CONFIG_SUBPATHS = /* @__PURE__ */ new Set([
  "audioVideo/videoCapture/type",
  "audioVideo/videoCapture/texture/menu/selection",
  "audioVideo/videoCapture/ndi/menu/selection",
  "audioVideo/videoCapture/custom/customFlags/flags",
  "audioVideo/videoCapture/advanced/compress/codec",
  "audioVideo/videoCapture/advanced/compress/bitrate",
  "audioVideo/videoCapture/advanced/texture/fps",
  "audioVideo/videoCapture/advanced/filter/params",
  "audioVideo/videoReciever/type",
  "audioVideo/videoReciever/texture/name",
  "audioVideo/videoReciever/texture/closedWindow",
  "audioVideo/videoReciever/ndi/name",
  "audioVideo/videoReciever/custom/customFlags/flags",
  "audioVideo/videoReciever/advanced/postprocessor/params",
  "audioVideo/audioCapture/type",
  "audioVideo/audioCapture/portaudio/menu/selection",
  "audioVideo/audioCapture/coreaudio/menu/selection",
  "audioVideo/audioCapture/wasapi/menu/selection",
  "audioVideo/audioCapture/jack/menu/selection",
  "audioVideo/audioCapture/testcard/frequency",
  "audioVideo/audioCapture/testcard/volume",
  "audioVideo/audioCapture/custom/customFlags/flags",
  "audioVideo/audioCapture/advanced/compress/codec",
  "audioVideo/audioCapture/advanced/compress/bitrate",
  "audioVideo/audioCapture/advanced/compress/samplerate",
  "audioVideo/audioCapture/advanced/channels/channels",
  "audioVideo/audioReceiver/type",
  "audioVideo/audioReceiver/portaudio/menu/selection",
  "audioVideo/audioReceiver/coreaudio/menu/selection",
  "audioVideo/audioReceiver/wasapi/menu/selection",
  "audioVideo/audioReceiver/jack/menu/selection",
  "audioVideo/audioReceiver/custom/customFlags/flags",
  "audioVideo/audioReceiver/advanced/channels/params",
  "audioVideo/advanced/custom/customFlags/flags",
  "audioVideo/advanced/advanced/params/params",
  "audioVideo/advanced/advanced/encryption/key",
  "audioVideo/connection",
  "audioVideo/transmission",
  "network/mode",
  "network/holepuncher/stunServer",
  "network/local/customSending",
  "network/ports/alternativeChannel",
  "network/ports/receiveChannel",
  "monitor/log",
  "monitor/monitorGate",
  "remoteValues/local_os",
  "enable",
  "print_cli"
]);
const TRANSIENT_SUBPATHS = /* @__PURE__ */ new Set([
  "description",
  "indicators",
  "updateMenu"
]);
function isConfigSubpath(subpath) {
  return CONFIG_SUBPATHS.has(subpath);
}
function isTransientSubpath(subpath) {
  return TRANSIENT_SUBPATHS.has(subpath);
}
function applyTopicChange(config, subpath, value) {
  if (!CONFIG_SUBPATHS.has(subpath)) return config;
  const next = structuredClone(config);
  const parts = subpath.split("/");
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}
function snapshotTopics(config) {
  const out = [];
  for (const subpath of CONFIG_SUBPATHS) {
    const parts = subpath.split("/");
    let cursor = config;
    for (const part of parts) {
      cursor = cursor[part];
    }
    out.push({ subpath, value: cursor });
  }
  return out;
}
const NONE = "-none-";
const DEFAULT = "-default-";
function buildUvArgs(input) {
  const { config } = input;
  const mode = config.network.mode;
  switch (mode) {
    case "1":
      return buildMode1Args(input);
    case "2":
      return buildMode2Args(input);
    case "4":
      return buildMode4Args(input);
    case "5":
      return buildMode5Args(input);
    case "7":
      return buildMode7Args(input);
    default:
      throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`);
  }
}
function shouldEmitVideo(transmission) {
  return transmission !== "1";
}
function shouldEmitAudio(transmission) {
  return transmission !== "0";
}
function shouldEmitSend(connection) {
  return connection !== "1";
}
function shouldEmitReceive(connection) {
  return connection !== "0";
}
function buildMode1Args(input) {
  const { config, ports, indexes, host, localOs } = input;
  const transmission = config.audioVideo.transmission;
  const args = [];
  pushTopLevelFlags(args, config);
  if (shouldEmitVideo(transmission)) {
    pushCaptureFilter(args, config);
    pushVideoCapture(args, config, indexes, localOs);
  }
  if (shouldEmitAudio(transmission)) {
    pushAudioCapture(args, config, indexes);
  }
  pushPort(args, ports, transmission);
  args.push(host);
  return args;
}
function buildMode2Args(input) {
  const { config, ports, indexes, host, textureReceiverName, localOs } = input;
  const transmission = config.audioVideo.transmission;
  const args = [];
  pushTopLevelFlags(args, config);
  if (shouldEmitVideo(transmission)) {
    args.push("-t", "testcard:80:60:1:UYVY");
    pushPostprocessor(args, config);
    pushVideoReceive(args, config, textureReceiverName, localOs);
  }
  if (shouldEmitAudio(transmission)) {
    args.push("-s", "testcard:frequency=440");
    pushAudioReceive(args, config, indexes);
    pushAudioMapping(args, config);
  }
  pushPort(args, ports, transmission);
  args.push(host);
  return args;
}
function buildMode4Args(input) {
  const { config, indexes, textureReceiverName, localOs } = input;
  const transmission = config.audioVideo.transmission;
  const connection = config.audioVideo.connection;
  const args = [];
  pushTopLevelFlags(args, config);
  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushCaptureFilter(args, config);
      pushVideoCapture(args, config, indexes, localOs);
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioCapture(args, config, indexes);
    }
  }
  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushPostprocessor(args, config);
      pushVideoReceive(args, config, textureReceiverName, localOs);
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioReceive(args, config, indexes);
      pushAudioMapping(args, config);
    }
  }
  return args;
}
function buildMode5Args(input) {
  const { config, indexes, textureReceiverName, localOs } = input;
  const transmission = config.audioVideo.transmission;
  const connection = config.audioVideo.connection;
  const { ip: lanIp, port: lanPort } = parseCustomSending(config.network.local.customSending);
  const args = [];
  pushTopLevelFlags(args, config);
  pushLanPort(args, lanPort, transmission);
  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushPostprocessor(args, config);
      pushVideoReceive(args, config, textureReceiverName, localOs);
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioReceive(args, config, indexes);
      pushAudioMapping(args, config);
    }
  }
  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) {
      pushCaptureFilter(args, config);
      pushVideoCapture(args, config, indexes, localOs);
    }
    if (shouldEmitAudio(transmission)) {
      pushAudioCapture(args, config, indexes);
    }
    args.push(lanIp);
  }
  return args;
}
function parseCustomSending(raw) {
  const idx = raw.lastIndexOf(":");
  if (idx < 0) throw new Error(`invalid customSending value: ${raw}`);
  const ip = raw.slice(0, idx);
  const port = parseInt(raw.slice(idx + 1), 10);
  if (!ip || Number.isNaN(port)) throw new Error(`invalid customSending value: ${raw}`);
  return { ip, port };
}
function pushLanPort(args, port, transmission) {
  if (transmission === "2") {
    args.push(`-P${port}:${port}:${port + 2}:${port + 2}`);
  } else {
    args.push(`-P${port}`);
  }
}
function buildMode7Args(input) {
  const { config, indexes, textureReceiverName, localOs } = input;
  const args = [];
  pushTopLevelFlags(args, config);
  pushCaptureFilter(args, config);
  pushVideoCapture(args, config, indexes, localOs, { emitCodec: false });
  pushPostprocessor(args, config);
  pushVideoReceive(args, config, textureReceiverName, localOs);
  return args;
}
function pushTopLevelFlags(args, config) {
  const params = config.audioVideo.advanced.advanced.params.params;
  let paramValue = "log-color=no";
  if (params && params !== NONE) paramValue += `,${params}`;
  args.push("--param", paramValue);
  const advancedCustom = config.audioVideo.advanced.custom.customFlags.flags;
  if (advancedCustom && advancedCustom !== NONE) {
    for (const tok of shellTokenize(advancedCustom)) args.push(tok);
  }
  const encryption = config.audioVideo.advanced.advanced.encryption.key;
  if (encryption && encryption !== NONE) {
    args.push("--encryption", encryption);
  }
}
function pushPort(args, ports, transmission) {
  if (transmission === "2") {
    args.push(`-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`);
  } else {
    args.push(`-P${ports.videoPort}`);
  }
}
function textureCapturePrefix(localOs) {
  return localOs === "win" ? "spout" : "syphon";
}
function textureDisplayPrefix(localOs) {
  return localOs === "win" ? "gl:spout=" : "gl:syphon=";
}
function textureFpsFlag(localOs) {
  return localOs === "win" ? "fps" : "override_fps";
}
function pushVideoCapture(args, config, indexes, localOs, opts = {}) {
  const emitCodec = opts.emitCodec !== false;
  const type = config.audioVideo.videoCapture.type;
  if (type === "2") {
    const custom = config.audioVideo.videoCapture.custom.customFlags.flags;
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok);
    }
    return;
  }
  if (type === "0") {
    let flag = textureCapturePrefix(localOs);
    if (indexes.textureCapture && indexes.textureCapture !== DEFAULT) {
      flag += `:${indexes.textureCapture}`;
    }
    const fps = config.audioVideo.videoCapture.advanced.texture.fps;
    if (fps && fps !== "0") flag += `:${textureFpsFlag(localOs)}=${fps}`;
    args.push("-t", flag);
  } else if (type === "1") {
    let flag = "ndi";
    if (indexes.ndiCapture && indexes.ndiCapture !== DEFAULT) {
      flag += `:${indexes.ndiCapture}`;
    }
    args.push("-t", flag);
  }
  if (!emitCodec) return;
  const { codec, bitrate } = config.audioVideo.videoCapture.advanced.compress;
  if (codec !== "0") {
    args.push("-c", `libavcodec:codec=${videoCodecName(codec)}:bitrate=${bitrate}M`);
  }
}
function pushVideoReceive(args, config, textureReceiverName, localOs) {
  const type = config.audioVideo.videoReciever.type;
  if (type === "2") {
    const custom = config.audioVideo.videoReciever.custom.customFlags.flags;
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok);
    }
    return;
  }
  if (type === "1") {
    const ndiName = config.audioVideo.videoReciever.ndi.name;
    args.push("-d", `ndi:name='${ndiName}'`);
    return;
  }
  const name = config.audioVideo.videoReciever.texture.name || textureReceiverName;
  args.push("-d", `${textureDisplayPrefix(localOs)}'${name}'`);
}
function pushAudioCapture(args, config, indexes) {
  const type = config.audioVideo.audioCapture.type;
  if (type === "7") {
    const custom = config.audioVideo.audioCapture.custom.customFlags.flags;
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok);
    }
    return;
  }
  if (type === "8") {
    const testcard = config.audioVideo.audioCapture.testcard;
    args.push("-s", `testcard:volume=${testcard.volume}:frequency=${testcard.frequency}`);
    return;
  }
  const backend = audioCaptureBackend(type);
  if (backend) {
    let flag = backend;
    if (audioBackendHasMenu(type) && indexes.audioCapture !== null) {
      flag += `:${indexes.audioCapture}`;
    }
    args.push("-s", flag);
  }
  const audio = config.audioVideo.audioCapture.advanced;
  if (audio.compress.codec !== "0") {
    args.push("--audio-codec", `${audioCodecName(audio.compress.codec)}:bitrate=${audio.compress.bitrate}`);
  }
  args.push("--audio-capture-format", `channels=${audio.channels.channels}`);
}
function pushAudioReceive(args, config, indexes) {
  const type = config.audioVideo.audioReceiver.type;
  if (type === "7") {
    const custom = config.audioVideo.audioReceiver.custom.customFlags.flags;
    if (custom && custom !== NONE) {
      for (const tok of shellTokenize(custom)) args.push(tok);
    }
    return;
  }
  const backend = audioReceiveBackend(type);
  if (!backend) return;
  let flag = backend;
  if (audioBackendHasMenu(type) && indexes.audioReceive !== null) {
    flag += `:${indexes.audioReceive}`;
  }
  args.push("-r", flag);
}
function pushCaptureFilter(args, config) {
  const filter = config.audioVideo.videoCapture.advanced.filter.params;
  if (filter && filter !== NONE) {
    args.push("--capture-filter", filter);
  }
}
function pushPostprocessor(args, config) {
  const pp = config.audioVideo.videoReciever.advanced.postprocessor.params;
  if (pp && pp !== NONE) {
    args.push("-p", pp);
  }
}
function pushAudioMapping(args, config) {
  const mapping = config.audioVideo.audioReceiver.advanced.channels.params;
  if (mapping && mapping !== NONE) {
    args.push("--audio-channel-map", mapping);
  }
}
function audioReceiveBackend(type) {
  switch (type) {
    case "0":
      return "portaudio";
    case "1":
      return "coreaudio";
    case "2":
      return "wasapi";
    case "3":
      return "jack";
    case "4":
      return "embedded";
    case "5":
      return "analog";
    case "6":
      return "AESEBU";
    default:
      return null;
  }
}
function audioCaptureBackend(type) {
  return audioReceiveBackend(type);
}
function audioBackendHasMenu(type) {
  return type === "0" || type === "1" || type === "2" || type === "3";
}
const VIDEO_CODEC_NAMES = {
  "1": "JPEG",
  "2": "H.264",
  "3": "H.265",
  "4": "J2K",
  "5": "AV1",
  "6": "VP8",
  "7": "VP9",
  "8": "HFYU",
  "9": "FFV1"
};
const AUDIO_CODEC_NAMES = {
  "1": "OPUS",
  "3": "FLAC",
  "4": "AAC",
  "5": "MP3",
  "6": "G.722",
  "7": "u-law",
  "8": "A-law",
  "9": "PCM"
};
function videoCodecName(codec) {
  const name = VIDEO_CODEC_NAMES[codec];
  if (!name) throw new Error(`unsupported video codec id: ${codec}`);
  return name;
}
function audioCodecName(codec) {
  if (codec === "2") {
    throw new Error("audio codec index 2 (speex) is unavailable in UG 1.10.3");
  }
  const name = AUDIO_CODEC_NAMES[codec];
  if (!name) throw new Error(`unsupported audio codec id: ${codec}`);
  return name;
}
function extractMenuIndex(rangeString, selection) {
  if (!rangeString || !selection) return null;
  for (const entry of rangeString.split("|")) {
    const match = entry.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    if (entryMatchesSelection(match[2], selection)) return parseInt(match[1], 10);
  }
  return null;
}
function entryMatchesSelection(entry, selection) {
  if (entry === selection) return true;
  const selectionWithoutPrefix = selection.replace(/^\d+\s+/, "");
  if (entry === selectionWithoutPrefix) return true;
  const entryHead = stripDeviceTail(entry);
  const selectionHead = stripDeviceTail(selectionWithoutPrefix);
  if (!selectionHead) return false;
  return entryHead.startsWith(selectionHead);
}
function stripDeviceTail(s) {
  const idx = s.indexOf(" (out:");
  return idx === -1 ? s : s.slice(0, idx);
}
function shellTokenize(line) {
  const tokens = [];
  let acc = "";
  let inSingle = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'") {
      inSingle = !inSingle;
      acc += ch;
      continue;
    }
    if (!inSingle && /\s/.test(ch)) {
      if (acc) {
        tokens.push(acc);
        acc = "";
      }
      continue;
    }
    acc += ch;
  }
  if (acc) tokens.push(acc);
  return tokens;
}
class MonitorLogBuffer {
  constructor(capacity = 50) {
    this.capacity = capacity;
  }
  lines = [];
  append(line) {
    this.lines.push(line);
    while (this.lines.length > this.capacity) this.lines.shift();
  }
  snapshot() {
    return this.lines.join("\n");
  }
  replay() {
    return this.lines;
  }
  clear() {
    this.lines.length = 0;
  }
}
const TIMESTAMP_PATTERN = /^\[\d+\.\d+\]\s+/;
const SOURCE_PATTERN = /\[(Syphon|SYPHON|Spout|SPOUT|Decklink|DeckLink|screen|AVfoundation|NDI|ndi|Audio|dshow|GL|testcard|syphon)[^\]]*\]/i;
const DIRECTION_PATTERN = /(sender|capture|cap|display|decoder|disp)[.\]]/;
class UltraGridIndicatorParser {
  constructor(publish, topic) {
    this.publish = publish;
    this.topic = topic;
  }
  state = {
    txActive: false,
    rxActive: false,
    txFps: "0",
    txVol: "0",
    rxFps: "0",
    rxVol: "0"
  };
  lastPublished = null;
  handleLogLine(line) {
    const stripped = line.replace(TIMESTAMP_PATTERN, "").trim();
    if (!stripped) return;
    const sourceMatch = stripped.match(SOURCE_PATTERN);
    if (!sourceMatch) return;
    const dirMatch = stripped.match(DIRECTION_PATTERN);
    if (!dirMatch) return;
    const isTx = /sender|capture|cap/.test(dirMatch[0]);
    let fpsMatch = stripped.match(/FPS\s+(\d+)\/(\d+)/);
    if (fpsMatch) {
      const num = parseInt(fpsMatch[1], 10);
      const den = parseInt(fpsMatch[2], 10);
      const fps = Math.round(num / den * 10) / 10;
      if (isTx) {
        this.state.txFps = String(fps);
        this.pulseTxActive();
      } else {
        this.state.rxFps = String(fps);
        this.pulseRxActive();
      }
    } else {
      fpsMatch = stripped.match(/=\s+([\d.]+)\s+FPS/);
      if (fpsMatch) {
        const fps = parseFloat(fpsMatch[1]);
        if (isTx) {
          this.state.txFps = String(fps);
          this.pulseTxActive();
        } else {
          this.state.rxFps = String(fps);
          this.pulseRxActive();
        }
      }
    }
    const volMatch = stripped.match(/Volume:\s*(?:\[\d+\]\s*)?([-\d.]+)/);
    if (volMatch) {
      const vol = volMatch[1];
      if (isTx) {
        this.state.txVol = vol;
        this.pulseTxActive();
      } else {
        this.state.rxVol = vol;
        this.pulseRxActive();
      }
    }
    this.publishIfChanged();
  }
  pulseTxActive() {
    const wasInactive = !this.state.txActive;
    this.state.txActive = true;
    if (wasInactive) this.publishIfChanged();
  }
  pulseRxActive() {
    const wasInactive = !this.state.rxActive;
    this.state.rxActive = true;
    if (wasInactive) this.publishIfChanged();
  }
  publishIfChanged() {
    const atoms = [
      this.state.txActive ? "1" : "0",
      this.state.rxActive ? "1" : "0",
      this.state.txFps,
      this.state.txVol,
      this.state.rxFps,
      this.state.rxVol
    ];
    const joined = atoms.join(" ");
    if (joined !== this.lastPublished) {
      this.lastPublished = joined;
      this.publish(1, this.topic, ...atoms);
    }
  }
  reset() {
    this.state = {
      txActive: false,
      rxActive: false,
      txFps: "0",
      txVol: "0",
      rxFps: "0",
      rxVol: "0"
    };
    this.lastPublished = null;
    this.publishIfChanged();
  }
}
const UG_DEVICE_TYPE = 2;
const MONITOR_LOG_CAPACITY = 50;
function detectLocalOs() {
  if (process.platform === "darwin") return "osx";
  if (process.platform === "win32") return "win";
  return "linux";
}
class UltraGridDevice {
  channelIndex;
  deviceType = UG_DEVICE_TYPE;
  peerId;
  roomId;
  host;
  publish;
  hasRetained;
  getSetting;
  resolveBinary;
  spawnFactory;
  localOs;
  config = defaultUltraGridConfig();
  publishedTopics = /* @__PURE__ */ new Set();
  monitor = new MonitorLogBuffer(MONITOR_LOG_CAPACITY);
  monitorGateOn = false;
  lifecycle = null;
  enabled = false;
  indicatorParser;
  constructor(opts) {
    this.channelIndex = opts.channelIndex;
    this.peerId = opts.peerId;
    this.roomId = opts.roomId;
    this.host = opts.host ?? "telemersion.zhdk.ch";
    this.publish = opts.publish;
    this.hasRetained = opts.hasRetained ?? (() => false);
    this.getSetting = opts.getSetting ?? (() => null);
    this.resolveBinary = opts.resolveBinary ?? (() => null);
    this.spawnFactory = opts.spawnFactory ?? ((o) => new ChildProcessLifecycle(o));
    this.localOs = opts.osOverride ?? detectLocalOs();
    this.config = applyTopicChange(this.config, "remoteValues/local_os", this.localOs);
    const indicatorTopic = topics.deviceGui(opts.peerId, opts.channelIndex, "indicators");
    this.indicatorParser = new UltraGridIndicatorParser(
      (_, topic, ...values) => {
        this.publishedTopics.add(topic);
        opts.publish(1, topic, ...values);
      },
      indicatorTopic
    );
  }
  publishDefaults() {
    const txPorts = allocateUgPorts(this.roomId, this.channelIndex);
    let defaults = applyTopicChange(
      defaultUltraGridConfig(),
      "remoteValues/local_os",
      this.localOs
    );
    defaults = applyTopicChange(
      defaults,
      "network/local/customSending",
      `0.0.0.0:${txPorts.videoPort}`
    );
    for (const { subpath, value } of snapshotTopics(defaults)) {
      this.pubDeviceGui(subpath, value, false);
    }
    this.pubDeviceGui("description", "UG", false);
    this.pubDeviceGui("indicators", "0 0 0 0 0 0", false);
    this.pubDeviceGui("monitor/log", "", false);
    this.pubDeviceGui("monitor/monitorGate", "0", false);
  }
  pubDeviceGui(subpath, value, force) {
    const topic = topics.deviceGui(this.peerId, this.channelIndex, subpath);
    this.publishedTopics.add(topic);
    if (!force && this.hasRetained(topic)) return;
    this.publish(1, topic, ...value.split(" "));
  }
  onTopicChanged(subpath, value) {
    if (!subpath.startsWith("gui/")) return;
    const tail = subpath.slice("gui/".length);
    if (tail === "enable") {
      this.handleEnable(value === "1");
      return;
    }
    if (tail === "monitor/monitorGate") {
      this.handleMonitorGate(value === "1");
      return;
    }
    if (tail === "monitor/log") return;
    if (isTransientSubpath(tail)) return;
    if (!isConfigSubpath(tail)) return;
    this.config = applyTopicChange(this.config, tail, value);
  }
  handleEnable(enable) {
    if (enable && !this.enabled) {
      this.enabled = true;
      this.startProcess();
    } else if (!enable && this.enabled) {
      this.enabled = false;
      this.stopProcess();
    }
  }
  handleMonitorGate(on) {
    if (on === this.monitorGateOn) return;
    this.monitorGateOn = on;
    if (on) this.replayMonitorLog();
  }
  startProcess() {
    const binary = this.resolveBinary();
    if (!binary) {
      this.logWarn("UltraGrid binary not found; cannot start");
      this.publishEnableOff();
      this.enabled = false;
      return;
    }
    const indexes = this.resolveMenuIndexes();
    const ports = this.config.network.mode === "2" ? allocateUgRxPorts(this.roomId, this.channelIndex) : allocateUgPorts(this.roomId, this.channelIndex);
    let args;
    try {
      args = buildUvArgs({
        config: this.config,
        ports,
        indexes,
        host: this.host,
        textureReceiverName: this.config.audioVideo.videoReciever.texture.name,
        localOs: this.localOs
      });
    } catch (err) {
      this.logWarn(`cannot build UV args: ${err.message}`);
      this.publishEnableOff();
      this.enabled = false;
      return;
    }
    this.monitor.clear();
    const cliLine = `${binary} ${args.join(" ")}`;
    console.log(`[UG ch.${this.channelIndex}] spawn: ${cliLine}`);
    const cliLogLine = `[CLI] ${cliLine}`;
    this.monitor.append(cliLogLine);
    if (this.monitorGateOn) this.publishMonitorLine(cliLogLine);
    this.lifecycle = this.spawnFactory({
      binary,
      args: stripArgQuotes(args),
      env: sanitizedChildEnv$1(),
      onStdout: (line) => this.handleLogLine(line),
      onStderr: (line) => this.handleLogLine(line),
      onExit: (reason, code) => this.handleExit(reason, code, ports)
    });
    this.lifecycle.start();
  }
  stopProcess() {
    this.lifecycle?.stop();
    this.indicatorParser.reset();
    this.pubDeviceGui("indicators", "0 0 0 0 0 0", true);
  }
  handleLogLine(line) {
    this.monitor.append(line);
    if (this.monitorGateOn) this.publishMonitorLine(line);
    this.indicatorParser.handleLogLine(line);
  }
  publishMonitorLine(line) {
    this.publish(
      1,
      topics.deviceGui(this.peerId, this.channelIndex, "monitor/log"),
      line
    );
  }
  replayMonitorLog() {
    for (const line of this.monitor.replay()) {
      this.publishMonitorLine(line);
    }
  }
  handleExit(reason, code, _ports) {
    this.lifecycle = null;
    if (reason === "killed") return;
    const label = reason === "spawn-failure" ? "UV spawn-failure" : "UV crashed";
    this.logWarn(`${label} (code ${code}); disabling`);
    this.enabled = false;
    this.publishEnableOff();
  }
  publishEnableOff() {
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "enable"), "0");
  }
  logWarn(message) {
    const line = `[NG] ${message}`;
    this.monitor.append(line);
    if (this.monitorGateOn) this.publishMonitorLine(line);
    console.warn(`[UG ch.${this.channelIndex}] ${message}`);
  }
  resolveMenuIndexes() {
    const videoType = this.config.audioVideo.videoCapture.type;
    const audioType = this.config.audioVideo.audioCapture.type;
    const audioRxType = this.config.audioVideo.audioReceiver.type;
    const textureSel = this.config.audioVideo.videoCapture.texture.menu.selection;
    const ndiSel = this.config.audioVideo.videoCapture.ndi.menu.selection;
    const textureCapture = videoType === "0" ? textureSel : null;
    const ndiCapture = videoType === "1" ? ndiSel : null;
    return {
      textureCapture,
      ndiCapture,
      audioCapture: this.resolveAudioIndex(audioType, "Capture", true),
      audioReceive: this.resolveAudioIndex(audioRxType, "Receive", false)
    };
  }
  resolveAudioIndex(type, side, capture) {
    const backend = audioBackendFromType(type);
    if (!backend) return null;
    const section = capture ? this.config.audioVideo.audioCapture : this.config.audioVideo.audioReceiver;
    const selection = section[backend]?.menu?.selection;
    if (!selection || selection === "-default-") return null;
    const rangeTopic = `localMenus/${backend}${side}Range`;
    const range = this.getSetting(rangeTopic) ?? "";
    return extractMenuIndex(range, selection);
  }
  teardown() {
    this.lifecycle?.stop();
    this.lifecycle = null;
    return [...this.publishedTopics];
  }
  destroy() {
    this.lifecycle?.stop();
    this.lifecycle = null;
  }
}
function audioBackendFromType(type) {
  if (type === "0") return "portaudio";
  if (type === "1") return "coreaudio";
  if (type === "2") return "wasapi";
  if (type === "3") return "jack";
  return null;
}
function sanitizedChildEnv$1() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.__CFBundleIdentifier;
  delete env.MallocNanoZone;
  return env;
}
function stripArgQuotes(args) {
  return args.map((a) => a.replace(/'([^']*)'/g, "$1"));
}
class SpawnCliError extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "SpawnCliError";
  }
}
const DEFAULT_TIMEOUT_MS = 5e3;
const SKIP_VENDORED = process.env.NG_SKIP_VENDORED_UG === "1";
function resolveUgPath() {
  try {
    const userPath = loadSettings().ugPath;
    if (userPath && fs.existsSync(userPath)) return userPath;
  } catch {
  }
  if (process.env.UG_PATH) {
    return fs.existsSync(process.env.UG_PATH) ? process.env.UG_PATH : null;
  }
  if (process.platform === "darwin") {
    if (!SKIP_VENDORED) {
      const vendored = path.resolve(process.cwd(), "vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv");
      if (fs.existsSync(vendored)) return vendored;
    }
    const system = "/Applications/uv-qt.app/Contents/MacOS/uv";
    return fs.existsSync(system) ? system : null;
  }
  if (process.platform === "linux") {
    const linux = "/usr/local/bin/uv";
    return fs.existsSync(linux) ? linux : null;
  }
  if (process.platform === "win32") {
    return null;
  }
  return null;
}
function spawnCli(binary, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve2, reject) => {
    if (!fs.existsSync(binary)) {
      reject(new SpawnCliError(`binary not found: ${binary}`));
      return;
    }
    const spawnOpts = { env: options.env ?? process.env };
    let child;
    try {
      child = child_process.spawn(binary, args, spawnOpts);
    } catch (err) {
      reject(new SpawnCliError(`spawn failed: ${binary}`, err));
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new SpawnCliError(`process error: ${binary}`, err));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new SpawnCliError(`timeout after ${timeoutMs}ms: ${binary} ${args.join(" ")}`));
        return;
      }
      resolve2({ stdout, stderr, exitCode: code });
    });
  });
}
function performShutdown(bus2, deviceRouter2, publishedTopics) {
  if (deviceRouter2) {
    deviceRouter2.destroyAll();
  }
  for (const topic of publishedTopics) {
    try {
      bus2.publish(1, topic, "");
    } catch {
    }
  }
  try {
    bus2.leave();
  } catch {
  }
  try {
    bus2.disconnect();
  } catch {
  }
}
let registry = {};
function registerBackend(backend, spec) {
  registry[backend] = spec;
}
async function enumerate(peerId, publish, options = {}) {
  if (!peerId) return;
  const uvPath = resolveUgPath();
  const applicable = applicableBackends();
  const selected = options.only ? applicable.filter((b) => options.only.includes(b)) : applicable;
  if (!uvPath) {
    publish(1, ugEnableTopic(peerId), "0");
    for (const backend of selected) {
      publish(1, backendTopic(peerId, backend), backendFallback(backend));
    }
    console.warn("[enumerate] UltraGrid binary not found; publishing fallback enumeration");
    return;
  }
  publish(1, ugEnableTopic(peerId), "1");
  await Promise.allSettled(selected.map((b) => runBackend(b, uvPath, peerId, publish)));
}
async function handleRefreshTrigger(peerId, topic, publish) {
  const backend = backendFromRefreshTopic(peerId, topic);
  if (!backend) return false;
  await enumerate(peerId, publish, { only: [backend] });
  return true;
}
async function runBackend(backend, uvPath, peerId, publish) {
  const spec = registry[backend];
  if (!spec) {
    publish(1, backendTopic(peerId, backend), backendFallback(backend));
    return;
  }
  try {
    const result = await spawnCli(uvPath, spec.args, { env: sanitizedChildEnv() });
    const parsed = spec.parse(result.stdout);
    publish(1, backendTopic(peerId, backend), parsed.range);
  } catch (err) {
    publish(1, backendTopic(peerId, backend), backendFallback(backend));
    console.warn(`[enumerate] ${backend} failed: ${err?.message ?? err}`);
  }
}
function sanitizedChildEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.__CFBundleIdentifier;
  delete env.MallocNanoZone;
  return env;
}
const EMPTY_RANGE = { range: "0", count: 0 };
const DEFAULT_RANGE = { range: "-default-", count: 0 };
function parsePortaudio(stdout) {
  const entries = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/^\(\*\)\s*/, "").trim();
    const m = line.match(/^portaudio:(\d+)\s*-\s*(.+)$/);
    if (!m) continue;
    const id = m[1];
    const rest = m[2].trim();
    entries.push(`${id} ${rest}`);
  }
  if (entries.length === 0) return EMPTY_RANGE;
  return { range: entries.join("|"), count: entries.length };
}
function parseCoreaudio(stdout) {
  const entries = [];
  for (const raw of stdout.split("\n")) {
    const m = raw.match(/^\s*coreaudio:(\d+)\s*:\s*(.+)$/);
    if (!m) continue;
    const id = m[1];
    const name = m[2].trim();
    entries.push(`${id} ${name}`);
  }
  if (entries.length === 0) return EMPTY_RANGE;
  return { range: entries.join("|"), count: entries.length };
}
function parseNdi(stdout) {
  const lines = stdout.split("\n");
  const headerIdx = lines.findIndex((l) => /available sources/i.test(l));
  if (headerIdx < 0) return DEFAULT_RANGE;
  const names = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(Exit|MasterPort|\[NDI)/i.test(line)) continue;
    if (!/ - /.test(line)) continue;
    const name = line.split(" - ")[0].trim();
    if (name) names.push(name);
  }
  if (names.length === 0) return DEFAULT_RANGE;
  return { range: names.join("|"), count: names.length };
}
function parseGenericAudio(prefix, stdout) {
  const rx = new RegExp(`^\\s*(?:\\(\\*\\)\\s*)?${prefix}:(\\d+)\\s*[-:]\\s*(.+)$`);
  const entries = [];
  for (const raw of stdout.split("\n")) {
    const m = raw.match(rx);
    if (!m) continue;
    const id = m[1];
    const rest = m[2].trim();
    entries.push(`${id} ${rest}`);
  }
  if (entries.length === 0) return EMPTY_RANGE;
  return { range: entries.join("|"), count: entries.length };
}
function parseJack(stdout) {
  return parseGenericAudio("jack", stdout);
}
function parseWasapi(stdout) {
  return parseGenericAudio("wasapi", stdout);
}
function parseTextureSender(stdout, backend = "syphon") {
  if (/Unable to open capture device/i.test(stdout)) return DEFAULT_RANGE;
  const lines = stdout.split("\n");
  const headerIdx = lines.findIndex((l) => /Available servers:/i.test(l));
  if (headerIdx < 0) return DEFAULT_RANGE;
  const entries = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(Exit|MasterPort|\[)/i.test(line)) break;
    const m = line.match(/^\d+\)\s*app:\s*(.*?)\s*name:\s*(.*)$/);
    if (!m) continue;
    const app = m[1].trim();
    const name = m[2].trim();
    entries.push(formatSelection(backend, app, name));
  }
  if (entries.length === 0) return DEFAULT_RANGE;
  return { range: entries.join("|"), count: entries.length };
}
function formatSelection(backend, app, name) {
  if (backend === "syphon") {
    if (name) return `app='${app}':name='${name}'`;
    return `app='${app}'`;
  }
  const id = name ? `${app}/${name}` : app;
  return `name='${id}'`;
}
function registerDefaultBackends() {
  const textureBackend = process.platform === "win32" ? "spout" : "syphon";
  registerBackend("textureCapture", {
    args: ["-t", `${textureBackend}:help`],
    parse: (stdout) => parseTextureSender(stdout, textureBackend)
  });
  registerBackend("ndi", { args: ["-t", "ndi:help"], parse: parseNdi });
  registerBackend("portaudioCapture", { args: ["-s", "portaudio:help"], parse: parsePortaudio });
  registerBackend("portaudioReceive", { args: ["-r", "portaudio:help"], parse: parsePortaudio });
  registerBackend("coreaudioCapture", { args: ["-s", "coreaudio:help"], parse: parseCoreaudio });
  registerBackend("coreaudioReceive", { args: ["-r", "coreaudio:help"], parse: parseCoreaudio });
  registerBackend("jackCapture", { args: ["-s", "jack:help"], parse: parseJack });
  registerBackend("jackReceive", { args: ["-r", "jack:help"], parse: parseJack });
  registerBackend("wasapiCapture", { args: ["-s", "wasapi:help"], parse: parseWasapi });
  registerBackend("wasapiReceive", { args: ["-r", "wasapi:help"], parse: parseWasapi });
}
const REQUIRED_UG_VERSION = "1.10.3";
const REQUIRED_NATNET_OSC_VERSION = "10.0.0";
const ULTRAGRID_REQUIREMENT = {
  id: "ultragrid",
  label: "UltraGrid",
  requiredVersion: REQUIRED_UG_VERSION,
  downloadUrl: {
    darwin: `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`,
    win32: `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`,
    linux: `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`
  },
  supportedPlatforms: ["darwin", "win32", "linux"]
};
const NATNET_OSC_REQUIREMENT = {
  id: "natnetOsc",
  label: "NatNetFour2OSC",
  requiredVersion: REQUIRED_NATNET_OSC_VERSION,
  downloadUrl: {
    win32: `https://github.com/immersive-arts/NatNetFour2OSC/releases/tag/v${REQUIRED_NATNET_OSC_VERSION}`
  },
  supportedPlatforms: ["win32"]
};
const TOOL_REQUIREMENTS = [
  ULTRAGRID_REQUIREMENT,
  NATNET_OSC_REQUIREMENT
];
const VERSION_PROBE_TIMEOUT_MS = 5e3;
function platformSupported(req) {
  return req.supportedPlatforms.includes(process.platform);
}
function probeVersion(binary, args, regex) {
  return new Promise((resolve) => {
    if (!fs.existsSync(binary)) {
      resolve(null);
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    let child;
    try {
      child = child_process.spawn(binary, args);
    } catch {
      finish(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
      }
      finish(null);
    }, VERSION_PROBE_TIMEOUT_MS);
    child.stdout?.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const text = stdout + "\n" + stderr;
      const m = text.match(regex);
      finish(m ? m[1] : null);
    });
  });
}
function probeUgVersion(path2) {
  return probeVersion(path2, ["--version"], /UltraGrid\s+(\d+\.\d+\.\d+)/i);
}
function probeNatNetVersion(path2) {
  return probeVersion(path2, ["--version"], /v?(\d+\.\d+\.\d+)/);
}
function makeStatus(req, installed, path2, errorMsg) {
  const base = { id: req.id, label: req.label, required: req.requiredVersion };
  if (!platformSupported(req)) {
    return { ...base, installed: null, path: null, status: "unsupported-os" };
  }
  if (errorMsg) {
    return { ...base, installed, path: path2, status: "error", error: errorMsg };
  }
  if (!path2 || !installed) {
    return { ...base, installed: null, path: null, status: "missing" };
  }
  if (installed !== req.requiredVersion) {
    return { ...base, installed, path: path2, status: "version-mismatch" };
  }
  return { ...base, installed, path: path2, status: "ok" };
}
async function checkUg() {
  if (!platformSupported(ULTRAGRID_REQUIREMENT)) {
    return makeStatus(ULTRAGRID_REQUIREMENT, null, null);
  }
  const path2 = resolveUgPath();
  if (!path2) return makeStatus(ULTRAGRID_REQUIREMENT, null, null);
  const installed = await probeUgVersion(path2);
  return makeStatus(ULTRAGRID_REQUIREMENT, installed, path2);
}
async function checkNatNetOsc() {
  if (!platformSupported(NATNET_OSC_REQUIREMENT)) {
    return makeStatus(NATNET_OSC_REQUIREMENT, null, null);
  }
  const settings = loadSettings();
  const path2 = settings.natnetOscPath || null;
  if (!path2 || !fs.existsSync(path2)) {
    return makeStatus(NATNET_OSC_REQUIREMENT, null, null);
  }
  const installed = await probeNatNetVersion(path2);
  return makeStatus(NATNET_OSC_REQUIREMENT, installed, path2);
}
async function runCompatCheck() {
  const tools = await Promise.all([checkUg(), checkNatNetOsc()]);
  const status = {
    ngVersion: electron.app.getVersion(),
    lastCheckedAt: Date.now(),
    tools
  };
  const s = loadSettings();
  saveSettings({
    ...s,
    appVersion: status.ngVersion,
    lastCompatCheckAt: status.lastCheckedAt
  });
  return status;
}
function expectedToolForId(id) {
  return TOOL_REQUIREMENTS.find((r) => r.id === id) ?? null;
}
async function validateToolPath(id, path2) {
  const req = expectedToolForId(id);
  if (!req) {
    return {
      id,
      label: id,
      required: "",
      installed: null,
      path: null,
      status: "error",
      error: `unknown tool: ${id}`
    };
  }
  if (!fs.existsSync(path2)) {
    return makeStatus(req, null, null, `path does not exist: ${path2}`);
  }
  const installed = id === "ultragrid" ? await probeUgVersion(path2) : await probeNatNetVersion(path2);
  return makeStatus(req, installed, path2);
}
let mainWindow = null;
let bus = null;
let deviceRouter = null;
let localPeerId = "";
let localPeerName = "";
let roomName = "";
let roomId = 0;
let localIP = "";
let brokerConnected = false;
let peerJoined = false;
const geoCache = /* @__PURE__ */ new Map();
const retainedTopics = /* @__PURE__ */ new Map();
const RACK_SAVE_DEBOUNCE_MS = 500;
let rackSaveTimer = null;
let rackSaveSuppressed = false;
let compatStatus = null;
function broadcastCompat() {
  if (compatStatus) {
    mainWindow?.webContents.send("compat:status", compatStatus);
  }
}
function currentRackSnapshot() {
  return buildRackSnapshot(retainedTopics, localPeerId);
}
function scheduleRackSave() {
  if (rackSaveSuppressed) return;
  if (rackSaveTimer) clearTimeout(rackSaveTimer);
  rackSaveTimer = setTimeout(() => {
    rackSaveTimer = null;
    try {
      saveRack(currentRackSnapshot());
    } catch {
    }
  }, RACK_SAVE_DEBOUNCE_MS);
}
function flushRackSave() {
  if (rackSaveTimer) {
    clearTimeout(rackSaveTimer);
    rackSaveTimer = null;
  }
  try {
    saveRack(currentRackSnapshot());
  } catch {
  }
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  setLogSink(mainWindow);
  mainWindow.on("closed", () => setLogSink(null));
}
function trackedPublish(retained, topic, ...values) {
  const value = values.join(" ");
  let rackMutated = false;
  if (retained && localPeerId && topic.includes(`/peer/${localPeerId}/`)) {
    if (value !== "") {
      const prev = retainedTopics.get(topic);
      if (prev !== value) {
        retainedTopics.set(topic, value);
        rackMutated = true;
      }
    } else if (retainedTopics.delete(topic)) {
      rackMutated = true;
    }
  }
  const wireValues = values.map((v) => {
    if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
    return v;
  });
  bus.publish(retained, topic, ...wireValues);
  logEvent({ kind: "pub", topic, value, retained: retained === 1 });
  if (rackMutated) scheduleRackSave();
}
function forwardToRenderer(channel) {
  bus.on(channel, (...args) => {
    mainWindow?.webContents.send(channel, ...args);
  });
}
function publishInitSequence() {
  const peerId = localPeerId;
  for (let ch = 0; ch < 20; ch++) {
    trackedPublish(1, topics.channelLoaded(peerId, ch), "0");
  }
  trackedPublish(1, topics.settings(peerId, "lock/enable"), "0");
  const settings = loadSettings();
  const colorTopic = topics.settings(peerId, "background/color");
  const color = retainedTopics.get(colorTopic) || settings.peerColor || generateDefaultColor(peerId);
  trackedPublish(1, colorTopic, ...color.split(" "));
  trackedPublish(1, topics.settings(peerId, "localMenus/textureCaptureRange"), "-default-");
  trackedPublish(1, topics.settings(peerId, "localMenus/ndiRange"), "-default-");
  trackedPublish(1, topics.settings(peerId, "localMenus/portaudioCaptureRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/coreaudioCaptureRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/wasapiCaptureRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/jackCaptureRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/portaudioReceiveRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/coreaudioReceiveRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/wasapiReceiveRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localMenus/jackReceiveRange"), "0");
  trackedPublish(1, topics.settings(peerId, "localProps/ug_enable"), resolveUgPath() ? "1" : "0");
  trackedPublish(1, topics.settings(peerId, "localProps/natnet_enable"), "1");
  trackedPublish(1, topics.settings(peerId, "localProps/stagec_enable"), "1");
  const savedRack = loadRack();
  if (Object.keys(savedRack).length > 0) {
    for (const [tail, value] of Object.entries(savedRack)) {
      if (!isRackEligibleTail(tail)) continue;
      trackedPublish(1, `/peer/${peerId}/${tail}`, value);
    }
  }
}
function generateDefaultColor(peerId) {
  let hash = 0;
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash << 5) - hash + peerId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const r = hslToComponent(hue, 0.6, 0.55, 0);
  const g = hslToComponent(hue, 0.6, 0.55, 8);
  const b = hslToComponent(hue, 0.6, 0.55, 4);
  return `${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)} 1`;
}
function hslToComponent(h, s, l, n) {
  const a = s * Math.min(l, 1 - l);
  const k = (n + h / 30) % 12;
  return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
}
function setupBus() {
  bus = new TBusClient();
  bus.on("peer:id", (id) => {
    localPeerId = id;
  });
  bus.on("peer:room:id", (id) => {
    roomId = id;
    console.log("[bus] peer:room:id =", id);
  });
  bus.on("peer:room:name", (name) => {
    roomName = name;
  });
  bus.on("peer:localIP", (ip) => {
    if (ip) localIP = ip;
  });
  bus.on("broker:connected", (connected) => {
    brokerConnected = connected;
    if (!connected) {
      peerJoined = false;
      roomName = "";
      roomId = 0;
    }
  });
  bus.on("peer:joined", (joined) => {
    peerJoined = joined;
    mainWindow?.webContents.send("peer:joined", joined);
    if (joined) {
      bus.subscribe(topics.settingsSubscribe(localPeerId));
      bus.subscribe(topics.loadedSubscribe(localPeerId));
      deviceRouter = new DeviceRouter(
        bus,
        localPeerId,
        (type, channel) => {
          if (type === 1 || type === 4) {
            return new OscDevice(
              channel,
              localPeerId,
              localIP,
              roomId,
              (retained, topic, value) => trackedPublish(retained, topic, value),
              type,
              (topic) => retainedTopics.has(topic),
              loadSettings().brokerUrl
            );
          }
          if (type === 3) {
            return new NatNetDevice(
              channel,
              localPeerId,
              localIP,
              roomId,
              (retained, topic, value) => trackedPublish(retained, topic, value),
              (topic) => retainedTopics.has(topic),
              loadSettings().brokerUrl
            );
          }
          if (type === 2) {
            return new UltraGridDevice({
              channelIndex: channel,
              peerId: localPeerId,
              localIP,
              roomId,
              publish: (retained, topic, ...values) => trackedPublish(retained, topic, ...values),
              hasRetained: (topic) => retainedTopics.has(topic),
              getSetting: (subpath) => retainedTopics.get(topics.settings(localPeerId, subpath)) ?? null,
              host: loadSettings().brokerUrl,
              resolveBinary: resolveUgPath
            });
          }
          return null;
        },
        (retained, topic, value) => trackedPublish(retained, topic, value)
      );
      publishInitSequence();
      enumerate(
        localPeerId,
        (retained, topic, value) => trackedPublish(retained, topic, value)
      ).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[enumerate] failed: ${message}`);
      });
    }
  });
  bus.on("peers:remote:joined", (info) => {
    bus.subscribe(`/peer/${info.peerId}/#`);
  });
  bus.on("peers:remote:left", (info) => {
    bus.unsubscribe(`/peer/${info.peerId}/#`);
  });
  bus.on("mqtt:message", (msg) => {
    mainWindow?.webContents.send("mqtt:message", msg);
    if (deviceRouter) {
      deviceRouter.onMqttMessage(msg.topic, msg.payload);
    }
    if (localPeerId) {
      if (msg.topic === topics.settings(localPeerId, "background/color") && msg.payload) {
        const s = loadSettings();
        if (s.peerColor !== msg.payload) {
          saveSettings({ ...s, peerColor: msg.payload });
        }
      }
      handleRefreshTrigger(
        localPeerId,
        msg.topic,
        (retained, topic, value) => trackedPublish(retained, topic, value)
      ).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[enumerate] refresh trigger failed: ${message}`);
      });
    }
  });
  const channels = [
    "broker:connected",
    "peer:id",
    "peer:name",
    "peer:localIP",
    "peer:publicIP",
    "peer:room:name",
    "peer:room:id",
    "peer:room:uuid",
    "rooms:clear",
    "rooms:append",
    "rooms:listing",
    "rooms:done",
    "peers:remote:joined",
    "peers:remote:left",
    "peers:clear",
    "peers:append",
    "peers:done",
    "ready",
    "chat"
  ];
  for (const ch of channels) {
    forwardToRenderer(ch);
  }
}
function setupIpcHandlers() {
  electron.ipcMain.on("bus:configure", (_event, config) => {
    bus.configure(config);
  });
  electron.ipcMain.handle("bus:init", async () => {
    return await bus.init();
  });
  electron.ipcMain.handle("bus:connect", () => {
    bus.connect();
  });
  electron.ipcMain.handle("bus:disconnect", () => {
    bus.disconnect();
  });
  electron.ipcMain.handle("bus:join", (_event, peerName, roomName2, roomPwd) => {
    localPeerName = peerName;
    bus.join(peerName, roomName2, roomPwd);
  });
  electron.ipcMain.handle("bus:leave", () => {
    flushRackSave();
    rackSaveSuppressed = true;
    try {
      deviceRouter?.destroyAll();
    } finally {
      rackSaveSuppressed = false;
    }
    bus.leave();
  });
  electron.ipcMain.handle("mqtt:publish", async (_event, payload) => {
    trackedPublish(payload.retain ? 1 : 0, payload.topic, ...payload.value.split(" "));
  });
  electron.ipcMain.handle("mqtt:subscribe", async (_event, topic) => {
    bus.subscribe(topic);
  });
  electron.ipcMain.handle("mqtt:unsubscribe", async (_event, topic) => {
    bus.unsubscribe(topic);
  });
  electron.ipcMain.handle("bus:localPeer", () => {
    return { peerId: localPeerId, peerName: localPeerName, localIP, roomId };
  });
  electron.ipcMain.handle("bus:state", () => {
    return {
      connected: brokerConnected,
      joined: peerJoined,
      peerName: localPeerName,
      roomName,
      roomId
    };
  });
  electron.ipcMain.handle("settings:load", () => {
    return loadSettings();
  });
  electron.ipcMain.handle("settings:save", (_event, settings) => {
    saveSettings(settings);
  });
  electron.ipcMain.handle("log:get", () => {
    return getLogBuffer();
  });
  electron.ipcMain.handle("log:clear", () => {
    clearLogBuffer();
  });
  electron.ipcMain.handle("compat:get-status", async () => {
    if (!compatStatus) compatStatus = await runCompatCheck();
    return compatStatus;
  });
  electron.ipcMain.handle("compat:recheck", async () => {
    compatStatus = await runCompatCheck();
    broadcastCompat();
    return compatStatus;
  });
  electron.ipcMain.handle("compat:locate", async (_event, toolId) => {
    if (!mainWindow) return null;
    const isUg = toolId === "ultragrid";
    const filters = process.platform === "darwin" && isUg ? [{ name: "UltraGrid app", extensions: ["app"] }] : process.platform === "win32" ? [{ name: "Executable", extensions: ["exe"] }] : [{ name: "All files", extensions: ["*"] }];
    const defaultPath = process.platform === "darwin" ? "/Applications" : process.platform === "win32" ? process.env["ProgramFiles"] || "C:\\Program Files" : "/usr/local/bin";
    const result = await electron.dialog.showOpenDialog(mainWindow, {
      title: `Locate ${isUg ? "UltraGrid" : "NatNetFour2OSC"}`,
      defaultPath,
      properties: ["openFile"],
      filters
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    let picked = result.filePaths[0];
    if (process.platform === "darwin" && isUg && picked.endsWith(".app")) {
      const inner = path.join(picked, "Contents", "MacOS", "uv");
      if (fs.existsSync(inner)) picked = inner;
    }
    const validated = await validateToolPath(toolId, picked);
    if (validated.status === "ok" || validated.status === "version-mismatch") {
      const s = loadSettings();
      if (toolId === "ultragrid") saveSettings({ ...s, ugPath: picked });
      else saveSettings({ ...s, natnetOscPath: picked });
    }
    compatStatus = await runCompatCheck();
    broadcastCompat();
    return compatStatus;
  });
  electron.ipcMain.handle("compat:open-download", async (_event, toolId) => {
    const req = TOOL_REQUIREMENTS.find((r) => r.id === toolId);
    if (!req) return false;
    const url = req.downloadUrl[process.platform];
    if (!url) return false;
    await electron.shell.openExternal(url);
    return true;
  });
  electron.ipcMain.handle("compat:reveal-tools-folder", async () => {
    const dir = electron.app.getPath("userData");
    await electron.shell.openPath(dir);
    return dir;
  });
  electron.ipcMain.handle("settings:get-path", () => {
    return path.join(electron.app.getPath("userData"), "settings.json");
  });
  electron.ipcMain.handle("settings:reveal", () => {
    const path$1 = path.join(electron.app.getPath("userData"), "settings.json");
    if (fs.existsSync(path$1)) {
      electron.shell.showItemInFolder(path$1);
    } else {
      electron.shell.openPath(electron.app.getPath("userData"));
    }
    return path$1;
  });
  electron.ipcMain.handle("settings:open-in-editor", async () => {
    const path$1 = path.join(electron.app.getPath("userData"), "settings.json");
    if (!fs.existsSync(path$1)) return null;
    const err = await electron.shell.openPath(path$1);
    return err ? { error: err } : { ok: true };
  });
  electron.ipcMain.handle("geo:lookup", async (_event, ip) => {
    const key = ip || "";
    if (geoCache.has(key)) return geoCache.get(key);
    try {
      const url = ip ? `http://ip-api.com/json/${ip}` : "http://ip-api.com/json/";
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      geoCache.set(key, data);
      return data;
    } catch {
      return null;
    }
  });
}
electron.app.whenReady().then(async () => {
  registerDefaultBackends();
  setupBus();
  setupIpcHandlers();
  const ips = await bus.init();
  const firstIp = Object.values(ips).find((v) => v?.address);
  if (firstIp && !localIP) {
    localIP = firstIp.address;
  }
  console.log("Internal IPs:", ips);
  console.log("Local IP:", localIP);
  console.log("PeerId:", bus.peerId);
  createWindow();
  runCompatCheck().then((status) => {
    compatStatus = status;
    broadcastCompat();
  }).catch((err) => {
    console.warn("[compat] initial check failed:", err);
  });
  if (process.platform === "darwin") {
    mainWindow.on("close", (e) => {
      if (!isShuttingDown) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
let isShuttingDown = false;
electron.app.on("before-quit", (e) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  e.preventDefault();
  flushRackSave();
  rackSaveSuppressed = true;
  if (bus) {
    performShutdown(bus, deviceRouter, [...retainedTopics.keys()]);
  }
  setTimeout(() => electron.app.exit(0), 500);
});
