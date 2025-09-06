/* eslint no-console:0 */
/* eslint space-before-function-paren:0 */
// Module imports
import '@babel/polyfill';
import SemVer from 'semver';
import https from 'https';
import { app, dialog, ipcMain, session, shell, BrowserWindow, Menu, clipboard } from 'electron';
import { autoUpdater } from 'electron-updater';
import Lbry from 'lbry';
import LbryFirstInstance from './LbryFirstInstance';
import Daemon from './Daemon';
import isDev from 'electron-is-dev';
import createTray from './createTray';
import createWindow from './createWindow';
import pjson from '../package.json';
import startSandbox from './startSandbox';
import installDevtools from './installDevtools';
import fs from 'fs';
import path from 'path';
import { diskSpaceLinux, diskSpaceWindows, diskSpaceMac } from '../ui/util/diskspace';

const { download } = require('electron-dl');
const mime = require('mime');
const os = require('os');
const sudo = require('sudo-prompt');
const probe = require('ffmpeg-probe');
const { execSync, spawn } = require('child_process');
const MAX_IPC_SEND_BUFFER_SIZE = 500000000; // large files crash when serialized for ipc message

const filePath = path.join(process.resourcesPath, 'static', 'upgradeDisabled');
let upgradeDisabled;
try {
  fs.accessSync(filePath, fs.constants.R_OK);
  upgradeDisabled = true;
} catch (err) {
  upgradeDisabled = false;
}
autoUpdater.autoDownload = !upgradeDisabled;
autoUpdater.allowPrerelease = false;

const UPDATE_STATE_INIT = 0;
const UPDATE_STATE_CHECKING = 1;
const UPDATE_STATE_UPDATES_FOUND = 2;
const UPDATE_STATE_NO_UPDATES_FOUND = 3;
const UPDATE_STATE_DOWNLOADING = 4;
const UPDATE_STATE_DOWNLOADED = 5;
let updateState = UPDATE_STATE_INIT;
let updateDownloadItem;

const isAutoUpdateSupported = ['win32', 'darwin'].includes(process.platform) || !!process.env.APPIMAGE;

// This is used to keep track of whether we are showing the special dialog
// that we show on Windows after you decline an upgrade and close the app later.
let showingAutoUpdateCloseAlert = false;

// Keep a global reference, if you don't, they will be closed automatically when the JavaScript
// object is garbage collected.
let rendererWindow;

let tray; // eslint-disable-line
let daemon;
let lbryFirst;

const appState = {};
const PROTOCOL = 'lbry';

if (isDev && process.platform === 'win32') {
  // Setting this is required to get this working in dev mode.
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else if (process.platform !== 'linux') {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

app.name = 'LBRY';
app.setAppUserModelId('io.lbry.LBRY');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
// Only relax Blink CORS in development if truly required.
if (isDev) {
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
}

if (isDev) {
  // Disable security warnings in dev mode:
  // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#electron-security-warnings
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;
}

function hasLbrynetProcess() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /FI "IMAGENAME eq lbrynet.exe" /FO CSV /NH', { encoding: 'utf8' });
      return /lbrynet\.exe/i.test(out);
    }
    // macOS / Linux
    const out = execSync('pgrep -x lbrynet || true', { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch (e) {
    return false;
  }
}

function waitForDaemonReady(timeoutMs = 15000, intervalMs = 500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      Lbry.status()
        .then(() => resolve(true))
        .catch(() => {
          if (Date.now() - started >= timeoutMs) return resolve(false);
          setTimeout(tick, intervalMs);
        });
    };
    tick();
  });
}

