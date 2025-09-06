// Minimal, hardened bridge for renderer access.
const { contextBridge, ipcRenderer, shell, clipboard } = require('electron');

function buildAPI() {
  return {
    ipcRenderer: {
      send: (channel, ...args) => ipcRenderer.send(channel, ...args),
      invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
      on: (channel, listener) => ipcRenderer.on(channel, listener),
      once: (channel, listener) => ipcRenderer.once(channel, listener),
      removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    },
    shell: {
      openExternal: (url) => shell.openExternal(url),
      openPath: (p) => shell.openPath(p),
      showItemInFolder: (p) => shell.showItemInFolder(p),
    },
    clipboard: {
      readText: () => clipboard.readText(),
      writeText: (text) => clipboard.writeText(text),
    },
  };
}

const api = buildAPI();

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electron', api);
  } else {
    // When contextIsolation is disabled, directly attach to window
    // eslint-disable-next-line no-undef
    window.electron = api;
  }
} catch (e) {
  try {
    // eslint-disable-next-line no-undef
    window.electron = api;
  } catch (_) {}
}
