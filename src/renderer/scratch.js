// Parked objects: kept with the week, never printed (Kevin 2026-10-27). Two places, each shown or hidden
// from the View tab and remembered on this PC:
//   • the Shelf — a strip down the left of the window that stays put while the pages scroll and scrolls
//     on its own; items are shown small enough to fit (Kevin's way: park, scroll, drag on)
//   • the Scratch Area — Publisher's free-form grey area beside the pages, scrolling with them (the
//     communications person's way; Publisher's own scratch items come across here). Off by default;
//     while it is off its items are on the shelf
// Items are each half's `pasteboard` list: `shelf: true`, or `fx`/`fy` = points from the top-left of
// the pages column (.spreads) at 100%. Items with neither (parked before 2026-10-27, or imported from
// Publisher) are laid out in the scratch area as Publisher had them, to the right of the pages.
import { renderPasteboard } from './render.js';

const PX = 96 / 72;          // CSS px per point
const PAD = 36;              // renderPasteboard's margin round an item (pt)
const THUMB_W = 120;         // px: the shelf is 150px wide (styles.css --shelf-w)

const remembered = (key, dflt) => { try { const v = localStorage.getItem(key); return v == null ? dflt : v === '1'; } catch (_) { return dflt; } };
const remember = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch (_) { /* not kept */ } };

export class Scratch {
  // app: { week(), editor(), zoom(), settle(root), setStatus(msg), onLayout() }
  constructor(app) {
    this.app = app;
    // the free-form area is built but off until someone turns it on (Kevin 2026-10-27: "not use it yet")
    this.showFree = remembered('bb.scratch.free', false);
    this.showShelf = remembered('bb.scratch.shelf', true);
    this.sel = null;            // id of the selected parked item
    this.sig = '';
    this.shelf = document.createElement('div');
    this.shelf.id = 'shelf';
    this.shelf.innerHTML = '<div class="shelf-title">Shelf</div><div class="shelf-items"></div><div class="shelf-empty">Drag things here to keep them handy. Never printed.</div>';
    this.shelf.addEventListener('pointerdown', (e) => this.onDown(e));
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.scratch-item')) this.deselect(); }, true);
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.body.classList.toggle('no-shelf', !this.showShelf);
    document.body.classList.toggle('no-scratch', !this.showFree);
  }

  mount() {
    const wrap = document.getElementById('stage-wrap');
    if (wrap && this.shelf.parentElement !== wrap) wrap.appendChild(this.shelf);
  }

  set(which, on) {
    if (which === 'free') { this.showFree = on; remember('bb.scratch.free', on); document.body.classList.toggle('no-scratch', !on); }
    else { this.showShelf = on; remember('bb.scratch.shelf', on); document.body.classList.toggle('no-shelf', !on); }
    this.deselect();
    this.render(true);
    this.app.onLayout();
  }

  spreads() { return document.querySelector('#stage .spreads'); }

  // free-form places of items that have none yet: Publisher's arrangement, right of the pages
  freePlaces(week) {
    const out = new Map();
    const sp = document.querySelector('#stage .spread');
    const wrap = this.spreads();
    const z = this.app.zoom();
    let x0 = 0;
    if (sp && wrap) x0 = (sp.getBoundingClientRect().right - wrap.getBoundingClientRect().left) / (z * PX) + 48;
    for (const body of Object.values(week.halves)) {
      const loose = (body.pasteboard || []).filter((f) => !f.shelf && f.fx == null);
      if (!loose.length) continue;
      const minX = Math.min(...loose.map((f) => f.x)), minY = Math.min(...loose.map((f) => f.y));
      const maxX = Math.max(...loose.map((f) => f.x + f.w));
      for (const f of loose) out.set(f.id, { x: x0 + f.x - minX, y: 24 + f.y - minY });
      x0 += maxX - minX + 48;
    }
    return out;
  }

  board(week, h, f) {
    const b = renderPasteboard({ ...week, halves: { [h]: { pages: {}, pasteboard: [f] } } });
    if (b) b.classList.add('scratch-board');
    return b;
  }

  itemEl(h, f, mine) {
    const item = document.createElement('div');
    item.className = 'scratch-item' + (mine ? ' mine' : '') + (this.sel === f.id ? ' selected' : '');
    item.dataset.id = f.id;
    item.dataset.half = h;
    item.title = mine ? 'Parked (never printed). Drag it onto a page to use it; Delete removes it.' : 'Parked by the ' + h + ' pages (never printed). Drag it onto one of your pages to use a copy.';
    return item;
  }

