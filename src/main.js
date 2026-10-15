// Bulletin Builder — Electron main process.
//
// Phase 1: open a week (.bulletin) read-only and show it as two-page spreads.
//
// Command line:
//   electron . [path\to\week.bulletin]                     open a week (also how a double-click arrives)
//   electron . --export-pdf <week.bulletin> <out.pdf>      render every page, in reading order, to a PDF
//                                                          and quit (used by the fidelity test)
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RENDERER = path.join(__dirname, 'renderer', 'index.html');

function argAfter(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function bulletinArg() {
  return process.argv.slice(1).find((a) => a.toLowerCase().endsWith('.bulletin') && fs.existsSync(a));
}

// ---------------------------------------------------------------- loading a week
function loadWeek(file) {
  const abs = path.resolve(file);
  const dir = path.dirname(abs);
  const manifest = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (manifest.format !== 'bulletin-builder/week') throw new Error('Not a Bulletin Builder week: ' + abs);
  if (manifest.version > 1) throw new Error('This week was saved by a newer Bulletin Builder (format v' + manifest.version + ').');
  const halves = {};
  for (const [name, rel] of Object.entries(manifest.halves || {})) {
    const p = path.join(dir, rel);
    halves[name] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { pages: {}, pasteboard: [] };
  }
  return { file: abs, baseUrl: pathToFileURL(dir + path.sep).href, manifest, halves };
}

ipcMain.handle('week:load', (_e, file) => loadWeek(file));

ipcMain.handle('week:choose', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: 'Open a bulletin week',
    filters: [{ name: 'Bulletin week', extensions: ['bulletin'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ---------------------------------------------------------------- windows
function createViewer(file) {
  const win = new BrowserWindow({
    width: 1400,
    height: 950,
    title: 'Bulletin Builder',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(RENDERER, { query: file ? { week: file } : {} });
  return win;
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Week…',
          accelerator: 'CmdOrCtrl+O',
          click: async (_item, win) => {
            const r = await dialog.showOpenDialog(win, {
              filters: [{ name: 'Bulletin week', extensions: ['bulletin'] }],
              properties: ['openFile'],
            });
            if (!r.canceled) (win || createViewer()).webContents.send('week:open', r.filePaths[0]);
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: (_i, w) => w && w.webContents.send('view:zoom', 1.15) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: (_i, w) => w && w.webContents.send('view:zoom', 1 / 1.15) },
        { label: 'Whole Spread', accelerator: 'CmdOrCtrl+0', click: (_i, w) => w && w.webContents.send('view:zoom', 0) },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [{ label: 'About Bulletin Builder', click: () => dialog.showMessageBox({ message: 'Bulletin Builder ' + app.getVersion() }) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- headless PDF export
async function exportPdf(file, out) {
  const week = loadWeek(file);
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  await win.loadFile(RENDERER, { query: { week: file, mode: 'print' } });
  // the renderer sets document.title to "ready" once fonts are loaded and tabs are laid out
  const report = await win.webContents.executeJavaScript('window.__bbReady');
  const { width, height } = week.manifest.page;
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: { width: width / 72, height: height / 72 },
    margins: { marginType: 'none' },
  });
  fs.writeFileSync(out, pdf);
  fs.writeFileSync(out.replace(/\.pdf$/i, '.report.json'), JSON.stringify(report, null, 1));
  console.log('wrote', out, '| pages', week.manifest.pages.length, '| missing fonts', (report.missingFonts || []).join(', ') || 'none');
}

// developer aid: render a week in print mode, evaluate a JS expression, print the result
async function evalIn(file, expr) {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  await win.loadFile(RENDERER, { query: { week: file, mode: 'print' } });
  await win.webContents.executeJavaScript('window.__bbReady');
  console.log(JSON.stringify(await win.webContents.executeJavaScript(expr), null, 1));
}

// developer aid: screenshot of the viewer window
async function shot(file, out) {
  const win = new BrowserWindow({ width: 1400, height: 950, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true } });
  await win.loadFile(RENDERER, { query: { week: file } });
  await new Promise((r) => setTimeout(r, 5000));
  fs.writeFileSync(out, (await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(await win.webContents.executeJavaScript(
    "[...document.querySelectorAll('.frame.overflow')].map(f=>f.closest('[data-page]').dataset.page+':'+f.dataset.id+':'+(f.querySelector('.text-area').scrollHeight-f.querySelector('.text-area').clientHeight))")));
}

// ---------------------------------------------------------------- app lifecycle
const exportFile = argAfter('--export-pdf') || argAfter('--eval') || argAfter('--shot');

if (exportFile) {
  app.whenReady().then(async () => {
    try {
      if (argAfter('--shot')) await shot(exportFile, process.argv[process.argv.indexOf('--shot') + 2]);
      else if (argAfter('--eval')) await evalIn(exportFile, process.argv[process.argv.indexOf('--eval') + 2]);
      else await exportPdf(exportFile, process.argv[process.argv.indexOf('--export-pdf') + 2]);
      app.exit(0);
    } catch (err) {
      console.error(err);
      app.exit(1);
    }
  });
} else {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    let main = null;
    app.on('second-instance', (_e, argv) => {
      const f = argv.find((a) => a.toLowerCase().endsWith('.bulletin'));
      if (f) createViewer(f);
      else if (main) main.focus();
    });
    app.whenReady().then(() => {
      buildMenu();
      main = createViewer(bulletinArg());
      // auto-update: only meaningful in the installed app, and only once a release feed exists
      if (app.isPackaged) {
        try {
          require('electron-updater').autoUpdater.checkForUpdatesAndNotify().catch(() => {});
        } catch (_) { /* no feed configured yet */ }
      }
    });
    app.on('window-all-closed', () => app.quit());
  }
}

app.on('web-contents-created', (_e, wc) => {
  // links in bulletin text open in the browser, never inside the app
  wc.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});
