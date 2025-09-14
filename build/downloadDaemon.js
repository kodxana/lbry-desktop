const path = require('path');
const fs = require('fs');
const packageJSON = require('../package.json');
const fetch = require('node-fetch');
const decompress = require('decompress');
const os = require('os');
const del = require('del');

const downloadDaemon = (targetPlatform) =>
  new Promise(async (resolve, reject) => {
    try {
      const daemonURLTemplate = packageJSON.lbrySettings.lbrynetDaemonUrlTemplate;
      const daemonVersion = packageJSON.lbrySettings.lbrynetDaemonVersion;
      const fallbackVersions =
        (packageJSON.lbrySettings && packageJSON.lbrySettings.lbrynetDaemonFallbackVersions) || [];
      const daemonDir = path.join(__dirname, '..', packageJSON.lbrySettings.lbrynetDaemonDir);
      let daemonFileName = packageJSON.lbrySettings.lbrynetDaemonFileName;

      const currentPlatform = os.platform();

      let daemonPlatform = process.env.TARGET || targetPlatform || currentPlatform;
      if (daemonPlatform === 'mac' || daemonPlatform === 'darwin') daemonPlatform = 'mac';
      if (daemonPlatform === 'win32' || daemonPlatform === 'windows') {
        daemonPlatform = 'windows';
        daemonFileName += '.exe';
      }
      const daemonFilePath = path.join(daemonDir, daemonFileName);
      const daemonVersionPath = path.join(__dirname, 'daemon.ver');
      const tmpZipPath = path.join(__dirname, '..', 'dist', 'daemon.zip');

      // Ensure target dir exists (handles direct-binary downloads on fresh clones)
      if (!fs.existsSync(daemonDir)) {
        fs.mkdirSync(daemonDir, { recursive: true });
      }

      // If a daemon and daemon.ver exists, check to see if it matches any acceptable version
      const hasDaemonDownloaded = fs.existsSync(daemonFilePath);
      const hasDaemonVersion = fs.existsSync(daemonVersionPath);
      let downloadedDaemonVersion;

      if (hasDaemonVersion) {
        downloadedDaemonVersion = fs.readFileSync(daemonVersionPath, 'utf8');
      }

      const acceptableVersions = [daemonVersion, ...fallbackVersions];
      if (hasDaemonDownloaded && hasDaemonVersion && acceptableVersions.includes(downloadedDaemonVersion)) {
        console.log('\x1b[34minfo\x1b[0m Daemon already downloaded');
        return resolve('Done');
      }

      console.log('\x1b[34minfo\x1b[0m Downloading daemon...');

      // Build list of candidate URLs (try requested version first, then fallbacks)
      const urlsToTry = [];
      const configuredUrls = (packageJSON.lbrySettings && packageJSON.lbrySettings.lbrynetDaemonUrls) || {};
      const versionsToTry = [daemonVersion, ...fallbackVersions];
      for (const ver of versionsToTry) {
        if (configuredUrls[daemonPlatform]) {
          urlsToTry.push(configuredUrls[daemonPlatform].replace(/DAEMONVER/g, ver));
        }
        if (daemonURLTemplate) {
          urlsToTry.push(
            daemonURLTemplate.replace(/DAEMONVER/g, ver).replace(/OSNAME/g, daemonPlatform)
          );
        }
        // Legacy fallback to official releases if nothing else works
        urlsToTry.push(
          `https://github.com/lbryio/lbry/releases/download/v${ver}/lbrynet-${daemonPlatform}.zip`
        );
      }

      // Ensure dist dir exists if needed
      const distPath = path.join(__dirname, '..', 'dist');
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath);
      }

      // Try each URL until one succeeds
      let lastError;
      let versionUsed = daemonVersion;
      for (const url of urlsToTry) {
        try {
          const isZip = /\.zip($|[?#])/i.test(url);
          const response = await fetch(url, { method: 'GET' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buf = await response.buffer();
          // Capture version used from URL (vX.Y.Z)
          const verMatch = url.match(/\/v(\d+\.\d+\.\d+)\//);
          if (verMatch && verMatch[1]) versionUsed = verMatch[1];

          // Remove any existing binary first
          await del(`${daemonFilePath}*`);

          if (isZip) {
            // Write zip then extract the binary we need
            await new Promise((res, rej) => {
              fs.writeFile(tmpZipPath, buf, (error) => (error ? rej(error) : res()));
            });
            await decompress(tmpZipPath, daemonDir, {
              filter: (file) => path.basename(file.path) === daemonFileName,
            });
          } else {
            // Direct binary download
            await new Promise((res, rej) => {
              fs.writeFile(daemonFilePath, buf, (error) => (error ? rej(error) : res()));
            });
            // Ensure executable perms on POSIX
            if (daemonPlatform !== 'windows') {
              try {
                fs.chmodSync(daemonFilePath, 0o755);
              } catch (_) {}
            }
          }

          // Mark version installed
          if (hasDaemonVersion) {
            await del(daemonVersionPath);
          }
          fs.writeFileSync(daemonVersionPath, versionUsed, 'utf8');
          console.log(`\x1b[32msuccess\x1b[0m Daemon downloaded! - v${versionUsed}`);
          return resolve('Done');
        } catch (err) {
          console.warn(`\x1b[33mwarn\x1b[0m Failed to download from ${url}: ${err}`);
          lastError = err;
        }
      }

      throw lastError || new Error('No valid download URL');
    } catch (error) {
      console.error(
        `\x1b[31merror\x1b[0m Daemon download failed due to: \x1b[35m${error}\x1b[0m`
      );
      reject(error);
    }
  });

downloadDaemon();