  render(force = false) {
    this.mount();
    const week = this.app.week();
    const ed = this.app.editor();
    const z = this.app.zoom();
    const sig = week ? JSON.stringify([z, ed && ed.half, this.showFree, this.showShelf,
      Object.values(week.halves).map((h) => (h.pasteboard || []).map((f) => [f.id, f.shelf, f.fx, f.fy, f.w, f.h, f.rotation]))]) : '';
    const wrap = this.spreads();
    if (!force && sig === this.sig && (!wrap || wrap.querySelector(':scope > .free-area'))) return;
    this.sig = sig;
    const list = this.shelf.querySelector('.shelf-items');
    const keep = this.shelf.scrollTop;      // a redraw must not lose your place on the shelf
    list.innerHTML = '';
    if (wrap) wrap.querySelectorAll(':scope > .free-area').forEach((x) => x.remove());
    if (!week) { this.shelf.classList.add('empty'); this.ids = null; return; }
    const free = document.createElement('div');
    free.className = 'free-area';
    const places = this.freePlaces(week);
    let onShelf = 0;
    // every parked id shown last time, on the shelf or in the scratch area (another week = start over)
    const seen = this.idsWeek === week ? this.ids : null;
    this.idsWeek = week;
    this.ids = new Set();
    let fresh = null;
    for (const [h, body] of Object.entries(week.halves)) {
      const mine = !!(ed && ed.half === h);
      for (const f of body.pasteboard || []) {
        const b = this.board(week, h, f);
        if (!b) continue;
        const item = this.itemEl(h, f, mine);
        this.ids.add(f.id);
        // with the scratch area hidden, everything is on the shelf — nothing parked is ever out of reach
        if (f.shelf || !this.showFree) {
          onShelf++;
          // shown small enough to fit the shelf (it goes on a page at full size)
          const s = Math.min(1, THUMB_W / ((f.w + 2 * PAD) * PX));
          b.style.zoom = s;
          item.style.height = (f.h + 2 * PAD) * PX * s + 'px';
          item.appendChild(b);
          list.appendChild(item);
          if (seen && !seen.has(f.id)) fresh = item;
        } else {
          const at = f.fx != null ? { x: f.fx, y: f.fy } : places.get(f.id);
          item.style.left = (at.x - PAD) + 'pt';
          item.style.top = (at.y - PAD) + 'pt';
          item.appendChild(b);
          free.appendChild(item);
        }
      }
    }
    this.shelf.classList.toggle('empty', !onShelf);
    this.shelf.scrollTop = keep;
    // something just put on the shelf (Park, a drag off a page, Undo of a delete) is scrolled into
    // view and flashed: the shelf can be long, and new things go at the end
    if (fresh) { fresh.scrollIntoView({ block: 'nearest' }); fresh.classList.add('fresh'); setTimeout(() => fresh.classList.remove('fresh'), 1500); }
    if (wrap) wrap.appendChild(free);
    this.app.settle(this.shelf);
    if (wrap) this.app.settle(free);
  }

