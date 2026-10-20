// Publisher's rulers (View ▸ Rulers): a horizontal and a vertical ruler round the page area.
// While you type in a text box the horizontal ruler shows the box's text area in white with the
// paragraph's indent markers and tab stops, and works like Publisher's:
//   · the button in the corner picks the kind of tab (Left, Center, Right, Decimal) — click to cycle
//   · click the ruler inside the text area to add a tab of that kind; drag a tab to move it;
//     drag it down off the ruler to remove it; double-click a tab (or the ruler) for the Tabs dialog
//   · drag the indent markers: first line (top triangle), left/hanging (bottom), right
// Every change applies to the paragraph(s) you are in, as one formatting step.

import { paragraphSettings } from './textedit.js';

const SNAP = 4.5;              // pt — 1/16 inch, Publisher's ruler click grid
const KINDS = ['left', 'center', 'right', 'decimal'];
const KIND_TIP = { left: 'Left tab', center: 'Center tab', right: 'Right tab', decimal: 'Decimal tab' };
const LEADERS = ['', 'dot', 'dash', 'line'];
const LEADER_LABEL = { '': 'None', dot: 'Dot', dash: 'Dash', line: 'Line' };
const r2 = (v) => Math.round(v * 100) / 100;

export class Rulers {
  constructor(editor, { $ }) {
    this.editor = editor;
    this.kind = 'left';
    const stage = $('stage');
    const wrap = document.createElement('div');
    wrap.id = 'stage-wrap';
    stage.before(wrap);
    wrap.innerHTML = '<button id="ruler-kind" type="button" title="Left tab — click to change the kind of tab"></button>' +
      '<div id="ruler-h"><canvas></canvas><div class="ruler-marks"></div></div><div id="ruler-v"><canvas></canvas></div>';
    wrap.appendChild(stage);
    this.wrap = wrap;
    this.h = wrap.querySelector('#ruler-h');
    this.v = wrap.querySelector('#ruler-v');
    this.marks = this.h.querySelector('.ruler-marks');
    this.kindBtn = wrap.querySelector('#ruler-kind');
    this.kindBtn.addEventListener('mousedown', (e) => e.preventDefault());
    this.kindBtn.addEventListener('click', () => { this.kind = KINDS[(KINDS.indexOf(this.kind) + 1) % KINDS.length]; this.drawKind(); });
    this.drawKind();
    // keep the caret in the text box while using the ruler
    this.h.addEventListener('mousedown', (e) => this.onDown(e));
    this.h.addEventListener('dblclick', (e) => { e.preventDefault(); if (this.typing()) this.tabsDialog(); });
    stage.addEventListener('scroll', () => this.update(), { passive: true });
    window.addEventListener('resize', () => this.update());
    document.addEventListener('selectionchange', () => { if (this.typing()) this.update(); });
    const show = $('show-rulers');
    show.checked = true;
    show.addEventListener('change', () => { document.body.classList.toggle('no-rulers', !show.checked); this.update(); });
  }

  typing() { return !!this.editor.textEdit && !!this.editor.editingFlow(); }

  drawKind() {
    this.kindBtn.className = 'tabkind-' + this.kind;
    this.kindBtn.title = KIND_TIP[this.kind] + ' — click to change the kind of tab';
    this.kindBtn.innerHTML = glyph(this.kind, 14);
  }

  // the page the rulers measure from: the one being typed in / selected / last clicked, else the first on screen
  originPage() {
    const ed = this.editor;
    const n = ed.textEdit ? ed.textEdit.n : ed.sel ? ed.sel.page : ed.lastPage;
    const sh = n != null && ed.app.shellOf(n);
    if (sh) return sh.querySelector('.page');
    const stage = document.getElementById('stage').getBoundingClientRect();
    return [...document.querySelectorAll('#stage .page-shell .page')].find((p) => { const r = p.getBoundingClientRect(); return r.bottom > stage.top && r.top < stage.bottom; }) || null;
  }