const startDaemon = async () => {
  let isDaemonRunning = false;

  await Lbry.status()
    .then(() => {
      isDaemonRunning = true;
      console.log('SDK already running');
    })
    .catch(() => {
      console.log('SDK not reachable on first attempt');
    });

  if (!isDaemonRunning && hasLbrynetProcess()) {
    let choice = 0; // 0 = continue, 1 = restart
    try {
      choice = dialog.showMessageBoxSync({
        type: 'question',
        buttons: ['Continue', 'Restart SDK'],
        defaultId: 0,
        cancelId: 0,
        title: 'LBRY SDK Running',
        message: 'An existing LBRY SDK (lbrynet) instance is already running. Connect to it or restart the SDK?',
      });
    } catch (e) {}

    if (choice === 1) {
      try {
        await Lbry.stop();
      } catch (e) {
        try {
          if (process.platform === 'win32') {
            execSync('taskkill /IM lbrynet.exe /T /F');
          } else {
            execSync('pkill -f lbrynet');
          }
        } catch (_) {}
      }
    } else {
      console.log('Detected existing lbrynet process; waiting for readiness...');
      isDaemonRunning = await waitForDaemonReady(15000, 500);
      if (isDaemonRunning) {
        if (rendererWindow) rendererWindow.webContents.send('daemon-reused');
        console.log('Connected to existing lbrynet instance.');
      } else {
        console.log('Existing lbrynet did not respond in time; attempting fresh launch.');
      }
    }
  }

  if (!isDaemonRunning) {
    daemon = new Daemon();
    daemon.on('exit', () => {
      if (!isDev) {
        daemon = null;
        if (!appState.isQuitting) {
          dialog.showErrorBox(
            'Daemon has Exited',
            'The daemon may have encountered an unexpected error, or another daemon instance is already running. \n\n' +
              'For more information please visit: \n' +
              'https://lbry.com/faq/startup-troubleshooting'
          );
        }
        app.quit();
      }
    });
    await daemon.launch();
  }
};

let isLbryFirstRunning = false;
const startLbryFirst = async () => {
  if (isLbryFirstRunning) {
    console.log('LbryFirst already running');
    handleLbryFirstLaunched();
    return;
  }

  console.log('LbryFirst: Starting...');

  try {
    lbryFirst = new LbryFirstInstance();
    lbryFirst.on('exit', (e) => {
      if (!isDev) {
        lbryFirst = null;
        isLbryFirstRunning = false;
        if (!appState.isQuitting) {
          dialog.showErrorBox(
            'LbryFirst has Exited',
            'The lbryFirst may have encountered an unexpected error, or another lbryFirst instance is already running. \n\n',
            e
          );
        }
        app.quit();
      }
    });
  } catch (e) {
    console.log('LbryFirst: Failed to create new instance\n\n', e);
  }

  console.log('LbryFirst: Running...');

  try {
    await lbryFirst.launch();
    handleLbryFirstLaunched();
  } catch (e) {
    isLbryFirstRunning = false;
    console.log('LbryFirst: Failed to start\n', e);
  }
};

const handleLbryFirstLaunched = () => {
  isLbryFirstRunning = true;
  rendererWindow.webContents.send('lbry-first-launched');
};

// When we are starting the app, ensure there are no other apps already running
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  // Another instance already has a lock, abort
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // Send the url to the app to navigate first, then focus
    if (rendererWindow) {
      // External uri (last item on argv):
      const EXTERNAL_URI = argv.length ? argv[argv.length - 1] : '';
      // Handle protocol requests for windows and linux
      const platforms = process.platform === 'win32' || process.platform === 'linux';
      // Is LBRY protocol
      const isProtocolURI = String(EXTERNAL_URI).startsWith(PROTOCOL + '://');
      // External protocol requested:
      if (platforms && isProtocolURI) {
        let URI = EXTERNAL_URI;
        // Keep only command line / deep linked arguments
        // Windows normalizes URIs when they're passed in from other apps. On Windows, this tries to
        // restore the original URI that was typed.
        //   - If the URI has no path, Windows adds a trailing slash. LBRY URIs can't have a slash with no
        //     path, so we just strip it off.
        //   - In a URI with a claim ID, like lbry://channel#claimid, Windows interprets the hash mark as
        //     an anchor and converts it to lbry://channel/#claimid. We remove the slash here as well.
        //   - ? also interpreted as an anchor, remove slash also.
        if (process.platform === 'win32') {
          URI = URI.replace(/\/$/, '').replace('/#', '#').replace('/?', '?');
        }

        rendererWindow.webContents.send('open-uri-requested', URI);
      }

      rendererWindow.show();
    }
  });

  app.on('ready', async () => {
    await startDaemon();
    startSandbox();

    if (isDev && process.env.ELECTRON_DEVTOOLS === 'true') {
      try {
        await installDevtools();
      } catch (e) {
        // ignore devtools install errors by default
      }
    }
    rendererWindow = createWindow(appState);
    tray = createTray(rendererWindow);

    if (isDev) {
      try {
        rendererWindow.webContents.openDevTools({ mode: 'detach' });
      } catch (e) {}
      // Last-resort visibility fallback in dev
      setTimeout(() => {
        try {
          if (!rendererWindow.isVisible()) rendererWindow.show();
        } catch (e) {}
      }, 2000);
    }

    if (!isDev) {
      rendererWindow.webContents.on('devtools-opened', () => {
        // Send a message to the renderer process so we can log a security warning
        rendererWindow.webContents.send('devtools-is-opened');
      });
    }

    // If an "Origin" header is passed, the SDK will check that it is set to allow that origin in the daemon_settings.yml
    // By default, electron sends http://localhost:{port} as the origin for POST requests
    // https://github.com/electron/electron/issues/7931#issuecomment-361759277
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.method === 'POST' && details.requestHeaders['Content-Type'] === 'application/json-rpc') {
        delete details.requestHeaders['Origin'];
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  });
}

