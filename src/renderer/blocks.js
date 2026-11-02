// Insert ▸ Building Blocks (Publisher's Page Parts / Borders & Accents / Calendars): reusable snippets.
// Select some objects on a page ▸ "Add to Building Blocks…" (the pane, or the right-click menu) names
// and files them; the pane shows every saved block as a thumbnail; Insert puts a copy on the page
// you are editing (new ids, pictures copied into the week). The library is a "Building Blocks" folder
// beside the week folders (main.js blocks:*), shared like the Service Music library.
import { modal } from './pagedialogs.js';
import { renderFrames } from './render.js';

export const CATS = { parts: 'Page Parts', borders: 'Borders & Accents', calendars: 'Calendars', other: 'Other' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const THUMB_W = 230;   // px: the pane's inner width

export class BlocksPane {
  // app: { file(), editor(), week(), setStatus(html), flashMode() }
  constructor(app) {
    this.app = app;
    this.cat = 'parts';
    this.sel = null;
    this.items = [];
    const el = document.createElement('aside');
    el.id = 'blockspane';
    el.hidden = true;
    el.innerHTML =
      '<div class="fp-head"><span>Building Blocks</span><button type="button" class="bk-close" title="Close">✕</button></div>' +
      '<div class="mu-cats bk-cats">' + Object.entries(CATS).map(([k, label]) => '<button type="button" data-cat="' + k + '">' + label + '</button>').join('') + '</div>' +
      '<input type="search" class="mu-find bk-find" placeholder="Find by name" spellcheck="false">' +
      '<div class="mu-list bk-list"></div>' +
      '<div class="mu-sel bk-sel"><div class="mu-sel-label"></div>' +
      '<div class="mu-buttons"><button type="button" class="mu-insert bk-insert">Insert</button><button type="button" class="bk-rename">Rename…</button><button type="button" class="bk-remove">Remove</button></div></div>' +
      '<div class="mu-foot"><button type="button" class="bk-add">Add selection to Building Blocks…</button></div>';
    document.getElementById('body').appendChild(el);
    this.el = el;
    el.addEventListener('mousedown', (e) => { if (!e.target.closest('input, select')) e.preventDefault(); });   // keep the page selection
    this.find = el.querySelector('.bk-find');
    el.querySelector('.bk-close').onclick = () => this.hide();
    for (const b of el.querySelectorAll('.bk-cats button')) b.onclick = () => { this.cat = b.dataset.cat; this.sel = null; this.find.value = ''; this.draw(); };
    this.find.addEventListener('input', () => this.draw());
    el.querySelector('.bk-insert').onclick = () => this.insert(this.sel);
    el.querySelector('.bk-rename').onclick = () => this.rename(this.sel);
    el.querySelector('.bk-remove').onclick = () => this.remove(this.sel);
    el.querySelector('.bk-add').onclick = () => this.addSelection();
  }

  get shown() { return !this.el.hidden; }
  async show(cat) {
    if (cat && CATS[cat]) { this.cat = cat; this.sel = null; }
    this.el.hidden = false;
    for (const id of ['findpane', 'musicpane', 'gmpane']) { const p = document.getElementById(id); if (p) p.hidden = true; }
    await this.load();
  }
  hide() { this.el.hidden = true; }
  toggle(cat) { return this.shown && (!cat || cat === this.cat) ? this.hide() : this.show(cat); }

  async load() {
    if (!this.app.file()) { this.items = []; this.draw(); return; }
    const lib = await window.bb.blocks.list(this.app.file());
    this.items = lib.items;
    this.baseUrl = lib.baseUrl;
    this.draw();
  }
  item(id) { return this.items.find((x) => x.id === id); }

  draw() {
    const el = this.el;
    for (const b of el.querySelectorAll('.bk-cats button')) b.classList.toggle('active', b.dataset.cat === this.cat);
    const q = this.find.value.trim().toLowerCase();
    const list = el.querySelector('.bk-list');
    const mine = this.items.filter((x) => x.category === this.cat && (!q || x.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = mine.length ? '' : '<div class="mu-empty">' + (q ? 'No ' + CATS[this.cat].toLowerCase() + ' match “' + esc(q) + '”.'
      : 'Nothing saved here yet. Select objects on a page, then “Add selection to Building Blocks…”.') + '</div>';
    for (const it of mine) {
      const d = document.createElement('div');
      d.className = 'mu-item bk-item' + (it.id === this.sel ? ' selected' : '');
      d.dataset.id = it.id;
      d.title = it.name + ' — double-click to insert';
      const thumb = document.createElement('div');
      thumb.className = 'bk-thumb';
      try {
        const box = renderFrames(it.frames, this.baseUrl, this.app.week() ? this.app.week().manifest.pages.length : null);
        const scale = Math.min(1, THUMB_W / (it.w * 96 / 72));
        box.style.transform = 'scale(' + scale + ')';
        box.style.transformOrigin = 'top left';
        thumb.style.height = Math.ceil(it.h * 96 / 72 * scale) + 'px';
        thumb.appendChild(box);
      } catch (_) { thumb.textContent = '?'; }
      d.appendChild(thumb);
      d.insertAdjacentHTML('beforeend', '<div class="mu-label">' + esc(it.name) + '</div><div class="mu-sub">' + (it.w / 72).toFixed(2) + ' × ' + (it.h / 72).toFixed(2) + ' in · ' + it.frames.length + ' object' + (it.frames.length === 1 ? '' : 's') + '</div>');
      d.onclick = () => { this.sel = it.id; this.draw(); };
      d.ondblclick = () => this.insert(it.id);
      list.appendChild(d);
    }
    const sel = this.item(this.sel);
    el.querySelector('.bk-sel').hidden = !sel;
    if (sel) el.querySelector('.mu-sel-label').textContent = sel.name;
  }

  // the selected objects on the page → a new block
  async addSelection() {
    const ed = this.app.editor();
    const fs = ed.selection().filter((f) => !f.generated);
    if (!ed.half || !fs.length) { this.app.setStatus('Select the objects to keep (Shift+click for several), then Add selection to Building Blocks….'); this.app.flashMode(); return; }
    const v = await modal('Add to Building Blocks', '<label class="pd-row">Name: <input name="name" required style="width:240px" value="' + esc(fs.length === 1 && fs[0].kind === 'text' ? (fs[0].text.paragraphs[0] || { runs: [] }).runs.map((r) => r.text).join('').slice(0, 40) : '') + '"></label>' +
      '<label class="pd-row">Kept under: <select name="category">' + Object.entries(CATS).map(([k, l]) => '<option value="' + k + '"' + (k === this.cat ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<p class="pd-note">' + fs.length + ' object' + (fs.length === 1 ? '' : 's') + ', with ' + (fs.some((f) => f.kind === 'image') ? 'the pictures' : 'no pictures') + '. Kept in the Building Blocks folder beside the weeks, for every week and everyone who shares the folder.</p>', 'Add');
    if (!v || !v.name.trim()) return;
    const r = await window.bb.blocks.add(this.app.file(), { name: v.name, category: v.category, frames: JSON.parse(JSON.stringify(fs)) });
    this.cat = v.category;
    this.sel = r.item.id;
    this.el.hidden = false;
    await this.load();
    this.app.setStatus('“' + r.item.name + '” added to Building Blocks (' + CATS[v.category] + ').');
  }

  async insert(id) {
    const it = this.item(id);
    const ed = this.app.editor();
    if (!it) return;
    if (!ed.half) { this.app.setStatus('Choose which pages you are changing first (Bulletin ▸ I am changing).'); this.app.flashMode(); return; }
    let r;
    try { r = await window.bb.blocks.use(this.app.file(), id); } catch (err) { this.app.setStatus('<span class="warn">' + String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '</span>'); return; }
    const n = await ed.placeFrames(r.frames, r.w, r.h);
    if (n != null) this.app.setStatus('“' + it.name + '” placed on page ' + n + '.');
  }

  async rename(id) {
    const it = this.item(id);
    if (!it) return;
    const v = await modal('Rename Building Block', '<label class="pd-row">Name: <input name="name" required style="width:240px" value="' + esc(it.name) + '"></label>' +
      '<label class="pd-row">Kept under: <select name="category">' + Object.entries(CATS).map(([k, l]) => '<option value="' + k + '"' + (k === it.category ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>');
    if (!v) return;
    await window.bb.blocks.rename(this.app.file(), id, { name: v.name, category: v.category });
    this.cat = v.category;
    await this.load();
  }

  async remove(id) {
    const it = this.item(id);
    if (!it) return;
    const v = await modal('Remove Building Block', '<p>Remove “' + esc(it.name) + '” from Building Blocks?</p><p class="pd-note">Weeks that used it keep their copy.</p>', 'Remove');
    if (!v) return;
    await window.bb.blocks.remove(this.app.file(), id);
    this.sel = null;
    await this.load();
  }
}