  // text-area geometry (window px) + the paragraph settings, while typing
  area() {
    const flow = this.editor.editingFlow();
    if (!flow) return null;
    const a = flow.closest('.text-area');
    const r = a.getBoundingClientRect();
    const ppt = r.width / Number(a.dataset.wpt || 1);
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, ppt, wpt: Number(a.dataset.wpt || 0), para: paragraphSettings(flow) || {} };
  }

  update() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw());
  }

  draw() {
    if (document.body.classList.contains('no-rulers')) return;
    const page = this.originPage();
    const week = this.editor.week();
    const ar = this.typing() ? this.area() : null;
    this.cur = ar;
    for (const [el, horiz] of [[this.h, true], [this.v, false]]) {
      const c = el.querySelector('canvas');
      const box = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, box.width * dpr); c.height = Math.max(1, box.height * dpr);
      c.style.width = box.width + 'px'; c.style.height = box.height + 'px';
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = '#f3f2f1'; g.fillRect(0, 0, box.width, box.height);
      if (!page || !week) continue;
      const pr = page.getBoundingClientRect();
      const ppi = pr.width / (week.manifest.page.width / 72);          // px per inch on screen
      const origin = horiz ? pr.left - box.left : pr.top - box.top;
      const extent = horiz ? pr.width : pr.height;
      // the page in white; the text area brighter while typing
      g.fillStyle = '#fff';
      if (horiz) g.fillRect(origin, 2, extent, box.height - 4); else g.fillRect(2, origin, box.width - 4, extent);
      if (ar) {
        g.fillStyle = '#dfeaf8';
        if (horiz) g.fillRect(ar.left - box.left, 2, ar.right - ar.left, box.height - 4);
        else g.fillRect(2, ar.top - box.top, box.width - 4, ar.bottom - ar.top);
      }
      g.strokeStyle = '#8a8886'; g.fillStyle = '#605e5c'; g.font = '9px Segoe UI'; g.lineWidth = 1;
      const len = horiz ? box.width : box.height;
      const first = Math.floor(-origin / ppi) - 1, last = Math.ceil((len - origin) / ppi) + 1;
      for (let i = first; i <= last; i++) {
        for (let k = 0; k < 8; k++) {
          const p = Math.round(origin + (i + k / 8) * ppi) + 0.5;
          if (p < 0 || p > len) continue;
          const t = k === 0 ? 0 : k === 4 ? 6 : k % 2 === 0 ? 4 : 2.5;
          if (k === 0) {
            const label = String(Math.abs(i));
            if (horiz) g.fillText(label, p - (label.length * 2.5), 12); else { g.save(); g.translate(13, p + label.length * 2.5); g.rotate(-Math.PI / 2); g.fillText(label, 0, 0); g.restore(); }
            continue;
          }
          g.beginPath();
          const full = horiz ? box.height : box.width;
          if (horiz) { g.moveTo(p, full - 3 - t); g.lineTo(p, full - 3); } else { g.moveTo(full - 3 - t, p); g.lineTo(full - 3, p); }
          g.stroke();
        }
      }
    }
    this.drawMarks();
  }

  // tab + indent markers (DOM, so they can be dragged and double-clicked)
  drawMarks() {
    this.marks.replaceChildren();
    const ar = this.cur;
    if (!ar) return;
    const hb = this.h.getBoundingClientRect();
    const x = (pt) => ar.left - hb.left + pt * ar.ppt;
    const p = ar.para;
    const add = (cls, left, data, title) => {
      const m = document.createElement('div');
      m.className = 'rmark ' + cls;
      m.style.left = left + 'px';
      Object.assign(m.dataset, data);
      m.title = title;
      this.marks.appendChild(m);
      return m;
    };
    const L = p.indentLeft || 0, F = p.indentFirst || 0, R = p.indentRight || 0;
    add('ind-first', x(L + F), { ind: 'first' }, 'First Line Indent');
    add('ind-left', x(L), { ind: 'left' }, 'Left Indent (drag to set the hanging indent)');
    add('ind-right', x(ar.wpt - R), { ind: 'right' }, 'Right Indent');
    (p.tabs || []).forEach((s, i) => {
      const m = add('tabmark tab-' + (s.align || 'left'), x(s.pos), { tab: i }, KIND_TIP[s.align || 'left'] + ' at ' + (s.pos / 72).toFixed(2) + '" — drag to move, drag off the ruler to remove, double-click for Tabs');
      m.innerHTML = glyph(s.align || 'left', 11);
    });
  }

  // ------------------------------------------------------------ mouse on the horizontal ruler
  onDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();                    // the caret stays in the text box
    const ar = this.typing() ? this.area() : null;
    if (!ar || e.detail > 1) return;
    const toPt = (cx) => Math.max(0, Math.min(ar.wpt, Math.round(((cx - ar.left) / ar.ppt) / SNAP) * SNAP));
    const tabs = (ar.para.tabs || []).map((s) => ({ ...s }));
    const mark = e.target.closest('.rmark');
    let drag;
    if (mark && mark.dataset.tab != null) {
      drag = { type: 'tab', i: Number(mark.dataset.tab), el: mark };
    } else if (mark && mark.dataset.ind) {
      drag = { type: 'ind', which: mark.dataset.ind, el: mark };
    } else {
      // Publisher: a click inside the text area adds a tab of the chosen kind there
      if (e.clientX < ar.left || e.clientX > ar.right) return;
      tabs.push({ pos: toPt(e.clientX), align: this.kind });
      drag = { type: 'tab', i: tabs.length - 1, el: null, added: true };
    }
    const hb = this.h.getBoundingClientRect();
    let moved = false, off = false, pos = null;
    const move = (ev) => {
      moved = true;
      pos = toPt(ev.clientX);
      off = drag.type === 'tab' && (ev.clientY > hb.bottom + 18 || ev.clientY < hb.top - 18);
      if (drag.el) { drag.el.style.left = (ar.left - hb.left + pos * ar.ppt) + 'px'; drag.el.classList.toggle('removing', off); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (drag.type === 'tab') {
        if (off) tabs.splice(drag.i, 1);
        else if (moved && pos != null) tabs[drag.i].pos = pos;
        else if (!drag.added) return;      // a plain click on a tab: nothing to change
        this.editor.format('tabs', dedupe(tabs));
      } else if (moved && pos != null) {
        const p = ar.para, L = p.indentLeft || 0, F = p.indentFirst || 0;
        const v = {};
        if (drag.which === 'first') v.indentFirst = pos - L;
        if (drag.which === 'left') { v.indentLeft = pos; v.indentFirst = (L + F) - pos; }   // first line stays put (hanging indent)
        if (drag.which === 'right') v.indentRight = ar.wpt - pos;
        for (const k of Object.keys(v)) v[k] = r2(v[k]);
        this.editor.format('paragraph', v);
      }
      this.update();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ------------------------------------------------------------ Format ▸ Tabs (Publisher's Tabs dialog)
  tabsDialog() {
    const flow = this.editor.editingFlow();
    if (!flow) return Promise.resolve(null);
    const sel = window.getSelection();
    const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    let tabs = ((paragraphSettings(flow) || {}).tabs || []).map((s) => ({ ...s }));
    const defaultStop = this.editor.week().manifest.defaultTabStop || 36;
    const d = document.createElement('dialog');
    d.className = 'pub-dialog tabs-dialog';
    d.innerHTML = '<form method="dialog"><div class="pd-title">Tabs</div><div class="pd-body tabs-grid">' +
      '<div><label>Tab stop position:<br><input name="pos" type="number" step="0.0625" min="0"></label>' +
      '<select name="list" size="6"></select></div>' +
      '<div><fieldset><legend>Alignment</legend>' + KINDS.map((k) => '<label><input type="radio" name="align" value="' + k + '"' + (k === 'left' ? ' checked' : '') + '> ' + k[0].toUpperCase() + k.slice(1) + '</label>').join('') + '</fieldset>' +
      '<fieldset><legend>Leader</legend>' + LEADERS.map((k) => '<label><input type="radio" name="leader" value="' + k + '"' + (k === '' ? ' checked' : '') + '> ' + LEADER_LABEL[k] + '</label>').join('') + '</fieldset></div>' +
      '<div class="pd-row">Default tab stops: ' + (defaultStop / 72).toFixed(2) + '"</div>' +
      '<div class="tabs-actions"><button type="button" data-act="set">Set</button><button type="button" data-act="clear">Clear</button><button type="button" data-act="all">Clear All</button></div>' +
      '</div><div class="pd-buttons"><button value="ok" class="pd-ok">OK</button><button value="cancel" formnovalidate>Cancel</button></div></form>';
    document.body.appendChild(d);
    const f = d.querySelector('form');
    const list = f.elements.list;
    const fill = (pick) => {
      tabs.sort((a, b) => a.pos - b.pos);
      list.innerHTML = tabs.map((s, i) => '<option value="' + i + '">' + (s.pos / 72).toFixed(3) + '"  ' + (s.align || 'left') + (s.leader ? ' · ' + s.leader : '') + '</option>').join('');
      if (pick != null && tabs[pick]) { list.value = String(pick); show(tabs[pick]); }
    };
    const show = (s) => {
      f.elements.pos.value = (s.pos / 72).toFixed(3);
      f.querySelector('input[name="align"][value="' + (s.align || 'left') + '"]').checked = true;
      f.querySelector('input[name="leader"][value="' + (s.leader || '') + '"]').checked = true;
    };
    list.addEventListener('change', () => show(tabs[Number(list.value)]));
    d.querySelector('[data-act="set"]').onclick = () => {
      const pos = r2(parseFloat(f.elements.pos.value) * 72);
      if (!(pos >= 0)) return;
      const s = { pos, align: f.elements.align.value };
      if (f.elements.leader.value) s.leader = f.elements.leader.value;
      tabs = tabs.filter((t) => Math.abs(t.pos - pos) > 0.5).concat(s);
      fill(tabs.indexOf(s));
    };
    d.querySelector('[data-act="clear"]').onclick = () => { if (list.value !== '') { tabs.splice(Number(list.value), 1); fill(); } };
    d.querySelector('[data-act="all"]').onclick = () => { tabs = []; fill(); };
    fill(tabs.length ? 0 : null);
    return new Promise((resolve) => {
      d.addEventListener('close', () => {
        const ok = d.returnValue === 'ok';
        d.remove();
        flow.focus();
        if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
        if (ok) this.editor.format('tabs', tabs);
        this.update();
        resolve(ok ? tabs : null);
      });
      d.showModal();
      f.elements.pos.focus();
    });
  }
}

function dedupe(tabs) {
  const out = [];
  for (const s of [...tabs].sort((a, b) => a.pos - b.pos)) if (!out.some((t) => Math.abs(t.pos - s.pos) < 0.5)) out.push(s);
  return out;
}

// Publisher's tab glyphs: L, ⊥, ⅃, ⊥·
function glyph(kind, s) {
  const p = { left: 'M4 2v10h8', center: 'M8 2v10M2 12h12', right: 'M12 2v10H4', decimal: 'M8 2v10M2 12h12M12 7h.01' }[kind];
  return '<svg viewBox="0 0 16 14" width="' + s + '" height="' + s + '"><path d="' + p + '" fill="none" stroke="#323130" stroke-width="2"/>' +
    (kind === 'decimal' ? '<circle cx="12" cy="7" r="1.4" fill="#323130"/>' : '') + '</svg>';
}