app.on('activate', () => {
  if (rendererWindow) {
    rendererWindow.show();
  }
});

app.on('will-quit', (event) => {
  if (
    process.platform === 'win32' &&
    updateState === UPDATE_STATE_DOWNLOADED &&
    isAutoUpdateSupported &&
    !appState.autoUpdateAccepted &&
    !showingAutoUpdateCloseAlert
  ) {
    // We're on Win and have an update downloaded, but the user declined it (or closed
    // the app without accepting it). Now the user is closing the app, so the new update
    // will install. On Mac this is silent, but on Windows they get a confusing permission
    // escalation dialog, so we show Windows users a warning dialog first.

    showingAutoUpdateCloseAlert = true;
    dialog
      .showMessageBox({
        type: 'info',
        title: 'LBRY Will Upgrade',
        message:
          'LBRY has a pending upgrade. Please select "Yes" to install it on the prompt shown after this one.',
      })
      .then(() => {
        app.quit();
      })
      .catch(() => {
        app.quit();
      });

    event.preventDefault();
    return;
  }

  appState.isQuitting = true;

  if (daemon) {
    daemon.quit();
    event.preventDefault();
  }
  if (lbryFirst) {
    lbryFirst.quit();
    event.preventDefault();
  }

  if (rendererWindow) {
    tray.destroy();
    rendererWindow = null;
  }
});

app.on('will-finish-launching', () => {
  // Protocol handler for macOS
  app.on('open-url', (event, URL) => {
    event.preventDefault();

    if (rendererWindow) {
      rendererWindow.webContents.send('open-uri-requested', URL);
      rendererWindow.show();
    } else {
      appState.macDeepLinkingURI = URL;
    }
  });
});

app.on('before-quit', () => {
  appState.isQuitting = true;
});

// Get the content of a file as a raw buffer of bytes.
// Useful to convert a file path to a File instance.
// Example:
// const result = await ipcMain.invoke('get-file-from-path', 'path/to/file');
// const file = new File([result.buffer], result.name);
// NOTE: if path points to a folder, an empty
// file will be given.
ipcMain.handle('get-file-from-path', (event, path, readContents = true) => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      // Separate folders considering "\" and "/"
      // as separators (cross platform)
      const folders = path.split(/[\\/]/);
      const name = folders[folders.length - 1];
      if (stats.isDirectory()) {
        resolve({
          name,
          mime: undefined,
          path,
          buffer: new ArrayBuffer(0),
        });
        return;
      }
      if (!readContents) {
        resolve({
          name,
          mime: mime.getType(name) || undefined,
          path,
          buffer: new ArrayBuffer(0),
        });
        return;
      }
      // Encoding null ensures data results in a Buffer.
      fs.readFile(path, { encoding: null }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          name,
          mime: mime.getType(name) || undefined,
          path,
          buffer: data,
        });
      });
    });
  });
});

ipcMain.handle('get-file-details-from-path', async (event, path) => {
  const isFfMp4 = (ffprobeResults) => {
    return (
      ffprobeResults &&
      ffprobeResults.format &&
      ffprobeResults.format.format_name &&
      ffprobeResults.format.format_name.includes('mp4')
    );
  };
  const folders = path.split(/[\\/]/);
  const name = folders[folders.length - 1];
  let duration = 0,
    size = 0,
    mimeType;
  try {
    await fs.promises.stat(path);
    let ffprobeResults;
    try {
      ffprobeResults = await probe(path);
      duration = ffprobeResults.format.duration;
      size = ffprobeResults.format.size;
    } catch (e) {}
    let fileReadResult;
    if (size < MAX_IPC_SEND_BUFFER_SIZE) {
      try {
        fileReadResult = await fs.promises.readFile(path);
      } catch (e) {}
    }
    // TODO: use mmmagic to inspect file and get mime type
    mimeType = isFfMp4(ffprobeResults) ? 'video/mp4' : mime.getType(name);
    const fileData = { name, mime: mimeType || undefined, path, duration: duration, size, buffer: fileReadResult };
    return fileData;
  } catch (e) {
    // no stat
    return { error: 'no file' };
  }
});

