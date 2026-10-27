// Bulletin Builder — Electron main process.
//
// Open a week (.bulletin) as two-page spreads; claim one half to edit it (Phase 2a).
//
// Command line:
//   electron . [path\to\week.bulletin]                     open a week (also how a double-click arrives)
//   electron . --export-pdf <week.bulletin> <out.pdf>      render every page, in reading order, to a PDF
//                                                          and quit (used by the fidelity test)
//   electron . --selftest-edit <week.bulletin>             drive the editor on a temp copy; exit 0 = pass
//   electron . --selftest-flow <flow week.bulletin>        drive the Order of Worship panel (Phase 3); exit 0 = pass
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const session = require('./session');
const { pathToFileURL } = require('url');

const RENDERER = path.join(__dirname, 'renderer', 'index.html');
// Bulletin ▸ Print sheets (inches, width × height as laid out); booklets print 2-sided, short-edge flip
const PAPER = { legal: { w: 14, h: 8.5, booklet: true }, ledger: { w: 17, h: 11, booklet: true }, letter: { w: 8.5, h: 11, booklet: false } };

const HEADLESS_FILE = argAfter('--export-pdf') || argAfter('--eval') || argAfter('--shot') || argAfter('--selftest-edit') || argAfter('--selftest-flow') || argAfter('--gui');
const HEADLESS = !!HEADLESS_FILE;

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

// recent weeks (File ▸ Home / Open), newest first; not recorded for headless/test runs
const RECENT_MAX = 15;
const recentFile = () => path.join(app.getPath('userData'), 'recent.json');
function readRecent() {
  try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter((r) => r && r.file); } catch (_) { return []; }
}
function noteRecent(week) {
  if (HEADLESS) return;
  try {
    const list = readRecent().filter((r) => path.resolve(r.file).toLowerCase() !== week.file.toLowerCase());
    list.unshift({ file: week.file, title: week.manifest.title, at: new Date().toISOString() });
    fs.mkdirSync(path.dirname(recentFile()), { recursive: true });
    fs.writeFileSync(recentFile(), JSON.stringify(list.slice(0, RECENT_MAX), null, 1));
  } catch (_) { /* a recent list is a convenience only */ }
}

ipcMain.handle('week:load', (_e, file) => { const w = loadWeek(file); noteRecent(w); return w; });
ipcMain.handle('recent:list', () => readRecent().map((r) => ({ ...r, exists: fs.existsSync(r.file) })));

