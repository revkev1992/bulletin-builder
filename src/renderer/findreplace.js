// Publisher's Find and Replace task pane (Home ▸ Editing ▸ Find / Replace, Ctrl+F / Ctrl+H).
// Searches every text box of the bulletin in reading order (page by page, top to bottom). A hit in
// the half you are changing is selected in the text, ready to type over; a hit elsewhere is shown
// (page scrolled, box selected). Replace / Replace All work in the half you are changing; text laid
// out by the Order of Worship panel is changed in the panel, so it is reported, not replaced.

import { paragraphRange } from './textedit.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const each = (f, fn) => { fn(f); (f.children || []).forEach((c) => each(c, fn)); };
const paraText = (p) => p.runs.map((r) => r.text).join('').replace(/\u000c/g, '');

export class FindPane {
  constructor(editor, { $ }) {
    this.editor = editor;
    this.$ = $;
    this.pos = null;           // last hit { n, id, para, start, end }
    const el = document.createElement('aside');
    el.id = 'findpane';
    el.hidden = true;
    el.innerHTML =
      '<div class="fp-head"><span>Find and Replace</span><button type="button" class="fr-close" title="Close">✕</button></div>' +
      '<div class="fr-body">' +
      '<label class="fr-radio"><input type="radio" name="fr-mode" value="find" checked> Find</label>' +
      '<label class="fr-radio"><input type="radio" name="fr-mode" value="replace"> Replace</label>' +
      '<label class="fr-lbl">Find what:<input id="fr-what" type="text" spellcheck="false"></label>' +
      '<label class="fr-lbl fr-rep">Replace with:<input id="fr-with" type="text" spellcheck="false"></label>' +
      '<div class="fr-buttons"><button type="button" id="fr-next">Find Next</button>' +
      '<button type="button" id="fr-replace" class="fr-rep">Replace</button><button type="button" id="fr-all" class="fr-rep">Replace All</button></div>' +
      '<fieldset><legend>Options</legend><label><input type="checkbox" id="fr-word"> Match whole word only</label>' +
      '<label><input type="checkbox" id="fr-case"> Match case</label></fieldset>' +
      '<div id="fr-msg" class="fr-msg"></div></div>';
    document.getElementById('body').appendChild(el);
    this.el = el;
    el.querySelector('.fr-close').onclick = () => this.hide();
    for (const r of el.querySelectorAll('input[name="fr-mode"]')) r.onchange = () => this.mode(r.value);
    el.querySelector('#fr-next').onclick = () => this.findNext();
    el.querySelector('#fr-replace').onclick = () => this.replaceOne();
    el.querySelector('#fr-all').onclick = () => this.replaceAll();
    el.querySelector('#fr-what').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.findNext(); } });
    el.querySelector('#fr-what').addEventListener('input', () => { this.pos = null; this.msg(''); });
    window.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f' || k === 'h') { e.preventDefault(); this.show(k === 'h' ? 'replace' : 'find'); }
    });
  }

  show(mode = 'find') {
    const ed = this.editor;
    // Publisher puts the selected text into "Find what"
    const s = window.getSelection();
    const picked = ed.textEdit && s.rangeCount && !s.isCollapsed ? s.toString() : '';
    this.el.hidden = false;
    this.mode(mode);
    const what = this.el.querySelector('#fr-what');
    if (picked && !picked.includes('\n')) what.value = picked;
    what.focus();
    what.select();
  }
  hide() { this.el.hidden = true; }
  mode(m) {
    this.el.querySelector('input[name="fr-mode"][value="' + m + '"]').checked = true;
    this.el.classList.toggle('replacing', m === 'replace');
  }
  msg(t) { this.el.querySelector('#fr-msg').textContent = t; }

  pattern() {
    const what = this.el.querySelector('#fr-what').value;
    if (!what) return null;
    const word = this.el.querySelector('#fr-word').checked;
    const body = esc(what);
    return new RegExp(word ? '(?<![\\p{L}\\p{N}])' + body + '(?![\\p{L}\\p{N}])' : body, 'gu' + (this.el.querySelector('#fr-case').checked ? '' : 'i'));
  }

  // every text box in reading order: page, then top-to-bottom, left-to-right
  boxes() {
    const ed = this.editor;
    const out = [];
    for (const n of ed.app.pageNumbers()) {
      const pg = ed.pageEntry(n);
      if (!pg) continue;
      const list = [];
      pg.frames.forEach((f) => each(f, (g) => { if (g.kind === 'text' && g.text && !g.note) list.push(g); }));
      list.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      for (const f of list) out.push({ n, f });
    }
    return out;
  }

  // all hits, in order
  hits() {
    const re = this.pattern();
    if (!re) return [];
    const out = [];
    for (const { n, f } of this.boxes()) {
      f.text.paragraphs.forEach((p, i) => {
        const t = paraText(p);
        re.lastIndex = 0;
        for (let m; (m = re.exec(t));) { out.push({ n, id: f.id, para: i, start: m.index, end: m.index + m[0].length }); if (!m[0].length) re.lastIndex++; }
      });
    }
    return out;
  }

  async findNext() {
    // search what is on the page now: commit any typing first
    if (this.editor.textEdit) await this.editor.endTextEdit();
    const all = this.hits();
    if (!all.length) { this.msg('No matches found.'); return null; }
    const key = (h) => [this.order(h.n, h.id), h.para, h.start];
    const after = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    let hit = this.pos ? all.find((h) => after(h, this.pos)) : all[0];
    let head = all.length + ' match' + (all.length === 1 ? '' : 'es') + ' in the bulletin.';
    if (!hit) { hit = all[0]; head = 'Reached the end of the bulletin; continued from the beginning. ' + head; }
    this.pos = hit;
    const note = await this.show1(hit);
    this.msg(head + (note ? ' ' + note : ''));
    return hit;
  }

  order(n, id) {
    const b = this.boxes();
    return b.findIndex((x) => x.n === n && x.f.id === id);
  }

  // put the hit on screen: selected in the text when it can be edited, else the box is selected
  async show1(hit) {
    const ed = this.editor;
    const sh = ed.app.shellOf(hit.n);
    const top = ed.topFrame(hit.n, hit.id);
    if (ed.editable(hit.n) && top && !ed.locked(hit.n, top)) {
      if (!(ed.textEdit && ed.textEdit.id === hit.id)) {
        if (ed.textEdit) await ed.endTextEdit();
        ed.beginTextEdit(hit.n, hit.id);
      }
      const flow = ed.editingFlow();
      const p = flow && [...flow.children].filter((c) => c.tagName === 'P')[hit.para];
      if (p) {
        const r = paragraphRange(p, hit.start, hit.end);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
        const b = r.getBoundingClientRect();
        const stage = document.getElementById('stage');
        const sr = stage.getBoundingClientRect();
        if (b.top < sr.top + 20 || b.bottom > sr.bottom - 20) stage.scrollTop += b.top - (sr.top + sr.height / 3);
      }
      return;
    }
    if (ed.textEdit) await ed.endTextEdit();
    ed.select(hit.n, top ? top.id : null);
    if (sh) sh.scrollIntoView({ block: 'center' });
    const why = !ed.half ? ' (view only — choose Bulletin ▸ I am changing to edit it)'
      : !ed.editable(hit.n) ? ' (on the ' + ed.halfOf(hit.n) + ' pages, which you are not changing)'
      : top && top.generated ? ' (laid out by the Order of Worship — change it in the panel)' : ' (locked)';
    return 'This one is on page ' + hit.n + why + '.';
  }

  // the current selection is exactly the hit → type the replacement over it, then find the next
  async replaceOne() {
    const ed = this.editor;
    const re = this.pattern();
    if (!re) return;
    const s = window.getSelection();
    const sel = ed.textEdit && s.rangeCount ? s.toString() : '';
    re.lastIndex = 0;
    const m = sel && re.exec(sel);
    if (m && m.index === 0 && m[0].length === sel.length && this.pos && ed.textEdit && ed.textEdit.id === this.pos.id) {
      const by = this.el.querySelector('#fr-with').value;
      if (by) document.execCommand('insertText', false, by); else document.execCommand('delete');
      ed.setDirty(true);
      // carry on searching just after the replacement
      this.pos = { ...this.pos, start: this.pos.start + Math.max(by.length, 1) - 1 };
    }
    return this.findNext();
  }

  // every hit in the half being changed, as ONE undo step
  async replaceAll() {
    const ed = this.editor;
    if (!ed.half) { this.msg('Choose Bulletin ▸ I am changing first.'); return 0; }
    const re = this.pattern();
    if (!re) return 0;
    const by = this.el.querySelector('#fr-with').value;
    if (ed.textEdit) await ed.endTextEdit();
    let count = 0, skipped = 0;
    const pages = new Set(), stories = new Set();
    const targets = this.boxes().filter(({ n }) => ed.editable(n));
    for (const { n, f } of targets) {
      const top = ed.topFrame(n, f.id);
      const c = f.text.paragraphs.reduce((a, p) => { re.lastIndex = 0; return a + (paraText(p).match(re) || []).length; }, 0);
      if (!c) continue;
      if (ed.locked(n, top)) { skipped += c; continue; }
      count += c;
      pages.add(n);
      if (f.text.chain) stories.add(f.text.chain.story);
    }
    if (!count) { this.msg(skipped ? 'No changeable matches (' + skipped + ' in locked or Order-of-Worship text).' : 'No matches.'); return 0; }
    await ed.commit([...pages], () => {
      for (const { n, f } of targets) {
        if (!pages.has(n) || ed.locked(n, ed.topFrame(n, f.id))) continue;
        const live = ed.anyFrame(n, f.id);
        for (const p of live.text.paragraphs) replaceInRuns(p, re, by);
      }
    });
    for (const st of stories) await ed.app.rerender(ed.reflow(st));
    this.pos = null;
    this.msg('Replaced ' + count + (skipped ? '; ' + skipped + ' more are in locked or Order-of-Worship text' : '') + '.');
    return count;
  }
}

// replace every match inside a paragraph, keeping each run's formatting: the replacement takes the
// formatting of the run where the match starts
function replaceInRuns(p, re, by) {
  for (;;) {
    const text = p.runs.map((r) => r.text).join('');
    re.lastIndex = p.__from || 0;
    const m = re.exec(text);
    if (!m || !m[0].length) break;
    let a = m.index, b = m.index + m[0].length, k = 0;
    for (const r of p.runs) {
      const s0 = k, s1 = k + r.text.length;
      k = s1;
      if (s1 <= a || s0 >= b) continue;
      const from = Math.max(a, s0) - s0, to = Math.min(b, s1) - s0;
      r.text = r.text.slice(0, from) + (s0 <= a ? by : '') + r.text.slice(to);
    }
    p.runs = p.runs.filter((r) => r.text.length);
    p.__from = m.index + by.length;
  }
  delete p.__from;
}