ipcMain.on('get-disk-space', async (event) => {
  try {
    const { data_dir } = await Lbry.settings_get();
    let diskSpace;
    switch (os.platform()) {
      case 'linux':
        diskSpace = await diskSpaceLinux(data_dir);
        break;
      case 'darwin':
        diskSpace = await diskSpaceMac(data_dir);
        break;
      case 'win32':
        diskSpace = await diskSpaceWindows(data_dir);
        break;
      default:
        throw new Error('unknown platform');
    }
    rendererWindow.webContents.send('send-disk-space', { diskSpace });
  } catch (e) {
    rendererWindow.webContents.send('send-disk-space', { error: e.message || e });
    console.log('Failed to get disk space', e);
  }
});

ipcMain.on('version-info-requested', () => {
  function formatRc(ver) {
    // Adds dash if needed to make RC suffix SemVer friendly
    return ver.replace(/([^-])rc/, '$1-rc');
  }

  const localVersion = pjson.version;
  let result = '';
  const onSuccess = (res) => {
    res.on('data', (data) => {
      result += data;
    });

    res.on('end', () => {
      let json;
      try {
        json = JSON.parse(result);
      } catch (e) {
        return;
      }
      const tagName = json.tag_name;
      if (tagName) {
        const [, remoteVersion] = tagName.match(/^v([\d.]+(?:-?rc\d+)?)$/);
        if (!remoteVersion) {
          if (rendererWindow) {
            rendererWindow.webContents.send('version-info-received', localVersion);
          }
        } else {
          const upgradeAvailable = SemVer.gt(formatRc(remoteVersion), formatRc(localVersion));
          if (rendererWindow) {
            rendererWindow.webContents.send('version-info-received', {
              remoteVersion,
              localVersion,
              upgradeAvailable,
            });
          }
        }
      } else if (rendererWindow) {
        rendererWindow.webContents.send('version-info-received', { localVersion });
      }
    });
  };

  const requestLatestRelease = (alreadyRedirected = false) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: '/repos/lbryio/lbry-desktop/releases/latest',
        headers: { 'user-agent': `LBRY/${localVersion}` },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          requestLatestRelease(res.headers.location, true);
        } else {
          onSuccess(res);
        }
      }
    );

    if (alreadyRedirected) return;
    req.on('error', (err) => {
      console.log('Failed to get current version from GitHub. Error:', err);
      if (rendererWindow) {
        rendererWindow.webContents.send('version-info-received', null);
      }
    });
  };

  if (upgradeDisabled && rendererWindow) {
    rendererWindow.webContents.send('version-info-received', { localVersion });
    return;
  }

  requestLatestRelease();
});

ipcMain.on('launch-lbry-first', async () => {
  try {
    await startLbryFirst();
  } catch (e) {
    console.log('Failed to start LbryFirst');
    console.log(e);
  }
});

process.on('uncaughtException', (error) => {
  console.log(error);
  dialog.showErrorBox('Error Encountered', `Caught error: ${error}`);
  appState.isQuitting = true;
  if (daemon) daemon.quit();
  app.exit(1);
});

// Auto updater
autoUpdater.on('download-progress', () => {
  updateState = UPDATE_STATE_DOWNLOADING;
});

autoUpdater.on('update-downloaded', () => {
  updateState = UPDATE_STATE_DOWNLOADED;

  // If this download was trigger by
  // autoUpdateAccepted it means, the user
  // wants to install the new update but
  // needed to downloaded the files first.
  if (appState.autoUpdateAccepted) {
    autoUpdater.quitAndInstall();
  }
  if (rendererWindow) {
    rendererWindow.webContents.send('update-downloaded');
  }
});

autoUpdater.on('update-available', () => {
  if (updateState === UPDATE_STATE_DOWNLOADING) {
    return;
  }
  updateState = UPDATE_STATE_UPDATES_FOUND;
  if (rendererWindow) {
    rendererWindow.webContents.send('update-available');
  }
});

