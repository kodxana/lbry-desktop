import { BrowserWindow } from 'electron';

export default function createSplash() {
  const splash = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#212529',
  });

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
      <title>LBRY</title>
      <style>
        html, body { height: 100%; }
        body {
          margin: 0; padding: 0; background: #212529; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
            Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif;
        }
        .title { font-size: 28px; font-weight: 600; letter-spacing: 0.5px; }
        .sub { margin-top: 10px; opacity: 0.8; }
        .dot { animation: blink 1.3s infinite ease-in-out; }
        .dot:nth-child(2) { animation-delay: .2s; }
        .dot:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%, 80%, 100% { opacity: 0.2 } 40% { opacity: 1 } }
      </style>
    </head>
    <body>
      <div>
        <div class="title">LBRY</div>
        <div class="sub">Starting<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></div>
      </div>
    </body>
  </html>`;

  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return splash;
}