// File ▸ Export ▸ PDF and File ▸ Print both render the SAVED week in print mode (what prints is
// exactly what the PDF/fidelity test sees)
ipcMain.handle('week:export-pdf', async (e, file, paperName) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const r = global.__bbTestExportPdf ? { filePath: global.__bbTestExportPdf } : await dialog.showSaveDialog(win, {   // GUI tests: no native dialog
    title: 'Export as PDF',
    defaultPath: path.join(path.dirname(path.resolve(file)), manifest.title + (PAPER[paperName] ? ' - ' + paperName : '') + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  await exportPdf(file, r.filePath, { report: false, paper: paperName });
  return r.filePath;
});
ipcMain.handle('week:print', async (_e, file, paperName) => {
  const week = loadWeek(file);
  const paper = PAPER[paperName] ? paperName : null;
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  try {
    await win.loadFile(RENDERER, { query: { week: file, mode: 'print', ...(paper ? { paper } : {}) } });
    await win.webContents.executeJavaScript('window.__bbReady');
    const { width, height } = week.manifest.page;
    const P = paper && PAPER[paper];
    // the printer driver gets the sheet portrait-way-up plus a landscape flag for a booklet sheet
    const sw = P ? Math.min(P.w, P.h) * 25400 : Math.round(width / 72 * 25400), sh = P ? Math.max(P.w, P.h) * 25400 : Math.round(height / 72 * 25400);
    return await new Promise((resolve) => win.webContents.print({
      silent: false, printBackground: true,
      pageSize: { width: Math.round(sw), height: Math.round(sh) },
      landscape: !!(P && P.w > P.h),
      ...(P && P.booklet ? { duplexMode: 'shortEdge' } : {}),
      margins: { marginType: 'none' },
    }, (ok, reason) => resolve(ok ? 'printed' : (reason || 'cancelled'))));
  } finally {
    win.destroy();
  }
});
// Insert ▸ Page / Page Design ▸ Pages: renumbers both halves, so it runs here on disk (src/pages.js)
ipcMain.handle('pages:op', (e, file, half, op) => {
  const c = claims.get(e.sender.id);
  if (!c || c.half !== half || path.resolve(c.file) !== path.resolve(file)) throw new Error('Choose which pages you are changing first (Bulletin ▸ I am changing).');
  const busyElsewhere = (h) => {
    for (const [id, x] of claims) if (id !== e.sender.id && x.half === h && path.resolve(x.file) === path.resolve(file)) return 'another Bulletin Builder window';
    return null;
  };
  return require('./pages').pageOp(file, half, op, { session, busyElsewhere });
});
// Home ▸ Styles ▸ New Style…: the week's style list lives in the .bulletin file
ipcMain.handle('week:set-styles', (e, file, styles) => {
  const c = claims.get(e.sender.id);
  if (!c || path.resolve(c.file) !== path.resolve(file)) throw new Error('Choose which pages you are changing first (Bulletin ▸ I am changing).');
  const abs = path.resolve(file);
  const m = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const hist = path.join(path.dirname(abs), 'history');
  fs.mkdirSync(hist, { recursive: true });
  fs.copyFileSync(abs, path.join(hist, 'manifest-styles-' + Date.now() + '.bulletin'));
  m.styles = styles;
  fs.writeFileSync(abs + '.saving', JSON.stringify(m, null, 1));
  fs.renameSync(abs + '.saving', abs);
  return true;
});
// right-click Cut / Copy / Paste in text: the browser's own clipboard commands
ipcMain.handle('edit:do', (e, what) => { if (['cut', 'copy', 'paste'].includes(what)) e.sender[what](); });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('file:reveal', (_e, p) => shell.showItemInFolder(p));

// ---------------------------------------------------------------- edit sessions
const claims = new Map(); // webContents id -> { file, half }
const dirty = new Map();  // webContents id -> bool

ipcMain.handle('session:claim', (e, file, half, force) => {
  // another window of THIS app already editing the same half of the same week
  for (const [id, c] of claims) {
    if (id !== e.sender.id && c.half === half && path.resolve(c.file) === path.resolve(file)) {
      return { ok: false, holder: { user: os.userInfo().username, machine: os.hostname() + ' (another Bulletin Builder window)', since: null } };
    }
  }
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

// copy a picture into the week's assets folder (same bytes = same file) and return its path
ipcMain.handle('asset:import', async (e, weekFile) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: 'Insert picture',
    filters: [{ name: 'Pictures', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    properties: ['openFile'],
  });
  if (r.canceled) return null;
  return importAsset(weekFile, r.filePaths[0]);
});

function importAsset(weekFile, src) {
  const crypto = require('crypto');
  const dir = path.join(path.dirname(path.resolve(weekFile)), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  const bytes = fs.readFileSync(src);
  const hash = crypto.createHash('sha1').update(bytes).digest('hex');
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).size === bytes.length && crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex') === hash) {
      return 'assets/' + f;
    }
  }
  const ext = path.extname(src);
  const base = path.basename(src, ext).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || 'picture';
  let name = base + ext;
  for (let k = 2; fs.existsSync(path.join(dir, name)); k++) name = base + ' (' + k + ')' + ext;
  fs.writeFileSync(path.join(dir, name), bytes);
  return 'assets/' + name;
}
ipcMain.handle('asset:import-path', (_e, weekFile, src) => importAsset(weekFile, src));

// ---------------------------------------------------------------- new week from an existing one
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "10-18-26 1100" -> "10-25-26 1100" (the week folder naming); unknown names get " (next week)"
function nextWeekName(title) {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{2})(.*)$/.exec(title || '');
  if (!m) return (title || 'Week') + ' (next week)';
  const d = new Date(2000 + Number(m[3]), Number(m[1]) - 1, Number(m[2]) + 7);
  return (d.getMonth() + 1) + '-' + d.getDate() + '-' + String(d.getFullYear()).slice(2) + m[4];
}