autoUpdater.on('update-not-available', () => {
  updateState = UPDATE_STATE_NO_UPDATES_FOUND;
  if (rendererWindow) {
    rendererWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', () => {
  if (updateState === UPDATE_STATE_DOWNLOADING) {
    updateState = UPDATE_STATE_UPDATES_FOUND;
    return;
  }
  updateState = UPDATE_STATE_INIT;
  if (rendererWindow) {
    rendererWindow.webContents.send('update-error');
  }
});

// Manual (.deb) update
ipcMain.on('cancel-download-upgrade', () => {
  if (updateDownloadItem) {
    // Cancel the download and execute the onCancel
    // callback set in the options.
    updateDownloadItem.cancel();
  }
});

ipcMain.on('download-upgrade', (event, params) => {
  if (updateState !== UPDATE_STATE_UPDATES_FOUND) {
    return;
  }
  if (isAutoUpdateSupported) {
    updateState = UPDATE_STATE_DOWNLOADING;
    autoUpdater.downloadUpdate();
    return;
  }

  const { url, options } = params;
  const dir = fs.mkdtempSync(app.getPath('temp') + path.sep);

  updateState = UPDATE_STATE_DOWNLOADING;

  // Grab the download item's handler to allow
  // cancelling the operation if required.
  options.onStarted = function (downloadItem) {
    updateDownloadItem = downloadItem;
  };
  options.onCancel = function () {
    updateState = UPDATE_STATE_UPDATES_FOUND;
    updateDownloadItem = undefined;
  };
  options.onProgress = function (p) {
    rendererWindow.webContents.send('download-progress-update', p);
  };
  options.onCompleted = function (c) {
    updateState = UPDATE_STATE_DOWNLOADED;
    updateDownloadItem = undefined;
    rendererWindow.webContents.send('download-update-complete', c);
  };
  options.directory = dir;
  const win = BrowserWindow.getFocusedWindow();
  download(win, url, options).catch((e) => {
    updateState = UPDATE_STATE_UPDATES_FOUND;
    console.log('e', e);
  });
});

// Update behavior
ipcMain.on('autoUpdateAccepted', () => {
  appState.autoUpdateAccepted = true;

  // quitAndInstall can only be called if the
  // update has been downloaded. Since the user
  // can disable auto updates, we have to make
  // sure it has been downloaded first.
  if (updateState === UPDATE_STATE_DOWNLOADED) {
    autoUpdater.quitAndInstall();
    return;
  }

  if (updateState !== UPDATE_STATE_UPDATES_FOUND) {
    return;
  }

  // If the update hasn't been downloaded,
  // start downloading it. After it's done, the
  // event 'update-downloaded' will be triggered,
  // where we will be able to resume the
  // update installation.
  updateState = UPDATE_STATE_DOWNLOADING;
  autoUpdater.downloadUpdate();
});

ipcMain.on('check-for-updates', (event, autoDownload) => {
  if (![UPDATE_STATE_INIT, UPDATE_STATE_NO_UPDATES_FOUND].includes(updateState)) {
    return;
  }

  updateState = UPDATE_STATE_CHECKING;

  // If autoDownload is true, checkForUpdates will begin the
  // download automatically.
  if (autoDownload) {
    updateState = UPDATE_STATE_DOWNLOADING;
  }

  autoUpdater.autoDownload = autoDownload;
  autoUpdater.checkForUpdates();
});

ipcMain.on('upgrade', (event, installerPath) => {
  // what to do if no shutdown in a long time?
  console.log('Update downloaded to', installerPath);
  console.log('The app will close and you will be prompted to install the latest version of LBRY.');
  console.log('After the install is complete, please reopen the app.');

  // Prevent .deb package from opening with archive manager (Ubuntu >= 20)
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    sudo.exec(`dpkg -i ${installerPath}`, { name: app.name }, (err, stdout, stderr) => {
      if (err || stderr) {
        rendererWindow.webContents.send('upgrade-installing-error');
        return;
      }

      // Re-launch the application when the installation finishes.
      app.relaunch();
      app.quit();
    });

    return;
  }

  app.on('quit', () => {
    console.log('Launching upgrade installer at', installerPath);
    // This gets triggered called after *all* other quit-related events, so
    // we'll only get here if we're fully prepared and quitting for real.
    shell.openPath(installerPath);
  });
  app.quit();
});

// IPC helpers for renderer
ipcMain.handle('get-app-locale', () => app.getLocale());

