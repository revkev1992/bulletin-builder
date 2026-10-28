// GUI test harness: drives a real Bulletin Builder window with REAL input events
// (webContents.sendInputEvent — they go through Chromium's input pipeline, so a disabled
// button really does not click, focus really moves, a double-click is a real double-click).
// Every check can be paired with a screenshot of the window (capturePage).
//
//   npx electron . --gui test/gui/<suite>.js "<week.bulletin>" <outdir>
//
// A suite exports `async function run(h)`; h is the API below. Runs on a TEMP COPY of the week.
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeHarness(win, outDir) {
  const wc = win.webContents;
  const checks = [];
  let shotN = 0;
  const h = {
    win, wc, wait, checks,
    js: (expr) => wc.executeJavaScript(expr),
    // box of the first element matching a CSS selector, in window coordinates
    async rect(sel) {
      return wc.executeJavaScript(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
    },
    // scroll an element into view the way a person would before clicking it
    async reveal(sel) {
      const moved = await wc.executeJavaScript(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
        const r = el.getBoundingClientRect(); let p = el.parentElement;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY)) { const pr = p.getBoundingClientRect();
          if (r.top < pr.top || r.bottom > pr.bottom) { el.scrollIntoView({ block: 'center' }); return true; } break; } p = p.parentElement; }
        return false; })()`);
      if (moved) await wait(300);
    },
    async move(x, y, mods = []) { wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y), modifiers: mods }); await wait(20); },
    async down(x, y, { count = 1, mods = [], button = 'left' } = {}) {
      wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button, clickCount: count, modifiers: mods });
      await wait(20);
    },
    async up(x, y, { count = 1, mods = [], button = 'left' } = {}) {
      wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button, clickCount: count, modifiers: mods });
      await wait(60);
    },
    async click(x, y, o = {}) { await h.move(x, y, o.mods); await h.down(x, y, o); await h.up(x, y, o); await wait(o.settle ?? 150); },
    // a mouse-wheel notch (Electron: deltaY > 0 = wheel turned up/away); a touchpad pinch arrives as ctrl+wheel too
    async wheel(x, y, deltaY, mods = [], settle = 60) {
      wc.sendInputEvent({ type: 'mouseWheel', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY, modifiers: mods });
      await wait(settle);
    },
    async rightClick(x, y, o = {}) { await h.click(x, y, { ...o, button: 'right' }); },
    async dblclick(x, y, o = {}) {
      await h.move(x, y);
      await h.down(x, y, { ...o, count: 1 }); await h.up(x, y, { ...o, count: 1 });
      await h.down(x, y, { ...o, count: 2 }); await h.up(x, y, { ...o, count: 2 });
      await wait(o.settle ?? 250);
    },
    async clickSel(sel, o = {}) {
      await h.reveal(sel);
      const r = await h.rect(sel);
      if (!r) throw new Error('not on screen: ' + sel);
      await h.click(o.dx != null ? r.x + o.dx : r.cx, o.dy != null ? r.y + o.dy : r.cy, o);
      return r;
    },
    async drag(x0, y0, x1, y1, { steps = 8, mods = [], settle = 250 } = {}) {
      await h.move(x0, y0, mods);
      await h.down(x0, y0, { mods });
      for (let k = 1; k <= steps; k++) await h.move(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, mods);
      await h.up(x1, y1, { mods });
      await wait(settle);
    },
    // a key press: keyCode is an Electron accelerator key name ('A', 'Enter', 'Tab', 'Left', 'Delete', 'Escape')
    async key(keyCode, mods = [], settle = 120) {
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers: mods });
      const plain = !mods.some((m) => m === 'control' || m === 'alt');
      if (keyCode.length === 1 && plain) wc.sendInputEvent({ type: 'char', keyCode, modifiers: mods });
      if (keyCode === 'Enter' && plain) wc.sendInputEvent({ type: 'char', keyCode: '\r', modifiers: mods });
      if (keyCode === 'Tab' && plain) wc.sendInputEvent({ type: 'char', keyCode: '\t', modifiers: mods });
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers: mods });
      await wait(settle);
    },
    async type(text) {
      for (const ch of text) {
        if (ch === '\n') { await h.key('Enter', [], 30); continue; }
        wc.sendInputEvent({ type: 'keyDown', keyCode: ch });
        wc.sendInputEvent({ type: 'char', keyCode: ch });
        wc.sendInputEvent({ type: 'keyUp', keyCode: ch });
        await wait(15);
      }
      await wait(150);
    },
    async shot(name) {
      const img = await wc.capturePage();
      const file = path.join(outDir, String(++shotN).padStart(2, '0') + '-' + name + '.png');
      fs.writeFileSync(file, img.toPNG());
      return file;
    },
    ok(name, pass, extra = {}) {
      checks.push({ name, pass: !!pass, ...extra });
      console.log((pass ? '  ok   ' : '  FAIL ') + name + (pass ? '' : ' ' + JSON.stringify(extra)));
    },
    // disabled state of a control, read from the DOM (what the user sees)
    async disabled(sel) { return h.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.disabled : 'missing'; })()`); },
    async until(expr, ms = 5000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (await h.js(expr)) return true; await wait(100); }
      return false;
    },
  };
  return h;
}

async function runGui(suiteFile, weekFile, outDir, { BrowserWindow, RENDERER, preload, session }) {
  const os = require('os');
  const src = path.dirname(path.resolve(weekFile));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-gui-'));
  const skip = new Set([path.join(src, 'history'), path.join(src, 'locks')]);
  fs.cpSync(src, tmp, { recursive: true, filter: (p) => !skip.has(p) });
  const copy = path.join(tmp, path.basename(weekFile));
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png')) fs.rmSync(path.join(outDir, f));
  const win = new BrowserWindow({ width: 1500, height: 950, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload, offscreen: true } });
  win.webContents.setFrameRate(30);
  await win.loadFile(RENDERER, { query: { week: copy } });
  await win.webContents.executeJavaScript(`new Promise((r) => { const t = setInterval(() => {
    if (window.__bbWeek && window.__bbWeek() && document.querySelector('.page-shell .page')) { clearInterval(t); r(); } }, 100); })`);
  await wait(1500);
  win.webContents.focus();
  const h = makeHarness(win, outDir);
  h.weekCopy = copy;
  h.tmp = tmp;
  let error = null;
  try {
    await require(path.resolve(suiteFile)).run(h);
  } catch (err) {
    error = err;
    console.error(err);
    await h.shot('ERROR').catch(() => {});
  }
  const failed = h.checks.filter((c) => !c.pass);
  console.log(error ? 'ERROR (' + failed.length + ' failed before it)' : failed.length ? 'FAILED ' + failed.length + ' of ' + h.checks.length : 'PASS ' + h.checks.length + ' checks');
  console.log('screenshots:', outDir);
  session.releaseAll();
  fs.rmSync(tmp, { recursive: true, force: true });
  return !error && failed.length === 0;
}

module.exports = { runGui, makeHarness };
