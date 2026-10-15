// Bulletin Builder — Electron main process.
//
// Open a week (.bulletin) as two-page spreads; claim one half to edit it (Phase 2a).
//
// Command line:
//   electron . [path\to\week.bulletin]                     open a week (also how a double-click arrives)
//   electron . --export-pdf <week.bulletin> <out.pdf>      render every page, in reading order, to a PDF
//                                                          and quit (used by the fidelity test)
//   electron . --selftest-edit <week.bulletin>             drive the editor on a temp copy; exit 0 = pass
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const session = require('./session');
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

// ---------------------------------------------------------------- edit sessions
const claims = new Map(); // webContents id -> { file, half }
const dirty = new Map();  // webContents id -> bool

ipcMain.handle('session:claim', (e, file, half, force) => {
  const prev = claims.get(e.sender.id);
  if (prev) session.release(prev.file, prev.half);
  claims.delete(e.sender.id);
  const r = session.claim(file, half, { force });
  if (r.ok) claims.set(e.sender.id, { file, half });
  return r;
});
ipcMain.handle('session:release', (e) => {
  const c = claims.get(e.sender.id);
  if (c) session.release(c.file, c.half);
  claims.delete(e.sender.id);
});
ipcMain.handle('session:save', (e, data) => {
  const c = claims.get(e.sender.id);
  if (!c) throw new Error('Nothing is open for editing.');
  return session.save(c.file, c.half, data);
});
ipcMain.on('doc:dirty', (e, flag) => dirty.set(e.sender.id, !!flag));

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
  const id = win.webContents.id;
  let closing = false;
  win.on('close', (ev) => {
    if (closing || !dirty.get(id)) return;
    ev.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2,
      message: 'Save your changes before closing?',
    });
    if (choice === 2) return;
    closing = true;
    if (choice === 0) win.webContents.send('cmd', 'save-and-close');
    else win.destroy();
  });
  win.on('closed', () => {
    const c = claims.get(id);
    if (c) session.release(c.file, c.half);
    claims.delete(id);
    dirty.delete(id);
  });
  return win;
}

ipcMain.on('app:close-window', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.destroy(); });

const send = (name) => (_i, w) => w && w.webContents.send('cmd', name);

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
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Edit Worship Pages', click: send('claim:worship') },
        { label: 'Edit Announcements Pages', click: send('claim:announcements') },
        { label: 'Stop Editing (view only)', click: send('release') },
        { type: 'separator' },
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: send('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
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
  const pre = process.argv[process.argv.indexOf('--shot') + 3];
  if (pre && !pre.startsWith('--')) { await win.webContents.executeJavaScript(pre); await new Promise((r) => setTimeout(r, 1500)); }
  fs.writeFileSync(out, (await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(await win.webContents.executeJavaScript(
    "[...document.querySelectorAll('.frame.overflow')].map(f=>f.closest('[data-page]').dataset.page+':'+f.dataset.id+':'+(f.querySelector('.text-area').scrollHeight-f.querySelector('.text-area').clientHeight))")));
}

// self-test: drive the real editor on a temp copy of a week, then check the files it wrote
async function selftestEdit(file) {
  const src = path.dirname(path.resolve(file));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-selftest-'));
  const skip = new Set([path.join(src, 'history'), path.join(src, 'locks')]);
  fs.cpSync(src, tmp, { recursive: true, filter: (p) => !skip.has(p) });
  const copy = path.join(tmp, path.basename(file));
  const win = new BrowserWindow({ width: 1400, height: 950, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true } });
  await win.loadFile(RENDERER, { query: { week: copy, selftest: '1' } });
  const result = await win.webContents.executeJavaScript('window.__bbSelftest');
  result.checks = result.checks || [];
  // checks on disk, from outside the renderer
  const hist = path.join(tmp, 'history');
  const lock = session.readLock(path.join(tmp, 'locks', 'announcements.lock'));
  result.checks.push({ name: 'history entry written before save', pass: fs.existsSync(hist) && fs.readdirSync(hist).length >= 1 });
  result.checks.push({ name: 'lock file held while editing', pass: !!lock });
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'announcements.json'), 'utf8'));
  for (const c of result.diskChecks || []) {
    const pg = saved.pages[String(c.page)];
    const walk = (fs_) => fs_.flatMap((f) => [f, ...walk(f.children || [])]);
    const fr = pg && walk(pg.frames).find((f) => f.id === c.id);
    const got = c.field === '@page.locked' ? !!(pg && pg.locked)
      : fr && c.field.split('.').reduce((o, k) => (o == null ? o : o[k]), fr);
    result.checks.push({ name: 'on disk: ' + c.name, pass: JSON.stringify(got) === JSON.stringify(c.expect), got, expect: c.expect });
  }
  console.log(JSON.stringify(result.checks, null, 1));
  const failed = result.checks.filter((c) => !c.pass);
  console.log(failed.length ? 'FAILED ' + failed.length + ' of ' + result.checks.length : 'PASS ' + result.checks.length + ' checks');
  session.releaseAll();
  if (!failed.length) fs.rmSync(tmp, { recursive: true, force: true });
  else console.log('kept for inspection:', tmp);
  return failed.length === 0;
}

// ---------------------------------------------------------------- app lifecycle
const exportFile = argAfter('--export-pdf') || argAfter('--eval') || argAfter('--shot') || argAfter('--selftest-edit');

if (exportFile) {
  app.whenReady().then(async () => {
    try {
      if (argAfter('--selftest-edit')) { const ok = await selftestEdit(exportFile); app.exit(ok ? 0 : 1); return; }
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
    app.on('will-quit', () => session.releaseAll());
  }
}

app.on('web-contents-created', (_e, wc) => {
  // links in bulletin text open in the browser, never inside the app
  wc.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});