ipcMain.handle('get-path', (event, key) => {
  const allowed = new Set(['home', 'downloads', 'documents', 'desktop', 'temp']);
  if (!allowed.has(key)) return undefined;
  try {
    return app.getPath(key);
  } catch (e) {
    return undefined;
  }
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender) || rendererWindow;
  return dialog.showOpenDialog(win, options);
});

ipcMain.on('set-full-screen', (event, flag) => {
  const win = BrowserWindow.fromWebContents(event.sender) || rendererWindow;
  if (win) win.setFullScreen(!!flag);
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || rendererWindow;
  if (win && !win.isMaximized()) win.maximize();
});

ipcMain.on('inspect-element', (event, pos) => {
  if (!isDev) return;
  const win = BrowserWindow.fromWebContents(event.sender) || rendererWindow;
  if (win && pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
    try {
      win.inspectElement(pos.x, pos.y);
    } catch (e) {}
  }
});

ipcMain.on('app-quit', () => {
  app.quit();
});

ipcMain.on('focusWindow', () => {
  const win = rendererWindow || BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

ipcMain.on('set-allow-prerelease', (event, value) => {
  autoUpdater.allowPrerelease = !!value;
});

// Diagnostics: expose lightweight SDK info to renderer
ipcMain.handle('get-daemon-status', async () => {
  try {
    const st = await Lbry.status();
    let peerCount = undefined;
    const conns = st && st.connections;
    if (Array.isArray(conns)) {
      peerCount = conns.length;
    } else if (conns && typeof conns === 'object') {
      const incoming = Array.isArray(conns.incoming) ? conns.incoming.length : 0;
      const outgoing = Array.isArray(conns.outgoing) ? conns.outgoing.length : 0;
      const connected = Array.isArray(conns.connected) ? conns.connected.length : 0;
      peerCount = Math.max(connected, incoming + outgoing) || undefined;
    }
    if (!peerCount && st && st.dht) {
      peerCount = st.dht.nodes || st.dht.node_count || undefined;
    }
    return {
      peerCount,
    };
  } catch (e) {
    return { error: e && e.message };
  }
});

ipcMain.handle('get-file-status', async (event, claimId) => {
  if (!claimId) return null;
  try {
    const res = await Lbry.file_list({ claim_id: claimId, full_status: true, page: 1, page_size: 1 });
    const item = res && res.items && res.items[0];
    if (!item) return null;
    // Return only the bits we need for diagnostics
    return {
      completed: item.completed,
      written_bytes: item.written_bytes,
      total_bytes: item.total_bytes || item.total_bytes_estimate,
      blobs_completed: item.blobs_completed,
      blobs_in_stream: item.blobs_in_stream,
      speed: item.download_speed, // may be undefined on older SDKs
      sd_hash: item.sd_hash,
    };
  } catch (e) {
    return { error: e && e.message };
  }
});

ipcMain.handle('get-peer-count', async () => {
  try {
    // Attempt to use a peer_list style call if supported by the SDK
    let res = null;
    try {
      // Some SDKs expose 'peer_list'. The lbry-js wrapper proxies unknown calls too.
      // Call without pagination first; if it errors, try with simple paging.
      res = await Lbry.peer_list();
    } catch (e) {
      try {
        res = await Lbry.peer_list({ page: 1, page_size: 9999 });
      } catch (_) {}
    }

    if (res) {
      if (Array.isArray(res)) return { peers: res.length };
      if (res.items && Array.isArray(res.items)) return { peers: res.items.length };
      if (typeof res.num_peers === 'number') return { peers: res.num_peers };
    }
    // Fallback to status-based estimation
    const st = await Lbry.status();
    let peerCount = undefined;
    const conns = st && st.connections;
    if (Array.isArray(conns)) {
      peerCount = conns.length;
    } else if (conns && typeof conns === 'object') {
      const incoming = Array.isArray(conns.incoming) ? conns.incoming.length : 0;
      const outgoing = Array.isArray(conns.outgoing) ? conns.outgoing.length : 0;
      const connected = Array.isArray(conns.connected) ? conns.connected.length : 0;
      peerCount = Math.max(connected, incoming + outgoing) || undefined;
    }
    if (!peerCount && st && st.dht) {
      peerCount = st.dht.nodes || st.dht.node_count || undefined;
    }

    // Last-resort: infer from recent log lines (unique IPs that downloaded blobs)
    if (!peerCount) {
      try {
        const settings = await Lbry.settings_get();
        const dataDir = settings && settings.data_dir;
        if (dataDir) {
          const logPath = path.join(dataDir, 'lbrynet.log');
          const maxBytes = 200000; // read last ~200KB
          if (fs.existsSync(logPath)) {
            const stat = fs.statSync(logPath);
            const fd = fs.openSync(logPath, 'r');
            const start = Math.max(0, stat.size - maxBytes);
            const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
            fs.readSync(fd, buf, 0, buf.length, start);
            fs.closeSync(fd);
            const text = buf.toString('utf8');
            // Match 'downloaded <blob> from <ip>:<port>' and count unique IPs
            const re = /downloaded\s+[0-9a-f]+\s+from\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})(?::\d+)?/gi;
            const ips = new Set();
            let m;
            while ((m = re.exec(text)) !== null) {
              ips.add(m[1]);
            }
            if (ips.size > 0) peerCount = ips.size;
          }
        }
      } catch (_) {}
    }

    return { peers: peerCount };
  } catch (e) {
    return { error: e && e.message };
  }
});
// Open media in external player (try VLC, fall back to OS handler)
ipcMain.on('open-external-media', (event, url) => {
  const fallback = () => {
    try { shell.openExternal(url); } catch (_) {}
  };
  try {
    const args = [];
    let cmd = null;
    if (process.platform === 'win32') {
      const candidates = [];
      if (process.env['ProgramFiles']) candidates.push(path.join(process.env['ProgramFiles'], 'VideoLAN', 'VLC', 'vlc.exe'));
      if (process.env['ProgramFiles(x86)']) candidates.push(path.join(process.env['ProgramFiles(x86)'], 'VideoLAN', 'VLC', 'vlc.exe'));
      const found = candidates.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
      if (found) { cmd = found; args.push(url); }
    } else if (process.platform === 'darwin') {
      // Prefer launching via "open -a VLC" if available; else try PATH.
      try {
        execSync('osascript -e "id of app \"VLC\""', { stdio: 'ignore' });
        cmd = 'open';
        args.push('-a', 'VLC', url);
      } catch (_) {
        cmd = 'vlc';
        args.push(url);
      }
    } else {
      // Linux: check if vlc exists in PATH
      try {
        execSync('command -v vlc', { stdio: 'ignore', shell: '/bin/sh' });
        cmd = 'vlc';
        args.push(url);
      } catch (_) {
        cmd = null;
      }
    }

    if (!cmd) return fallback();
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false });
    child.on('error', fallback);
    child.unref();
  } catch (e) {
    fallback();
  }
});

