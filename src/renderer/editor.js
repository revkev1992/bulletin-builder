// Phase 2a editor: select, move, resize, snap, nudge, lock, delete, undo, save.
// The model is the week object; every change goes through commit(), which snapshots the half for
// undo, mutates the model, and re-renders the affected pages with the same renderer the PDF uses.
// Design notes: docs/PHASE2_DESIGN.md.

const SNAP_PX = 6;            // snapping distance on screen
const DRAG_START_PX = 3;      // a click that moves less than this is just a click
const NUDGE = 1, NUDGE_BIG = 9;
const UNDO_LIMIT = 100;
const AUTOSAVE_MS = 2 * 60 * 1000;
const MIN_SIZE = 4;           // points
const r2 = (v) => Math.round(v * 100) / 100;

export class Editor {
  constructor(app) {
    this.app = app;           // { week(), file(), shellOf(n), pageNumbers(), rerender(nums), setStatus(html), reload() }
    this.half = null;         // claimed half, or null = view only
    this.sel = null;          // { page, id }  (id of a TOP-LEVEL frame)
    this.lastPage = null;
    this.undo = [];
    this.redo = [];
    this.dirty = false;
    this.drag = null;
    setInterval(() => { if (this.dirty && this.half) this.save({ quiet: true }); }, AUTOSAVE_MS);
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  // ------------------------------------------------------------ model helpers
  week() { return this.app.week(); }
  halfOf(n) { const p = this.week().manifest.pages.find((x) => x.number === n); return p && p.half; }
  pageEntry(n) { const h = this.week().halves[this.halfOf(n)]; return h && h.pages[String(n)]; }
  editable(n) { return !!this.half && this.halfOf(n) === this.half; }
  pageSize() { return this.week().manifest.page; }

  topFrame(n, id) {
    const pg = this.pageEntry(n);
    if (!pg) return null;
    const contains = (f) => f.id === id || (f.children || []).some(contains);
    return pg.frames.find(contains) || null;
  }
  frame() { return this.sel ? this.topFrame(this.sel.page, this.sel.id) : null; }
  locked(n, f) { const pg = this.pageEntry(n); return !!(pg && pg.locked) || !!(f && f.locked); }

  static each(f, fn) { fn(f); (f.children || []).forEach((c) => Editor.each(c, fn)); }

  static moved(f, dx, dy) {
    const c = structuredClone(f);
    Editor.each(c, (g) => { g.x = r2(g.x + dx); g.y = r2(g.y + dy); });
    return c;
  }

  static resized(f, box) {
    const c = structuredClone(f);
    const sx = box.w / (f.w || 1), sy = box.h / (f.h || 1);
    Editor.each(c, (g) => {
      g.x = r2(box.x + (g.x - f.x) * sx);
      g.y = r2(box.y + (g.y - f.y) * sy);
      g.w = r2(g.w * sx);
      g.h = r2(g.h * sy);
    });
    return c;
  }

  // ------------------------------------------------------------ commits, undo, save
  commit(pages, mutate) {
    const half = this.week().halves[this.half];
    this.undo.push(JSON.stringify(half));
    if (this.undo.length > UNDO_LIMIT) this.undo.shift();
    this.redo = [];
    mutate();
    this.setDirty(true);
    return this.app.rerender(pages).then(() => this.drawSelection());
  }

  restore(fromStack, toStack) {
    if (!this.half || !fromStack.length) return Promise.resolve();
    const halves = this.week().halves;
    toStack.push(JSON.stringify(halves[this.half]));
    halves[this.half] = JSON.parse(fromStack.pop());
    this.setDirty(true);
    if (this.sel && !this.topFrame(this.sel.page, this.sel.id)) this.sel = null;
    const pages = this.app.pageNumbers().filter((n) => this.halfOf(n) === this.half);
    return this.app.rerender(pages).then(() => this.drawSelection());
  }

  setDirty(flag) {
    this.dirty = flag;
    window.bb.setDirty(flag);
    this.app.onState();
  }

  async save({ quiet = false } = {}) {
    if (!this.half) return false;
    try {
      const r = await window.bb.save(this.week().halves[this.half]);
      this.setDirty(false);
      if (!quiet) this.app.setStatus('Saved ' + new Date(r.savedAt).toLocaleTimeString());
      return true;
    } catch (err) {
      this.app.setStatus('<span class="warn">Not saved: ' + (err.message || err) + '</span>');
      return false;
    }
  }

  async claim(half) {
    if (this.dirty && this.half && !(await this.save())) return false;
    const r = await window.bb.claim(this.app.file(), half);
    if (!r.ok) {
      const h = r.holder;
      const since = h.since ? new Date(h.since).toLocaleString() : 'earlier';
      this.app.setStatus('<span class="warn">' + h.user + ' is editing the ' + half + ' pages on ' + h.machine +
        ' (since ' + since + '). You can look, but not change them until they close it.</span>');
      return false;
    }
    await this.app.reload();          // pick up anything saved since this week was opened
    this.half = half;
    this.undo = []; this.redo = [];
    this.sel = null;
    this.setDirty(false);
    this.app.setStatus('Editing the ' + half + ' pages' + (r.tookOverStale ? ' (an abandoned lock was taken over)' : '') + '.');
    this.drawSelection();
    return true;
  }

  async release() {
    if (this.dirty && !(await this.save())) return;
    await window.bb.release();
    this.half = null;
    this.sel = null;
    this.drawSelection();
    this.app.onState();
  }

  async command(name) {
    if (name.startsWith('claim:')) return this.claim(name.slice(6));
    switch (name) {
      case 'release': return this.release();
      case 'save': return this.save();
      case 'save-and-close': if (await this.save()) window.bb.closeWindow(); return;
      case 'undo': return this.restore(this.undo, this.redo);
      case 'redo': return this.restore(this.redo, this.undo);
      case 'lock-frame': return this.toggleFrameLock();
      case 'lock-page': return this.togglePageLock();
      case 'delete': return this.deleteFrame();
    }
  }

  // ------------------------------------------------------------ operations
  apply(n, newFrame) {
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      const i = pg.frames.findIndex((f) => f.id === newFrame.id);
      pg.frames[i] = newFrame;
    });
  }

  moveBy(dx, dy) {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return Promise.resolve(false);
    return this.apply(this.sel.page, Editor.moved(f, dx, dy)).then(() => true);
  }

  setBox(box, { keepAspect } = {}) {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return Promise.resolve(false);
    const b = { ...box };
    if (keepAspect ?? this.keepsAspect(f)) {
      const ratio = f.h / (f.w || 1);
      if (box.w !== f.w) b.h = b.w * ratio; else if (box.h !== f.h) b.w = b.h / (ratio || 1);
    }
    b.w = Math.max(MIN_SIZE, b.w); b.h = Math.max(f.h < 1 ? 0 : MIN_SIZE, b.h);
    return this.apply(this.sel.page, Editor.resized(f, b)).then(() => true);
  }

  keepsAspect(f) {
    let pic = false;
    Editor.each(f, (g) => { if (g.kind === 'image') pic = true; });
    return pic && f.kind === 'image';
  }

  toggleFrameLock() {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page)) return;
    return this.commit([this.sel.page], () => {
      const live = this.topFrame(this.sel.page, this.sel.id);
      if (live.locked) delete live.locked; else live.locked = true;
    });
  }

  togglePageLock() {
    const n = this.sel ? this.sel.page : this.lastPage;
    if (n == null || !this.editable(n)) return;
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      if (pg.locked) delete pg.locked; else pg.locked = true;
    });
  }

  deleteFrame() {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return;
    const n = this.sel.page;
    this.sel = null;
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      pg.frames = pg.frames.filter((x) => x.id !== f.id);
    });
  }

  select(n, id) {
    this.sel = id ? { page: n, id } : null;
    if (n != null) this.lastPage = n;
    this.drawSelection();
  }

  // ------------------------------------------------------------ snapping
  snapLines(n, excludeId) {
    const { width: W, height: H } = this.pageSize();
    const m = this.week().manifest.margins || {};
    const odd = n % 2 === 1;
    const inside = m.inside ?? 36, outside = m.outside ?? 36;
    const left = odd ? inside : outside, right = odd ? outside : inside;
    const xs = [0, W / 2, W, left, W - right];
    const ys = [0, H / 2, H, m.top ?? 36, H - (m.bottom ?? 36)];
    const pg = this.pageEntry(n) || { frames: [] };
    for (const g of pg.guides || []) (g.axis === 'horizontal' ? ys : xs).push(g.pos);
    for (const f of pg.frames) {
      if (f.id === excludeId) continue;
      xs.push(f.x, f.x + f.w / 2, f.x + f.w);
      ys.push(f.y, f.y + f.h / 2, f.y + f.h);
    }
    return { xs, ys };
  }

  // best adjustment that brings one of `moving` onto one of `lines`, within `tol`
  static snap1(moving, lines, tol) {
    let best = null;
    for (const v of moving) for (const l of lines) {
      const d = l - v;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: l };
    }
    return best;
  }

  // ------------------------------------------------------------ pointer
  ptOf(n, e) {
    const pageEl = this.app.shellOf(n).querySelector('.page');
    const r = pageEl.getBoundingClientRect();
    const scale = r.width / this.pageSize().width;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, scale };
  }

  onDown(e, n) {
    if (e.button !== 0) return;
    this.lastPage = n;
    const handle = e.target.closest('.handle');
    const frameEl = e.target.closest('.frame');
    if (handle && this.sel) {
      return this.beginDrag(e, n, 'resize', handle.dataset.h);
    }
    if (!frameEl) { this.select(n, null); return; }
    const top = this.topFrame(n, frameEl.dataset.id);
    if (!top) return;
    if (!this.half) {
      this.app.setStatus('View only. Choose Edit ▸ Worship Pages or Edit ▸ Announcements Pages to make changes.');
      return;
    }
    if (!this.editable(n)) {
      this.select(null, null);
      this.app.setStatus('Page ' + n + ' belongs to the ' + this.halfOf(n) + ' half. You are editing the ' + this.half + ' pages.');
      return;
    }
    this.select(n, top.id);
    e.preventDefault();
    this.beginDrag(e, n, 'move');
  }

  beginDrag(e, n, mode, handle) {
    const f = this.frame();
    if (!f || this.locked(n, f)) {
      if (f) this.app.setStatus('This ' + (this.pageEntry(n).locked ? 'page' : 'frame') + ' is locked. Unlock it to move it.');
      return;
    }
    const p = this.ptOf(n, e);
    this.drag = { n, mode, handle, start: p, cx: e.clientX, cy: e.clientY, orig: structuredClone(f), started: false, alt: e.altKey, shift: e.shiftKey };
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.started && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < DRAG_START_PX) return;
    d.started = true;
    const p = this.ptOf(d.n, e);
    const tol = SNAP_PX / p.scale;
    let dx = p.x - d.start.x, dy = p.y - d.start.y;
    const o = d.orig;
    const lines = e.altKey ? { xs: [], ys: [] } : this.snapLines(d.n, o.id);
    const guides = [];
    let preview;
    if (d.mode === 'move') {
      const sx = Editor.snap1([o.x + dx, o.x + dx + o.w / 2, o.x + dx + o.w], lines.xs, tol);
      const sy = Editor.snap1([o.y + dy, o.y + dy + o.h / 2, o.y + dy + o.h], lines.ys, tol);
      if (sx) { dx += sx.d; guides.push({ axis: 'v', at: sx.at }); }
      if (sy) { dy += sy.d; guides.push({ axis: 'h', at: sy.at }); }
      preview = Editor.moved(o, dx, dy);
    } else {
      const h = d.handle;
      let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      if (h.includes('w')) x0 += dx;
      if (h.includes('e')) x1 += dx;
      if (h.includes('n')) y0 += dy;
      if (h.includes('s')) y1 += dy;
      const sx = Editor.snap1([h.includes('w') ? x0 : h.includes('e') ? x1 : NaN], lines.xs, tol);
      const sy = Editor.snap1([h.includes('n') ? y0 : h.includes('s') ? y1 : NaN], lines.ys, tol);
      if (sx) { if (h.includes('w')) x0 += sx.d; else x1 += sx.d; guides.push({ axis: 'v', at: sx.at }); }
      if (sy) { if (h.includes('n')) y0 += sy.d; else y1 += sy.d; guides.push({ axis: 'h', at: sy.at }); }
      let box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.max(MIN_SIZE, Math.abs(x1 - x0)), h: Math.abs(y1 - y0) };
      if (o.h >= 1) box.h = Math.max(MIN_SIZE, box.h);
      if (this.keepsAspect(o) || e.shiftKey) {
        const ratio = o.h / (o.w || 1);
        const byW = h === 'e' || h === 'w' || (h.length === 2 && Math.abs(box.w - o.w) >= Math.abs(box.h - o.h) / (ratio || 1));
        if (byW) { box.h = box.w * ratio; if (h.includes('n')) box.y = o.y + o.h - box.h; }
        else { box.w = box.h / (ratio || 1); if (h.includes('w')) box.x = o.x + o.w - box.w; }
      }
      preview = Editor.resized(o, box);
    }
    d.preview = preview;
    this.previewFrame(d.n, preview);
    this.drawSelection(preview, guides);
    this.showBox(preview);
  }

  async onUp() {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.started || !d.preview) return;
    await this.apply(d.n, d.preview);
  }

  previewFrame(n, f) {
    const shell = this.app.shellOf(n);
    Editor.each(f, (g) => {
      const el = shell.querySelector('.frame[data-id="' + g.id + '"]');
      if (!el) return;
      el.style.left = g.x + 'pt';
      el.style.top = g.y + 'pt';
      if (g.kind !== 'shape') { el.style.width = g.w + 'pt'; el.style.height = g.h + 'pt'; }
    });
  }

  // ------------------------------------------------------------ keyboard
  onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape') { this.select(this.lastPage, null); return; }
    if (!this.sel || !this.half) return;
    const step = e.shiftKey ? NUDGE_BIG : NUDGE;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); this.moveBy(...moves[e.key]); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteFrame(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); this.toggleFrameLock(); }
  }

  // ------------------------------------------------------------ selection drawing
  drawSelection(boxFrame, guides = []) {
    document.querySelectorAll('.sel-box, .snap-line').forEach((x) => x.remove());
    document.querySelectorAll('.page-shell').forEach((s) => {
      const n = Number(s.dataset.page);
      s.classList.toggle('not-mine', !!this.half && !this.editable(n));
      const pg = this.pageEntry(n);
      s.classList.toggle('page-locked', !!(pg && pg.locked));
    });
    const f = boxFrame || this.frame();
    if (f && this.sel) {
      const ov = this.app.shellOf(this.sel.page).querySelector('.overlay');
      const box = document.createElement('div');
      const isLocked = this.locked(this.sel.page, f);
      box.className = 'sel-box' + (isLocked ? ' locked' : '');
      Object.assign(box.style, { left: f.x + 'pt', top: f.y + 'pt', width: Math.max(f.w, 0.5) + 'pt', height: Math.max(f.h, 0.5) + 'pt' });
      if (!isLocked) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const k = document.createElement('div');
          k.className = 'handle h-' + h;
          k.dataset.h = h;
          box.appendChild(k);
        }
      } else {
        box.title = 'Locked (Ctrl+L to unlock)';
      }
      ov.appendChild(box);
      for (const g of guides) {
        const l = document.createElement('div');
        l.className = 'snap-line ' + g.axis;
        l.style[g.axis === 'v' ? 'left' : 'top'] = g.at + 'pt';
        ov.appendChild(l);
      }
    }
    if (!boxFrame) this.showBox(f);
    this.app.onState();
  }

  showBox(f) {
    this.app.onSelection(f && this.sel ? { frame: f, page: this.sel.page, locked: this.locked(this.sel.page, f) } : null);
  }
}
