"use strict";
const electron = require("electron");
const path = require("path");
const events = require("events");
const fs = require("fs");
const dgram = require("dgram");
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
  settingsVersion: 1
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
class DeviceRouter {
  handlers = /* @__PURE__ */ new Map();
  ownPeerId;
  bus;
  handlerFactory;
  constructor(bus2, ownPeerId, handlerFactory) {
    this.bus = bus2;
    this.ownPeerId = ownPeerId;
    this.handlerFactory = handlerFactory;
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
      this.bus.publish(1, t, "");
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
class OscDevice {
  channelIndex;
  deviceType;
  peerId;
  localIP;
  localPorts;
  roomPorts;
  publishedTopics = [];
  publish;
  hasRetained;
  enabled = false;
  enableTwo = false;
  outputIPOne;
  outputIPTwo;
  // local→room: binds on local inputPort, forwards to room proxy inputPort
  sendSocket = null;
  // room→local: binds on room outputPortOne, forwards to local outputPortOne/Two
  recvSocket = null;
  _isRunning = false;
  get isRunning() {
    return this._isRunning;
  }
  constructor(channelIndex, peerId, localIP2, roomId2, publish, deviceType = 1, hasRetained = () => false) {
    this.channelIndex = channelIndex;
    this.deviceType = deviceType;
    this.peerId = peerId;
    this.localIP = localIP2;
    this.localPorts = allocateLocalPorts(channelIndex);
    this.roomPorts = allocateRoomPorts(roomId2, channelIndex);
    this.publish = publish;
    this.hasRetained = hasRetained;
    this.outputIPOne = localIP2;
    this.outputIPTwo = localIP2;
  }
  publishDefaults() {
    const pub = (field, value) => {
      const topic = this.isLocaludp(field) ? topics.localudp(this.peerId, this.channelIndex, field) : this.isMonitor(field) ? topics.monitor(this.peerId, this.channelIndex, field) : topics.deviceGui(this.peerId, this.channelIndex, field);
      this.publishedTopics.push(topic);
      if (this.hasRetained(topic)) return;
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
        if (value === "1" && !this.enabled) ;
        break;
    }
  }
  handleEnable(enable) {
    if (enable && !this.enabled) {
      this.enabled = true;
      this.startRelay();
    } else if (!enable && this.enabled) {
      this.enabled = false;
      this.stopRelay();
    }
  }
  startRelay() {
    try {
      this.sendSocket = dgram__namespace.createSocket({ type: "udp4", reuseAddr: true });
      this.sendSocket.on("message", (msg) => {
        this.sendSocket.send(msg, 0, msg.length, this.roomPorts.inputPort, this.localIP);
      });
      this.sendSocket.bind(this.localPorts.inputPort, this.localIP);
      this.sendSocket.on("error", (err) => {
        console.error(`[OSC ch.${this.channelIndex}] send socket error:`, err.message);
        this.disableOnError();
      });
      this.recvSocket = dgram__namespace.createSocket({ type: "udp4", reuseAddr: true });
      this.recvSocket.on("message", (msg) => {
        this.recvSocket.send(msg, 0, msg.length, this.localPorts.outputPortOne, this.outputIPOne);
        if (this.enableTwo) {
          this.recvSocket.send(msg, 0, msg.length, this.localPorts.outputPortTwo, this.outputIPTwo);
        }
      });
      this.recvSocket.bind(this.roomPorts.outputPortOne, this.localIP, () => {
        this._isRunning = true;
      });
      this.recvSocket.on("error", (err) => {
        console.error(`[OSC ch.${this.channelIndex}] recv socket error:`, err.message);
        this.disableOnError();
      });
    } catch (err) {
      console.error(`[OSC ch.${this.channelIndex}] failed to start relay:`, err.message);
      this.disableOnError();
    }
  }
  disableOnError() {
    this.stopRelay();
    this.publish(1, topics.deviceGui(this.peerId, this.channelIndex, "enable"), "0");
  }
  stopRelay() {
    if (this.sendSocket) {
      try {
        this.sendSocket.close();
      } catch {
      }
      this.sendSocket = null;
    }
    if (this.recvSocket) {
      try {
        this.recvSocket.close();
      } catch {
      }
      this.recvSocket = null;
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
const retainedTopics = /* @__PURE__ */ new Map();
const RACK_SAVE_DEBOUNCE_MS = 500;
let rackSaveTimer = null;
function currentRackSnapshot() {
  return buildRackSnapshot(retainedTopics, localPeerId);
}
function scheduleRackSave() {
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
  bus.publish(retained, topic, ...values);
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
  const color = settings.peerColor || generateDefaultColor(peerId);
  trackedPublish(1, topics.settings(peerId, "background/color"), color);
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
  trackedPublish(1, topics.settings(peerId, "localProps/ug_enable"), "0");
  trackedPublish(1, topics.settings(peerId, "localProps/natnet_enable"), "0");
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
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} 1`;
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
              (topic) => retainedTopics.has(topic)
            );
          }
          return null;
        }
      );
      publishInitSequence();
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
    bus.leave();
  });
  electron.ipcMain.handle("mqtt:publish", async (_event, retained, topic, ...values) => {
    trackedPublish(retained ? 1 : 0, topic, ...values);
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
}
electron.app.whenReady().then(async () => {
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
  if (bus) {
    performShutdown(bus, deviceRouter, [...retainedTopics.keys()]);
  }
  setTimeout(() => electron.app.exit(0), 500);
});