ipcMain.on('open-context-menu', (event, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || rendererWindow;
    const position = (payload && payload.position) || { x: 0, y: 0 };
    const template = (payload && payload.template) || [];

    const mapItem = (item) => {
      if (!item || typeof item !== 'object') return undefined;
      if (item.type === 'separator') return { type: 'separator' };
      const out = {};
      if (item.role) out.role = item.role;
      if (item.label) out.label = item.label;
      if (item.accelerator) out.accelerator = item.accelerator;
      if (typeof item.enabled === 'boolean') out.enabled = item.enabled;
      if (typeof item.checked === 'boolean') out.checked = item.checked;
      if (item.type === 'checkbox' || item.type === 'radio') out.type = item.type;
      if (Array.isArray(item.submenu)) out.submenu = item.submenu.map(mapItem).filter(Boolean);
      if (item.action) {
        out.click = () => {
          switch (item.action) {
            case 'clipboard':
              try {
                clipboard.writeText(String(item.value || ''));
              } catch (e) {}
              break;
            case 'openExternal':
              try {
                if (item.value) shell.openExternal(String(item.value));
              } catch (e) {}
              break;
            case 'inspectAt':
              if (win) {
                try {
                  win.inspectElement(position.x || 0, position.y || 0);
                } catch (e) {}
              }
              break;
            case 'send':
              try {
                event.sender.send(String(item.channel || 'context-menu-click'), item.value);
              } catch (e) {}
              break;
            default:
              break;
          }
        };
      }
      return out;
    };

    const mapped = template.map(mapItem).filter(Boolean);
    const menu = Menu.buildFromTemplate(mapped);
    if (win) {
      menu.popup({ window: win });
    } else {
      menu.popup();
    }
  } catch (e) {
    // swallow
  }
});
