// Editor: select, move, resize, snap, nudge, lock, delete, undo, save (2a) + typing in frames and
// linked-story reflow (2b, the text side lives in textedit.js).
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

  // ------------------------------------------------------------ typing (2b)
  onDblClick(e, n) {
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
      box.className = 'sel-box' + (isLocked ? ' locked' : '') + (this.textEdit ? ' typing' : '');
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