// "October 18, 2026" -> "October 25, 2026"; anything else is left alone
function nextWeekDate(text) {
  const m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec((text || '').trim());
  const mi = m ? MONTHS.indexOf(m[1]) : -1;
  if (mi < 0) return text;
  const d = new Date(Number(m[3]), mi, Number(m[2]) + 7);
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// Copy a week folder to a new one (never history/ or locks/), rename its .bulletin, roll the dates.
// Returns the new .bulletin path.
function newWeekFrom(file, destDir, { roll = true } = {}) {
  const srcFile = path.resolve(file);
  const src = path.dirname(srcFile);
  destDir = path.resolve(destDir);
  if (fs.existsSync(destDir) && fs.readdirSync(destDir).length) throw new Error('A folder named "' + path.basename(destDir) + '" already exists there.');
  const skip = new Set([path.join(src, 'history'), path.join(src, 'locks')]);
  fs.cpSync(src, destDir, { recursive: true, filter: (p) => !skip.has(p) && !p.endsWith('.saving') && path.extname(p).toLowerCase() !== '.bulletin' });
  const name = path.basename(destDir);
  const manifest = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
  const from = manifest.title;
  manifest.title = name;
  manifest.createdFrom = { week: from, at: new Date().toISOString(), ...(roll ? {} : { how: 'save-as' }) };
  const out = path.join(destDir, name + '.bulletin');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 1));
  const wp = path.join(destDir, (manifest.halves || {}).worship || 'worship.json');
  if (roll && fs.existsSync(wp)) {
    const w = JSON.parse(fs.readFileSync(wp, 'utf8'));
    if (w.mode === 'flow' && w.flow && w.flow.cover) {
      w.flow.cover.date = nextWeekDate(w.flow.cover.date);
      if (w.layout) w.layout.flowHash = null;   // lay out again on open (the date changed)
      fs.writeFileSync(wp, JSON.stringify(w, null, 1));
    }
  }
  return out;
}

ipcMain.handle('week:new-from', async (e, file) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const parent = path.dirname(path.dirname(path.resolve(file)));
  const r = await dialog.showSaveDialog(win, {
    title: 'New week from this one — name the new week',
    defaultPath: path.join(parent, nextWeekName(manifest.title)),
    buttonLabel: 'Create week',
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (r.canceled || !r.filePath) return null;
  return newWeekFrom(file, r.filePath.replace(/\.bulletin$/i, ''));
});

// File ▸ Save As (F12): a copy of the week folder under a new name; the caller then works in the copy
ipcMain.handle('week:save-as', async (e, file) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const parent = path.dirname(path.dirname(path.resolve(file)));
  let dest = global.__bbTestSaveAs;     // GUI tests: no native dialog
  if (!dest) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save As — name the copy of this week',
      defaultPath: path.join(parent, manifest.title + ' copy'),
      buttonLabel: 'Save',
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (r.canceled || !r.filePath) return null;
    dest = r.filePath;
  }
  return newWeekFrom(file, dest.replace(/\.bulletin$/i, ''), { roll: false });
});

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
  // Publisher has no menu bar — the ribbon carries every command. The (hidden) application
  // menu still provides the keyboard shortcuts (Ctrl+O/N/S/Z/Y, zoom).
  win.setMenuBarVisibility(false);
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
        { label: 'New Week from This One…', accelerator: 'CmdOrCtrl+N', click: send('new-week') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Save As…', accelerator: 'F12', click: send('save-as') },
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
async function exportPdf(file, out, opts = {}) {
  const week = loadWeek(file);
  const paper = PAPER[opts.paper] ? opts.paper : null;
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  await win.loadFile(RENDERER, { query: { week: file, mode: 'print', ...(paper ? { paper } : {}) } });
  // the renderer sets document.title to "ready" once fonts are loaded and tabs are laid out
  const report = await win.webContents.executeJavaScript('window.__bbReady');
  const { width, height } = week.manifest.page;
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: paper ? { width: PAPER[paper].w, height: PAPER[paper].h } : { width: width / 72, height: height / 72 },
    margins: { marginType: 'none' },
  });
  fs.writeFileSync(out, pdf);
  if (opts.report !== false) fs.writeFileSync(out.replace(/\.pdf$/i, '.report.json'), JSON.stringify(report, null, 1));
  win.destroy();
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
  session.releaseAll();
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

