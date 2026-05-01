"use strict";
const electron = require("electron");
const SEND_CHANNELS = ["bus:configure"];
const INVOKE_CHANNELS = [
  "bus:init",
  "bus:connect",
  "bus:disconnect",
  "bus:join",
  "bus:leave",
  "bus:localPeer",
  "bus:state",
  "mqtt:publish",
  "mqtt:subscribe",
  "mqtt:unsubscribe",
  "settings:load",
  "settings:save",
  "settings:get-path",
  "settings:reveal",
  "settings:open-in-editor",
  "log:get",
  "log:clear",
  "geo:lookup",
  "compat:get-status",
  "compat:recheck",
  "compat:locate",
  "compat:open-download",
  "compat:reveal-tools-folder"
];
const RECEIVE_CHANNELS = [
  "broker:connected",
  "peer:joined",
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
  "mqtt:message",
  "chat",
  "log:entry",
  "compat:status",
  "bus:error"
];
electron.contextBridge.exposeInMainWorld("api", {
  send(channel, ...args) {
    if (SEND_CHANNELS.includes(channel)) {
      electron.ipcRenderer.send(channel, ...args);
    }
  },
  invoke(channel, ...args) {
    if (INVOKE_CHANNELS.includes(channel)) {
      return electron.ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel ${channel} not allowed`));
  },
  on(channel, callback) {
    if (RECEIVE_CHANNELS.includes(channel)) {
      electron.ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  removeAllListeners(channel) {
    electron.ipcRenderer.removeAllListeners(channel);
  }
});