  // ---- where a drop lands
  overShelf(x, y) {
    if (!this.showShelf) return false;
    const r = this.shelf.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  // scratch-area points (fx, fy) for a spot on screen
  freePoint(x, y) {
    const r = this.spreads().getBoundingClientRect();
    const z = this.app.zoom();
    return { fx: Math.round((x - r.left) / (z * PX) * 100) / 100, fy: Math.round((y - r.top) / (z * PX) * 100) / 100 };
  }
  // a page object dropped off its page (editor.js): its top-left and the pointer, on screen
  destFor(left, top, px, py) {
    if (this.overShelf(px, py) || !this.showFree) return { shelf: true };
    return this.freePoint(left, top);
  }

  deselect() {
    if (this.sel == null) return;
    this.sel = null;
    for (const it of document.querySelectorAll('.scratch-item.selected')) it.classList.remove('selected');
  }

  // ---- pointer: shelf items and free-form items
  onDown(e) {
    const item = e.target.closest('.scratch-item');
    if (!item || e.button !== 0 || !e.target.closest('.frame')) return;
    e.preventDefault();
    e.stopPropagation();
    const ed = this.app.editor();
    if (!ed || !ed.half) {
      this.app.setStatus('View only. Click "View only" at the top right (or Bulletin ▸ I am changing) to use parked items.');
      if (this.app.flashMode) this.app.flashMode();
      return;
    }
    // the other half's items can be used too: dragged onto your page they are copied (Kevin batch 3:
    // "I wasn't able to drag and drop from the shelf. Or even click on them")
    if (!item.classList.contains('mine')) this.app.setStatus('Parked by the ' + item.dataset.half + ' pages: drag it onto one of your pages to use a copy (theirs stays on the shelf).');
    if (ed.textEdit) ed.endTextEdit();
    ed.select(null, null);
    this.deselect();
    this.sel = item.dataset.id;
    item.classList.add('selected');
    const onShelf = !!item.closest('#shelf');
    const r = item.getBoundingClientRect();
    this.drag = { item, onShelf, cx: e.clientX, cy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, started: false };
    const move = (ev) => this.onMove(ev);
    const up = (ev) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.onUp(ev); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 4) return;
      d.started = true;
      // the item follows the mouse above everything (at full size when it leaves the shelf)
      const f = this.model(d.item.dataset.id);
      const z = this.app.zoom();
      d.ghost = document.createElement('div');
      d.ghost.className = 'scratch-ghost';
      const b = this.board(this.app.week(), d.item.dataset.half, f);
      b.style.zoom = z;
      d.ghost.appendChild(b);
      document.body.appendChild(d.ghost);
      this.app.settle(d.ghost);
      // grab point: the same spot of the object, at full size
      const s = d.onShelf ? (f.w + 2 * PAD) * PX * z / d.item.getBoundingClientRect().width : 1;
      d.gx = d.ox * s; d.gy = d.oy * s;
      d.item.classList.add('dragging');
    }
    d.ghost.style.left = e.clientX - d.gx + 'px';
    d.ghost.style.top = e.clientY - d.gy + 'px';
  }

  model(id) {
    for (const h of Object.values(this.app.week().halves)) { const f = (h.pasteboard || []).find((g) => g.id === id); if (f) return f; }
    return null;
  }

  async onUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.started) return;
    const z = this.app.zoom();
    const gr = d.ghost.getBoundingClientRect();
    d.ghost.remove();
    d.item.classList.remove('dragging');
    const left = gr.left + PAD * z * PX, top = gr.top + PAD * z * PX;    // the object's top-left on screen
    const ed = this.app.editor();
    const id = d.item.dataset.id;
    const under = ed.pageAt(e.clientX, e.clientY);
    if (under) {
      const n = under.n;
      if (ed.editable(n) && !ed.pageEntry(n).locked) {
        const scale = under.r.width / ed.pageSize().width;
        this.sel = null;
        const from = d.item.dataset.half;
        await ed.placeFromPasteboard(id, n, { x: (left - under.r.left) / scale, y: (top - under.r.top) / scale }, from);
        this.app.setStatus(from === ed.half ? 'Put on page ' + n + '.' : 'A copy is on page ' + n + ' (the ' + from + ' pages keep theirs on the shelf).');
        return;
      }
      this.app.setStatus(ed.pageEntry(n).locked ? 'Page ' + n + ' is locked.' : 'Page ' + n + ' belongs to the ' + ed.halfOf(n) + ' pages.');
      this.render(true);
      return;
    }
    // only its own half moves it about the shelf / scratch area
    if (d.item.dataset.half !== ed.half) { this.render(true); return; }
    if (this.overShelf(e.clientX, e.clientY)) {
      if (!d.onShelf) await ed.moveInScratch(id, { shelf: true });
      return;
    }
    if (!this.showFree) { this.render(true); return; }
    await ed.moveInScratch(id, this.freePoint(left, top));
  }

  onKey(e) {
    if (this.sel == null) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape') { this.deselect(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const id = this.sel;
      const ed = this.app.editor();
      const it = document.querySelector('.scratch-item[data-id="' + id + '"]');
      if (it && ed && it.dataset.half !== ed.half) { this.app.setStatus('Only the ' + it.dataset.half + ' pages can delete that parked item.'); return; }
      this.sel = null;
      ed.deleteFromScratch(id);
    }
  }
}
