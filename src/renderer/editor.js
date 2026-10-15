// Editor: select, move, resize, snap, nudge, lock, delete, undo, save (2a) + typing in frames and
// linked-story reflow (2b, the text side lives in textedit.js) + pictures (crop/fit/fill), insert,
// copy/paste, stacking order and the pasteboard (2c).
// The model is the week object; every change goes through commit(), which snapshots the half for
// undo, mutates the model, and re-renders the affected pages with the same renderer the PDF uses.
// Design notes: docs/PHASE2_DESIGN.md.

import { serializeFlow, formatSelection, pastePlain, reflowStory, joinStory, canon } from './textedit.js';
import { findOverflow, layoutTabs } from './render.js';

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
    this.textEdit = null;     // { n, id, before }
    this.crop = null;         // { n, id } while cropping a picture
    this.clipboard = null;    // a copied frame (deep copy)
    this.idSeq = 0;
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
  anyFrame(n, id) {
    const pg = this.pageEntry(n);
    let hit = null;
    if (pg) pg.frames.forEach((f) => Editor.each(f, (g) => { if (g.id === id) hit = g; }));
    return hit;
  }
  storyFrames(story) {
    const list = [];
    for (const n of this.app.pageNumbers()) {
      if (this.halfOf(n) !== this.half) continue;
      const pg = this.pageEntry(n);
      if (!pg) continue;
      pg.frames.forEach((f) => Editor.each(f, (g) => {
        if (g.text && g.text.chain && g.text.chain.story === story) list.push({ n, frame: g });
      }));
    }
    return list.sort((a, b) => a.frame.text.chain.index - b.frame.text.chain.index);
  }
  // pour a linked story through its frames again; returns the page numbers touched
  reflow(story) {
    const list = this.storyFrames(story);
    reflowStory(list, (x) => {
      const sh = this.app.shellOf(x.n);
      return sh && sh.querySelector('.frame[data-id="' + x.frame.id + '"] .text-area');
    }, this.week().manifest.defaultTabStop || 36);
    return [...new Set(list.map((x) => x.n))];
  }
  locked(n, f) { const pg = this.pageEntry(n); return !!(pg && pg.locked) || !!(f && f.locked); }

  static each(f, fn) { fn(f); (f.children || []).forEach((c) => Editor.each(c, fn)); }

  static moved(f, dx, dy) {
    const c = structuredClone(f);
    Editor.each(c, (g) => { g.x = r2(g.x + dx); g.y = r2(g.y + dy); });
    return c;
  }

  // Cropping keeps the picture where it is and at its size: an edge handle moves the frame edge and
  // changes the crop; dragging inside slides the picture within the frame.
  static cropped(f, mode, h, dx, dy) {
    const c = structuredClone(f);
    let [l, t, r, b] = (f.image && f.image.crop) || [0, 0, 0, 0];
    const FW = f.w / (1 - l - r), FH = f.h / (1 - t - b);
    if (mode === 'pan') {
      l -= dx / FW; r += dx / FW; t -= dy / FH; b += dy / FH;
    } else {
      let x0 = f.x, y0 = f.y, x1 = f.x + f.w, y1 = f.y + f.h;
      if (h.includes('w')) x0 = Math.min(x0 + dx, x1 - MIN_SIZE);
      if (h.includes('e')) x1 = Math.max(x1 + dx, x0 + MIN_SIZE);
      if (h.includes('n')) y0 = Math.min(y0 + dy, y1 - MIN_SIZE);
      if (h.includes('s')) y1 = Math.max(y1 + dy, y0 + MIN_SIZE);
      const ix = f.x - l * FW, iy = f.y - t * FH;   // picture's top-left stays put
      l = (x0 - ix) / FW; r = 1 - (x1 - ix) / FW; t = (y0 - iy) / FH; b = 1 - (y1 - iy) / FH;
      c.x = r2(x0); c.y = r2(y0); c.w = r2(x1 - x0); c.h = r2(y1 - y0);
    }
    c.image = { ...c.image, crop: [l, t, r, b].map((v) => Math.round(v * 100000) / 100000) };
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
    if (this.textEdit) {
      if (name === 'undo' || name === 'redo') { document.execCommand(name); return; }
      await this.endTextEdit();
    }
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
      case 'crop': return this.toggleCrop();
      case 'fit': return this.fitPicture('fit');
      case 'fill': return this.fitPicture('fill');
      case 'front': return this.restack(1);
      case 'back': return this.restack(-1);
      case 'copy': return this.copy();
      case 'paste': return this.paste();
      case 'duplicate': this.copy(); return this.paste();
      case 'insert-text': return this.insert('text');
      case 'insert-line': return this.insert('line');
      case 'insert-rect': return this.insert('rect');
      case 'insert-picture': return this.insertPicture();
      case 'to-pasteboard': return this.toPasteboard();
    }
  }

  // ------------------------------------------------------------ operations
  apply(n, newFrame) {
    const old = this.topFrame(n, newFrame.id);
    const resized = old && (Math.abs(old.w - newFrame.w) > 0.01 || Math.abs(old.h - newFrame.h) > 0.01);
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      const i = pg.frames.findIndex((f) => f.id === newFrame.id);
      pg.frames[i] = newFrame;
    }).then(async () => {
      if (!resized) return;
      const stories = new Set();
      Editor.each(newFrame, (g) => { if (g.text && g.text.chain) stories.add(g.text.chain.story); });
      for (const st of stories) await this.app.rerender(this.reflow(st));
      this.drawSelection();
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
    const stories = new Set();
    Editor.each(f, (g) => { if (g.text && g.text.chain) stories.add(g.text.chain.story); });
    return this.commit([n], () => {
      for (const st of stories) {
        const all = this.storyFrames(st);
        const keep = all.filter((x) => !(x.n === n && this.topFrame(n, x.frame.id) === f));
        if (keep.length && keep.length < all.length) {
          keep[0].frame.text.paragraphs = joinStory(all.map((x) => x.frame));
          keep.slice(1).forEach((x) => { x.frame.text.paragraphs = []; });
        }
      }
      const pg = this.pageEntry(n);
      pg.frames = pg.frames.filter((x) => x.id !== f.id);
    }).then(async () => {
      for (const st of stories) if (this.storyFrames(st).length) await this.app.rerender(this.reflow(st));
    });
  }

  // ------------------------------------------------------------ 2c operations
  newId() { return 'n' + Date.now().toString(36) + (this.idSeq++).toString(36); }

  targetPage() {
    const n = this.sel ? this.sel.page : this.lastPage;
    if (n != null && this.editable(n)) return n;
    return this.app.pageNumbers().find((k) => this.editable(k) && !this.pageEntry(k).locked) ?? null;
  }

  maxZ(n) { return Math.max(0, ...this.pageEntry(n).frames.flatMap((f) => { const z = []; Editor.each(f, (g) => z.push(g.z || 0)); return z; })); }

  addFrame(n, f) {
    return this.commit([n], () => { this.pageEntry(n).frames.push(f); }).then(() => { this.select(n, f.id); return f; });
  }

  insert(kind) {
    const n = this.targetPage();
    if (n == null) { this.app.setStatus('Click a page you are editing first.'); return; }
    if (this.pageEntry(n).locked) { this.app.setStatus('Page ' + n + ' is locked.'); return; }
    const { width: W, height: H } = this.pageSize();
    const z = this.maxZ(n) + 1;
    let f;
    if (kind === 'text') {
      f = { id: this.newId(), kind: 'text', x: r2(W / 2 - 108), y: r2(H / 2 - 36), w: 216, h: 72, z,
        text: { inset: [2.88, 2.88, 2.88, 2.88], valign: 'top',
          paragraphs: [{ style: 'Normal', align: 'left', mark: { font: 'Palatino Linotype', size: 11 },
            runs: [{ text: 'Type here', font: 'Palatino Linotype', size: 11 }] }] } };
    } else if (kind === 'line') {
      f = { id: this.newId(), kind: 'shape', shape: { type: 'line' }, x: r2(W / 2 - 108), y: r2(H / 2), w: 216, h: 0, z,
        stroke: { color: '#000000', width: 1 } };
    } else {
      f = { id: this.newId(), kind: 'shape', shape: { type: 'rect' }, x: r2(W / 2 - 72), y: r2(H / 2 - 36), w: 144, h: 72, z,
        stroke: { color: '#000000', width: 1 } };
    }
    return this.addFrame(n, f).then((nf) => {
      if (kind === 'text' && this.beginTextEdit(n, nf.id)) document.execCommand('selectAll');
      return nf;
    });
  }

  async insertPicture(src) {
    const n = this.targetPage();
    if (n == null) { this.app.setStatus('Click a page you are editing first.'); return; }
    const rel = src ? await window.bb.importPicturePath(this.app.file(), src) : await window.bb.importPicture(this.app.file());
    if (!rel) return;
    const size = await new Promise((res) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => res({ w: 4, h: 3 });
      im.src = new URL(rel, this.week().baseUrl).href;
    });
    const { width: W, height: H } = this.pageSize();
    const w = 216, h = r2(216 * size.h / size.w);
    return this.addFrame(n, { id: this.newId(), kind: 'image', x: r2(W / 2 - w / 2), y: r2(Math.max(36, H / 2 - h / 2)), w, h,
      z: this.maxZ(n) + 1, image: { asset: rel, crop: [0, 0, 0, 0], fit: 'crop' } });
  }

  toggleCrop(on) {
    const f = this.frame();
    if (!f || f.kind !== 'image' || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) { this.crop = null; this.drawSelection(); return; }
    this.crop = (on ?? !this.crop) ? { n: this.sel.page, id: f.id } : null;
    this.app.setStatus(this.crop ? 'Cropping: drag a handle to crop, drag the picture to slide it in the frame. Esc when done.' : '');
    this.drawSelection();
  }

  naturalSize(n, id) {
    const im = this.app.shellOf(n).querySelector('.frame[data-id="' + id + '"] img');
    return im && im.naturalWidth ? { w: im.naturalWidth, h: im.naturalHeight } : null;
  }

  // fit = whole picture inside the frame (blank bands); fill = frame covered, picture centred and cropped
  fitPicture(mode) {
    const f = this.frame();
    if (!f || f.kind !== 'image' || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return;
    const nat = this.naturalSize(this.sel.page, f.id);
    if (!nat) return;
    const A = nat.w / nat.h, F = f.w / f.h;
    let crop = [0, 0, 0, 0];
    const wider = A > F;
    if ((mode === 'fill') === wider) {
      // crop the sides (fill, wide picture) / pad the sides (fit, tall picture)
      const k = (1 - F / A) / 2;
      crop = [k, 0, k, 0];
    } else {
      const k = (1 - A / F) / 2;
      crop = [0, k, 0, k];
    }
    const c = structuredClone(f);
    c.image = { ...c.image, crop: crop.map((v) => Math.round(v * 100000) / 100000), fit: mode };
    return this.apply(this.sel.page, c);
  }

  restack(dir) {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return;
    const n = this.sel.page;
    const zs = this.pageEntry(n).frames.flatMap((g) => { const z = []; Editor.each(g, (h) => z.push(h.z || 0)); return z; });
    const mine = []; Editor.each(f, (g) => mine.push(g.z || 0));
    const delta = dir > 0 ? Math.max(...zs) + 1 - Math.min(...mine) : Math.min(...zs) - 1 - Math.max(...mine);
    const c = structuredClone(f);
    Editor.each(c, (g) => { g.z = (g.z || 0) + delta; });
    return this.apply(n, c);
  }

  copy() {
    const f = this.frame();
    if (!f) return;
    this.clipboard = { frame: structuredClone(f), page: this.sel.page };
    this.app.setStatus('Copied. Ctrl+V pastes it on the page you last clicked.');
  }

  paste() {
    if (!this.clipboard) return;
    const n = this.targetPage();
    if (n == null || this.pageEntry(n).locked) return;
    const c = structuredClone(this.clipboard.frame);
    const shift = n === this.clipboard.page ? 9 : 0;
    const top = this.maxZ(n) + 1;
    const base = Math.min(...(() => { const z = []; Editor.each(c, (g) => z.push(g.z || 0)); return z; })());
    Editor.each(c, (g) => {
      g.id = this.newId();
      g.x = r2(g.x + shift); g.y = r2(g.y + shift);
      g.z = top + (g.z || 0) - base;
      delete g.locked;
      delete g.source;
      if (g.text) { delete g.text.chain; g.text.paragraphs.forEach((p) => delete p.continues); }
    });
    this.clipboard.page = n;           // repeated pastes step down from the last one
    this.clipboard.frame = structuredClone(c);
    return this.addFrame(n, c);
  }

  toPasteboard() {
    const f = this.frame();
    if (!f || !this.editable(this.sel.page) || this.locked(this.sel.page, f)) return;
    const n = this.sel.page;
    this.sel = null;
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      pg.frames = pg.frames.filter((x) => x.id !== f.id);
      const c = structuredClone(f);
      Editor.each(c, (g) => { if (g.text) delete g.text.chain; });
      (this.week().halves[this.half].pasteboard ||= []).push(c);
    }).then(() => this.app.setStatus('Moved to the pasteboard (Pasteboard button to see it).'));
  }

  // place a pasteboard item on a page, centred, keeping its size
  placeFromPasteboard(id, n) {
    n = n ?? this.targetPage();
    if (n == null || !this.editable(n) || this.pageEntry(n).locked) return Promise.resolve(null);
    const pb = this.week().halves[this.half].pasteboard || [];
    const i = pb.findIndex((f) => f.id === id);
    if (i < 0) return Promise.resolve(null);
    const { width: W, height: H } = this.pageSize();
    const f = pb[i];
    const dx = W / 2 - (f.x + f.w / 2), dy = H / 2 - (f.y + f.h / 2);
    const placed = Editor.moved(f, dx, dy);
    const top = this.maxZ(n) + 1;
    const zs = []; Editor.each(placed, (g) => zs.push(g.z || 0));
    const base = Math.min(...zs);
    Editor.each(placed, (g) => { g.z = top + (g.z || 0) - base; });
    return this.commit([n], () => {
      pb.splice(i, 1);
      this.pageEntry(n).frames.push(placed);
    }).then(() => { this.select(n, placed.id); return placed; });
  }

  select(n, id) {
    if (this.crop && (!id || id !== this.crop.id)) this.crop = null;
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
    if (this.textEdit) {
      const editing = this.app.shellOf(this.textEdit.n).querySelector('.frame.editing');
      if (editing && editing.contains(e.target)) return;
      this.endTextEdit();
    }
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
    if (this.crop && f && f.id === this.crop.id && mode === 'move') mode = 'pan';
    if (this.crop && f && f.id === this.crop.id && mode === 'resize') mode = 'crop';
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
    if (d.mode === 'pan' || d.mode === 'crop') {
      preview = Editor.cropped(o, d.mode, d.handle, dx, dy);
    } else if (d.mode === 'move') {
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

  // ------------------------------------------------------------ typing (2b)
  onDblClick(e, n) {
    const pic = e.target.closest('.frame-image');
    if (pic && this.editable(n)) {
      const top = this.topFrame(n, pic.dataset.id);
      if (top && top.id === pic.dataset.id && !this.locked(n, top)) { this.sel = { page: n, id: top.id }; this.toggleCrop(true); }
      return;
    }
    const el = e.target.closest('.frame-text');
    if (!el || !this.editable(n)) return;
    this.beginTextEdit(n, el.dataset.id, e);
  }

  beginTextEdit(n, id, e) {
    const f = this.anyFrame(n, id);
    const top = this.topFrame(n, id);
    if (!f || f.kind !== 'text' || !this.editable(n) || this.locked(n, top)) return false;
    if (this.textEdit) this.endTextEdit();
    this.sel = { page: n, id: top.id };
    this.textEdit = { n, id, before: JSON.stringify(this.week().halves[this.half]), dirtyBefore: this.dirty };
    const el = this.app.shellOf(n).querySelector('.frame[data-id="' + id + '"]');
    const flow = el.querySelector('.flow');
    el.classList.add('editing');
    flow.contentEditable = 'true';
    flow.spellcheck = true;
    flow.addEventListener('paste', pastePlain);
    let t = null;
    flow.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { layoutTabs(el, this.week().manifest.defaultTabStop || 36); findOverflow(el); }, 250);
      this.setDirty(true);
    });
    flow.focus();
    const r = e && document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (r && flow.contains(r.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    this.drawSelection();
    this.app.onTextMode(true);
    return true;
  }

  editingFlow() {
    if (!this.textEdit) return null;
    const el = this.app.shellOf(this.textEdit.n).querySelector('.frame[data-id="' + this.textEdit.id + '"]');
    return el && el.querySelector('.flow');
  }

  format(cmd, value) {
    const flow = this.editingFlow();
    if (!flow) return;
    formatSelection(cmd, value, flow);
    this.setDirty(true);
  }

  async endTextEdit() {
    const t = this.textEdit;
    if (!t) return;
    this.textEdit = null;
    const flow = this.editingFlow.call({ textEdit: t, app: this.app });
    const f = this.anyFrame(t.n, t.id);
    const paras = flow ? serializeFlow(flow) : f.text.paragraphs;
    this.app.onTextMode(false);
    if (canon(paras) === canon(f.text.paragraphs)) {
      this.setDirty(t.dirtyBefore);
      await this.app.rerender([t.n]);
      this.drawSelection();
      return;
    }
    this.undo.push(t.before);
    if (this.undo.length > UNDO_LIMIT) this.undo.shift();
    this.redo = [];
    f.text.paragraphs = paras;
    const pages = new Set([t.n]);
    await this.app.rerender([t.n]);
    if (f.text.chain) for (const n of this.reflow(f.text.chain.story)) pages.add(n);
    this.setDirty(true);
    await this.app.rerender([...pages]);
    this.drawSelection();
  }

  // ------------------------------------------------------------ keyboard
  onKey(e) {
    if (this.textEdit) {
      if (e.key === 'Escape') { e.preventDefault(); this.endTextEdit(); return; }
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); return; }
    }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape') { if (this.crop) { this.toggleCrop(); return; } this.select(this.lastPage, null); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && this.half && ['c', 'v', 'd'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      return this.command({ c: 'copy', v: 'paste', d: 'duplicate' }[e.key.toLowerCase()]);
    }
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
      box.className = 'sel-box' + (isLocked ? ' locked' : '') + (this.textEdit ? ' typing' : '') + (this.crop && this.crop.id === f.id ? ' cropping' : '');
      Object.assign(box.style, { left: f.x + 'pt', top: f.y + 'pt', width: Math.max(f.w, 0.5) + 'pt', height: Math.max(f.h, 0.5) + 'pt' });
      if (!isLocked && !this.textEdit) {
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