// self-test for flow mode (Phase 3): drive the Order of Worship panel on a temp copy of a flow week
async function selftestFlow(file) {
  const src = path.dirname(path.resolve(file));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-selftest-flow-'));
  const skip = new Set([path.join(src, 'history'), path.join(src, 'locks')]);
  fs.cpSync(src, tmp, { recursive: true, filter: (p) => !skip.has(p) });
  const copy = path.join(tmp, path.basename(file));
  const annBefore = fs.readFileSync(path.join(tmp, 'announcements.json'));
  const win = new BrowserWindow({ width: 1500, height: 950, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true } });
  await win.loadFile(RENDERER, { query: { week: copy, selftest: 'flow' } });
  const result = await win.webContents.executeJavaScript('window.__bbSelftest');
  const checks = result.checks || [];
  const d = result.flowDisk || {};
  const hist = path.join(tmp, 'history');
  checks.push({ name: 'on disk: history entry written before save', pass: fs.existsSync(hist) && fs.readdirSync(hist).some((x) => x.startsWith('worship-')) });
  checks.push({ name: 'on disk: worship lock held while editing', pass: !!session.readLock(path.join(tmp, 'locks', 'worship.lock')) });
  const w = JSON.parse(fs.readFileSync(path.join(tmp, 'worship.json'), 'utf8'));
  checks.push({ name: 'on disk: worship half saved in flow mode with its blocks', pass: w.mode === 'flow' && w.flow.blocks.length === d.blocks });
  checks.push({ name: 'on disk: edited label saved', pass: (w.flow.blocks.find((b) => b.id === d.target) || {}).heading?.label === d.label });
  checks.push({ name: 'on disk: cover date saved', pass: w.flow.cover.date === d.date });
  checks.push({ name: 'on disk: layout saved with its flow hash (no re-layout needed on open)', pass: w.layout && w.layout.flowHash === d.hash });
  const gen = Object.values(w.pages).flatMap((p) => p.frames).filter((f) => f.generated).length;
  checks.push({ name: 'on disk: laid-out pages saved as ordinary frames', pass: gen > 10, got: gen });
  checks.push({ name: 'on disk: hand-placed frame kept', pass: (w.pages[String(d.handPage)] || { frames: [] }).frames.some((f) => f.id === d.hand && !f.generated) });
  checks.push({ name: 'on disk: announcements half untouched', pass: Buffer.compare(annBefore, fs.readFileSync(path.join(tmp, 'announcements.json'))) === 0 });
  // New Week from This One
  const nwDir = path.join(path.dirname(tmp), path.basename(tmp) + '-next');
  try {
    const nw = newWeekFrom(copy, nwDir);
    const m2 = JSON.parse(fs.readFileSync(nw, 'utf8'));
    const w2 = JSON.parse(fs.readFileSync(path.join(nwDir, 'worship.json'), 'utf8'));
    checks.push({ name: 'new week: folder copied with its own .bulletin (no history, no locks)', pass: fs.existsSync(nw) && m2.title === path.basename(nwDir) &&
      !fs.existsSync(path.join(nwDir, 'history')) && !fs.existsSync(path.join(nwDir, 'locks')) && fs.existsSync(path.join(nwDir, 'assets')) });
    checks.push({ name: 'new week: cover date rolled forward 7 days', pass: w2.flow.cover.date === nextWeekDate(d.date) && w2.flow.cover.date !== d.date, got: w2.flow.cover.date });
    checks.push({ name: 'new week: name rolls the date in the week name', pass: nextWeekName('10-18-26 1100') === '10-25-26 1100' && nextWeekName('12-27-26 1100') === '1-3-27 1100' });
    let refused = false;
    try { newWeekFrom(copy, nwDir); } catch (_) { refused = true; }
    checks.push({ name: 'new week: never overwrites an existing week', pass: refused });
  } finally {
    fs.rmSync(nwDir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(checks, null, 1));
  const failed = checks.filter((c) => !c.pass);
  console.log(failed.length ? 'FAILED ' + failed.length + ' of ' + checks.length : 'PASS ' + checks.length + ' checks');
  session.releaseAll();
  if (!failed.length) fs.rmSync(tmp, { recursive: true, force: true });
  else console.log('kept for inspection:', tmp);
  return failed.length === 0;
}

// ---------------------------------------------------------------- app lifecycle
const exportFile = HEADLESS_FILE || argAfter('--eval') || argAfter('--shot') || argAfter('--selftest-edit') || argAfter('--selftest-flow');

if (exportFile) {
  app.whenReady().then(async () => {
    try {
      if (argAfter('--selftest-edit')) { const ok = await selftestEdit(exportFile); app.exit(ok ? 0 : 1); return; }
      if (argAfter('--selftest-flow')) { const ok = await selftestFlow(exportFile); app.exit(ok ? 0 : 1); return; }
      if (argAfter('--gui')) {
        // GUI tests with real input events: --gui <suite.js> <week.bulletin> <outdir>
        const i = process.argv.indexOf('--gui');
        const { runGui } = require('../test/gui/harness');
        const ok = await runGui(process.argv[i + 1], process.argv[i + 2], process.argv[i + 3] || 'out/gui',
          { BrowserWindow, RENDERER, preload: path.join(__dirname, 'preload.js'), session });
        app.exit(ok ? 0 : 1); return;
      }
      if (argAfter('--shot')) await shot(exportFile, process.argv[process.argv.indexOf('--shot') + 2]);
      else if (argAfter('--eval')) await evalIn(exportFile, process.argv[process.argv.indexOf('--eval') + 2]);
      else await exportPdf(exportFile, process.argv[process.argv.indexOf('--export-pdf') + 2], { paper: argAfter('--paper') });
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
