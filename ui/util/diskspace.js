const { exec } = require('child_process');

export const diskSpaceLinux = (path) => {
  return new Promise((resolve, reject) => {
    exec(`df ${path}`, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      if (stderr) {
        return reject(new Error(stderr));
      }
      // Sample df command output:
      // Filesystem     1K-blocks      Used Available Use% Mounted on
      // C:\            185087700 120552556  64535144  66% /mnt/c
      const dfResult = stdout.split('\n')[1].split(/\s+/);
      resolve({
        total: Number(dfResult[1]),
        free: Number(dfResult[3]),
      });
    });
  });
};

export const diskSpaceMac = (path) => {
  // Escape spaces in path to prevent errors.
  // Example:
  // "/Users/username/Library/Application Support/LBRY" gets updated to
  // "/Users/username/Library/Application\\ Support/LBRY"
  const escapedPath = path.replace(/(\s+)/g, '\\$1');
  return diskSpaceLinux(escapedPath);
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
