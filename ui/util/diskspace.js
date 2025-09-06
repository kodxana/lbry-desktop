const { exec, spawn } = require('child_process');

export const diskSpaceLinux = (path) => {
  return new Promise((resolve, reject) => {
    // Use spawn with args to avoid command injection; '--' to terminate option parsing.
    const df = spawn('df', ['-k', '--', path]);
    let out = '';
    let err = '';
    df.stdout.on('data', (d) => (out += d.toString()));
    df.stderr.on('data', (d) => (err += d.toString()));
    df.on('error', (e) => reject(e));
    df.on('close', (code) => {
      if (code !== 0 || err) {
        return reject(new Error(err || `df exited with code ${code}`));
      }
      try {
        const lines = out.trim().split('\n');
        // Find the last non-empty, non-header line.
        const dataLine = lines.reverse().find((ln) => ln && !/^Filesystem/i.test(ln));
        if (!dataLine) return reject(new Error('Unexpected df output'));
        const parts = dataLine.trim().split(/\s+/);
        // Expected columns: Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
        const total = Number(parts[1]);
        const free = Number(parts[3]);
        if (!Number.isFinite(total) || !Number.isFinite(free)) {
          return reject(new Error('Failed to parse df output'));
        }
        resolve({ total, free });
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const diskSpaceMac = (path) => {
  // Same implementation as Linux; rely on spawn arg escaping.
  return diskSpaceLinux(path);
};

export const diskSpaceWindows = (path) => {
  return new Promise((resolve, reject) => {
    const pathDrive = path.split(':')[0] + ':';

    const parseAndResolve = (freeBytes, totalBytes) =>
      resolve({ total: Math.floor(Number(totalBytes) / 1024), free: Math.floor(Number(freeBytes) / 1024) });

    // First try legacy WMIC (may not exist on newer Windows).
    exec(`wmic logicaldisk get size,freespace,caption`, (error, stdout, stderr) => {
      if (!error && !stderr) {
        try {
          const stdoutLines = stdout.split('\n');
          const driveLine = stdoutLines.find((line) => line.trim().startsWith(pathDrive));
          if (driveLine) {
            const parts = driveLine.trim().split(/\s+/);
            const freeSpace = parts[1];
            const totalSize = parts[2];
            return parseAndResolve(freeSpace, totalSize);
          }
        } catch (e) {
          // fall through to PowerShell
        }
      }

      // Fallback: PowerShell CIM query (Windows 10/11)
      const ps = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress`;
      exec(`powershell -NoProfile -Command "${ps}"`, (psErr, psOut) => {
        if (psErr) return reject(psErr);
        try {
          const data = JSON.parse(psOut);
          const arr = Array.isArray(data) ? data : [data];
          const match = arr.find((d) => String(d.DeviceID).toUpperCase() === pathDrive.toUpperCase());
          if (match) {
            return parseAndResolve(match.FreeSpace || 0, match.Size || 0);
          }
          return reject(new Error('Drive not found in PowerShell output'));
        } catch (e) {
          return reject(e);
        }
      });
    });
  });
};
