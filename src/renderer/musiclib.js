// Service Music library (Kevin 2026-10-29): psalter responses, doxologies, communion settings and the
// rest come round again season by season, so each is kept once, indexed the way it is looked for, in a
// "Service Music" folder beside the week folders (main.js music:*), and put into a week from this pane:
//   • on a drafted Order of Worship: into the selected hymn / picture block (or a new picture block
//     after the selected one), so it is laid out with its heading
//   • in text you are typing in (or a selected text box): IN the text, as Word does — an in-line picture
//     after the caret's paragraph, so it moves with the text (Kevin 2026-10-29)
//   • anywhere else on a page you are editing: as a picture the width of the text, mid-page
// Insert ▸ Service Music, or the "Service music…" button on a hymn / picture block (a PSALTER block opens
// on its psalm). A picture on a page is added from its right-click menu ("Add to Service Music…").
import { modal } from './pagedialogs.js';

const n = (v) => (v == null || v === '' ? null : Number(v));
// each kind: its tab, the fields it is indexed by ([key, label, type, example]), its name and its order
export const KINDS = {
  psalter: { tab: 'Psalters', one: 'Psalter',
    fields: [['psalm', 'Psalm', 'number', '23'], ['response', 'Response', 'number', '1'], ['note', 'Note', 'text', 'Advent; sung by the cantor']],
    name: (it) => 'Psalm ' + (it.psalm ?? '?') + ' · Response ' + (it.response ?? 1),
    sort: (a, b) => (n(a.psalm) ?? 999) - (n(b.psalm) ?? 999) || (n(a.response) ?? 1) - (n(b.response) ?? 1) },
  doxology: { tab: 'Doxologies', one: 'Doxology',
    fields: [['tune', 'Hymn tune', 'text', 'OLD HUNDREDTH'], ['title', 'Words begin', 'text', 'Praise God, from whom all blessings flow'], ['note', 'Note', 'text', 'Advent and Christmas']],
    name: (it) => it.tune || it.title || 'Doxology',
    sort: (a, b) => (a.tune || '').localeCompare(b.tune || '') },
  communion: { tab: 'Communion', one: 'Communion setting',
    fields: [['setting', 'Setting', 'text', 'UMC Musical Setting A'], ['part', 'Part', 'text', 'Holy, holy, holy'], ['order', 'Order in the setting', 'number', '1'], ['note', 'Note', 'text', '']],
    name: (it) => it.part || it.title || 'Part', group: (it) => it.setting || 'Other settings',
    sort: (a, b) => (a.setting || '~').localeCompare(b.setting || '~') || (n(a.order) ?? 99) - (n(b.order) ?? 99) },
  taize: { tab: 'Taizé', one: 'Taizé chant',
    fields: [['title', 'Title', 'text', 'Eat This Bread'], ['note', 'Note', 'text', '']], name: (it) => it.title || 'Chant' },
  benediction: { tab: 'Benediction', one: 'Benediction response',
    fields: [['title', 'Title', 'text', 'Go Now in Peace'], ['note', 'Note', 'text', '']], name: (it) => it.title || 'Response' },
  other: { tab: 'Other', one: 'Other',
    fields: [['title', 'Label', 'text', ''], ['note', 'Note', 'text', '']], name: (it) => it.title || it.label || 'Music' },
};
const KEY = { psalter: 'psalm', doxology: 'tune', communion: 'setting', taize: 'title', benediction: 'title', other: 'title' };
export const musicName = (it) => (KINDS[it.category] || KINDS.other).name(it);
const haystack = (it) => [musicName(it), it.title, it.tune, it.setting, it.part, it.note, it.label].filter(Boolean).join(' · ').toLowerCase();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class MusicPane {
  // app: { file(), editor(), setStatus(html), flashMode() }
  constructor(app) {
    this.app = app;
    this.cat = 'psalter';
    this.sel = null;
    this.items = [];
    const el = document.createElement('aside');
    el.id = 'musicpane';
    el.hidden = true;
    el.innerHTML =
      '<div class="fp-head"><span>Service Music</span><button type="button" class="mu-close" title="Close">✕</button></div>' +
      '<div class="mu-cats">' + Object.entries(KINDS).map(([k, d]) => '<button type="button" data-cat="' + k + '">' + d.tab + '</button>').join('') + '</div>' +
      '<input type="search" class="mu-find" placeholder="Find (psalm, tune, title…)" spellcheck="false">' +
      '<div class="mu-list"></div>' +
      '<div class="mu-sel"><div class="mu-sel-label"></div>' +
      '<div class="mu-buttons"><button type="button" class="mu-insert">Insert</button>' +
      '<button type="button" class="mu-replace" title="Put this in place of the music already in the selected block (a new season’s doxology)">Replace</button><button type="button" class="mu-edit">Edit…</button>' +
      '<button type="button" class="mu-remove">Remove</button></div></div>' +
      '<div class="mu-foot"><button type="button" class="mu-add">Add music…</button></div>';
    document.getElementById('body').appendChild(el);
    this.el = el;
    // clicking in the pane keeps the caret where it is in the text (music goes in at the caret)
    el.addEventListener('mousedown', (e) => { if (!e.target.closest('input, select')) e.preventDefault(); });
    this.find = el.querySelector('.mu-find');
    el.querySelector('.mu-close').onclick = () => this.hide();
    for (const b of el.querySelectorAll('.mu-cats button')) b.onclick = () => { this.cat = b.dataset.cat; this.sel = null; this.find.value = ''; this.draw(); };
    this.find.addEventListener('input', () => this.draw());
    el.querySelector('.mu-insert').onclick = () => this.insert(this.sel);
    el.querySelector('.mu-replace').onclick = () => this.insert(this.sel, { replace: true });
    el.querySelector('.mu-edit').onclick = () => this.edit(this.sel);
    el.querySelector('.mu-remove').onclick = () => this.remove(this.sel);
    el.querySelector('.mu-add').onclick = () => this.add();
  }

  get shown() { return !this.el.hidden; }
  // cat: open on this kind; find: pre-filled search (a PSALTER block's psalm, a doxology's tune)
  async show(cat, find) {
    if (cat && KINDS[cat]) { this.cat = cat; this.sel = null; }
    if (find != null) this.find.value = find;
    this.el.hidden = false;
    const fp = document.getElementById('findpane');
    if (fp) fp.hidden = true;
    await this.load();
  }
  hide() { this.el.hidden = true; }
  toggle() { return this.shown ? this.hide() : this.show(); }

  async load() {
    if (!this.app.file()) { this.items = []; this.draw(); return; }
    const lib = await window.bb.music.list(this.app.file());
    this.items = lib.items;
    this.dir = lib.dir;
    this.draw();
  }

  item(id) { return this.items.find((x) => x.id === id); }

  draw() {
    const el = this.el;
    const kind = KINDS[this.cat];
    for (const b of el.querySelectorAll('.mu-cats button')) b.classList.toggle('active', b.dataset.cat === this.cat);
    const q = this.find.value.trim().toLowerCase();
    const list = el.querySelector('.mu-list');
    const sort = kind.sort || ((a, b) => musicName(a).localeCompare(musicName(b), undefined, { numeric: true }));
    const mine = this.items.filter((x) => x.category === this.cat && (!q || haystack(x).includes(q))).sort(sort);
    list.innerHTML = mine.length ? '' : '<div class="mu-empty">' + (q ? 'No ' + kind.tab.toLowerCase() + ' match “' + esc(q) + '”.'
      : 'No ' + kind.tab.toLowerCase() + ' yet. Add music…, or right-click a picture on a page ▸ Add to Service Music….') + '</div>';
    let group = null;
    for (const it of mine) {
      if (kind.group && kind.group(it) !== group) {
        group = kind.group(it);
        list.appendChild(Object.assign(document.createElement('div'), { className: 'mu-group', textContent: group }));
      }
      const d = document.createElement('div');
      d.className = 'mu-item' + (it.id === this.sel ? ' selected' : '');
      d.dataset.id = it.id;
      d.title = musicName(it) + ' — double-click to insert';
      d.innerHTML = '<img draggable="false" src="' + esc(it.url) + '"><div class="mu-label">' + esc(musicName(it)) + '</div>' +
        (it.title && this.cat === 'doxology' ? '<div class="mu-sub">' + esc(it.title) + '</div>' : '') +
        (it.note ? '<div class="mu-sub">' + esc(it.note) + '</div>' : '');
      d.onclick = () => { this.sel = it.id; this.draw(); };
      d.ondblclick = () => this.insert(it.id);
      list.appendChild(d);
    }
    const s = this.item(this.sel);
    el.querySelector('.mu-sel').hidden = !s;
    el.querySelector('.mu-replace').hidden = !this.replaceTarget();
    if (s) el.querySelector('.mu-sel-label').textContent = (KINDS[s.category].group ? KINDS[s.category].group(s) + ': ' : '') + musicName(s);
  }

  // the drafted Order of Worship block whose music Replace swaps out (it has music already)
  replaceTarget() {
    const ed = this.app.editor();
    const panel = ed && ed.half && ed.flowHalf() && ed.panel;
    const b = panel && panel.block(panel.selId);
    return b && ['hymn', 'image'].includes(b.kind) && (b.images || []).length ? b : null;
  }

  // ---- put it in the week (replace: in place of the selected block's music)
  async insert(id, { replace = false } = {}) {
    const it = this.item(id);
    if (!it) return;
    const ed = this.app.editor();
    if (!ed.half) {
      this.app.setStatus('View only. Click "View only" at the top right to choose which pages you are changing, then insert the music.');
      this.app.flashMode();
      return;
    }
    const rel = await window.bb.music.use(this.app.file(), id);
    const panel = ed.flowHalf() && ed.panel;
    if (panel) {
      const b = panel.block(panel.selId);
      if (replace && this.replaceTarget()) {
        await panel.edit((fl) => { const x = fl.blocks.find((y) => y.id === b.id); x.images = [rel]; delete x.imageWidths; });
        panel.select(b.id, { scrollPage: false });
        this.app.setStatus('“' + esc(musicName(it)) + '” in place of the music that was there (Undo puts it back).');
        return;
      }
      if (b && (b.kind === 'hymn' || b.kind === 'image')) await panel.addImage(b.id, rel);
      else { const nb = await panel.add('image'); await panel.addImage(nb.id, rel); }
      this.app.setStatus('“' + esc(musicName(it)) + '” is in the order of worship.');
      return;
    }
    if (await ed.insertInlinePicture(rel)) { this.app.setStatus('“' + esc(musicName(it)) + '” is in the text: it moves with the lines around it.'); return; }
    const placed = await ed.insertPicture(null, { rel, fullWidth: true });
    if (placed !== false) this.app.setStatus('“' + esc(musicName(it)) + '” put on the page. (Click in the text where it goes first, and it goes in the line, moving with the text.)');
  }

  // ---- the library itself: one dialog for every kind, showing that kind's fields
  async ask(title, it, ok) {
    let err = '';
    for (;;) {
      const row = (cat, [k, label, type, ex]) => '<label class="pd-row mu-f" data-cat="' + cat + '">' + label + ': <input name="' + cat + '.' + k + '" type="' + type +
        '"' + (type === 'number' ? ' min="1" style="width:70px"' : ' style="width:250px"') + ' value="' + esc(it.category === cat ? it[k] : '') + '" placeholder="' + esc(ex) + '"></label>';
      const p = modal(title,
        (err ? '<p class="pd-note warn">' + err + '</p>' : '') +
        '<label class="pd-row">Kind: <select name="category">' + Object.entries(KINDS).map(([k, d]) => '<option value="' + k + '"' + (k === it.category ? ' selected' : '') + '>' + d.one + '</option>').join('') + '</select></label>' +
        Object.entries(KINDS).map(([cat, d]) => d.fields.map((f) => row(cat, f)).join('')).join(''), ok);
      const dlg = [...document.querySelectorAll('dialog.pub-dialog[open]')].pop();
      const sel = dlg.querySelector('[name="category"]');
      const showFor = () => { for (const r of dlg.querySelectorAll('.mu-f')) r.hidden = r.dataset.cat !== sel.value; const f = dlg.querySelector('.mu-f:not([hidden]) input'); if (f) f.focus(); };
      sel.addEventListener('change', showFor);
      showFor();
      const v = await p;
      if (!v) return null;
      const out = { category: v.category };
      for (const [k] of KINDS[v.category].fields) out[k] = (v[v.category + '.' + k] || '').trim();
      if (!out[KEY[v.category]]) { err = 'Fill in the ' + KINDS[v.category].fields.find(([k]) => k === KEY[v.category])[1].toLowerCase() + ' first.'; it = { ...it, ...out }; continue; }
      // fields the other kinds use are cleared, so a moved item is indexed only its new way
      for (const d of Object.values(KINDS)) for (const [k] of d.fields) if (!(k in out)) out[k] = '';
      return out;
    }
  }

  async add(src) {
    if (!this.app.file()) return;
    if (src) {
      const v = await this.ask('Add to Service Music', { category: this.cat }, 'Add');
      if (!v) return;
      return this.added(await window.bb.music.add(this.app.file(), { ...v, src }));
    }
    const r = await window.bb.music.add(this.app.file(), { category: this.cat });
    if (!r) return;
    const v = await this.ask('Describe the new music', r.item, 'OK');
    const lib = v ? await window.bb.music.update(this.app.file(), r.item.id, v) : r;
    return this.added({ item: lib.items.find((x) => x.id === r.item.id) || r.item, ...lib });
  }
  added(r) {
    if (!r) return;
    this.items = r.items;
    this.cat = r.item.category;
    this.sel = r.item.id;
    this.find.value = '';
    if (!this.shown) this.el.hidden = false;
    this.draw();
    const d = this.el.querySelector('.mu-item.selected');
    if (d) d.scrollIntoView({ block: 'nearest' });
    this.app.setStatus('Added to Service Music: “' + esc(musicName(r.item)) + '” (' + KINDS[r.item.category].one + ').');
    return r.item;
  }

  async edit(id) {
    const it = this.item(id);
    if (!it) return;
    const v = await this.ask('Edit service music', it, 'OK');
    if (!v) return;
    const lib = await window.bb.music.update(this.app.file(), id, v);
    this.items = lib.items;
    this.cat = v.category;
    this.draw();
  }
  async remove(id) {
    const it = this.item(id);
    if (!it) return;
    const v = await modal('Remove from Service Music', '<p>Take “' + esc(musicName(it)) + '” out of the library?</p>' +
      '<p class="pd-note">Weeks that already use it keep their own copy. Its picture goes to the Recycle Bin.</p>', 'Remove');
    if (!v) return;
    const lib = await window.bb.music.remove(this.app.file(), id);
    this.items = lib.items;
    this.sel = null;
    this.draw();
    this.app.setStatus('Removed “' + esc(musicName(it)) + '” from Service Music.');
  }
}
