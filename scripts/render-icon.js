// Renders build/icon.svg to build/icon-512.png with Electron itself — no extra packages.
//   node_modules/electron/dist/electron.exe scripts/render-icon.js
// then: py -3.12 scripts/make_ico.py   (smaller sizes + build/icon.ico + build/icon.png)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const S = 512;
const build = path.join(__dirname, '..', 'build');
const svg = fs.readFileSync(path.join(build, 'icon.svg'), 'utf8');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: S, height: S, show: false, frame: false, transparent: true, useContentSize: true,
    webPreferences: { offscreen: true } });
  const html = '<html><body style="margin:0;background:transparent;overflow:hidden">' +
    svg.replace('<svg ', '<svg width="' + S + '" height="' + S + '" ') + '</body></html>';
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: S, height: S });
  fs.writeFileSync(path.join(build, 'icon-512.png'), img.resize({ width: S, height: S }).toPNG());
  console.log('wrote build/icon-512.png', img.getSize());
  app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
