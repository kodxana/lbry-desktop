// A small shim so renderer code can keep importing from 'electron'.
// Internally proxies to the preload-exposed API (window.electron) if available,
// else falls back to the real 'electron' module (legacy, when nodeIntegration=true).

let shimIpc, shimShell, shimClipboard;

try {
  if (typeof window !== 'undefined' && window.electron) {
    shimIpc = window.electron.ipcRenderer;
    shimShell = window.electron.shell;
    shimClipboard = window.electron.clipboard;
  }
} catch (e) {
  // ignore
}

if (!shimIpc || !shimShell || !shimClipboard) {
  try {
    // Legacy fallback; only works if nodeIntegration is enabled.
    const realElectron = require('electron');
    shimIpc = realElectron.ipcRenderer;
    shimShell = realElectron.shell;
    shimClipboard = realElectron.clipboard;
  } catch (e) {
    // Create safe no-ops in environments where neither is available.
    shimIpc = {
      send: () => {},
      invoke: async () => undefined,
      on: () => {},
      once: () => {},
      removeListener: () => {},
      removeAllListeners: () => {},
    };
    shimShell = {
      openExternal: async () => '',
      openPath: async () => '',
      showItemInFolder: () => {},
    };
    shimClipboard = {
      readText: () => '',
      writeText: () => {},
    };
  }
}

module.exports = {
  ipcRenderer: shimIpc,
  shell: shimShell,
  clipboard: shimClipboard,
};
