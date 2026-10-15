// Phase 3b/3c: the Order of Worship panel (right side) for a flow-mode worship half.
// Three tabs: Order of Worship (the blocks), Cover, Styles. Every change goes through
// editor.editFlow(), which snapshots for undo, re-lays out the pages and re-renders them.

import { KINDS, KIND_LABEL, ROLES, ROLE_LABEL, blockSummary, newBlock, styleOf, isFlow } from './flow.js';
import { paragraphEl } from './render.js';
import { serializeFlow, canon, pastePlain } from './textedit.js';

const FONTS = ['Palatino Linotype', 'Book Antiqua', 'Candara', 'Candara Light', 'Archer Book', 'Archer Bold',
  'Avenir Next LT Pro', 'Calibri', 'Arial', 'Times New Roman', 'Georgia'];

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value' || k === 'disabled' || k === 'selected') e[k] = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

export class FlowPanel {
  constructor(editor, app) {
    this.editor = editor;
    this.app = app;
    this.root = document.getElementById('flowpanel');
    this.tab = 'order';
    this.selId = null;
  }

  half() { const w = this.app.week(); return w && w.halves.worship; }
  active() { return this.editor.half === 'worship' && isFlow(this.half()); }
  flow() { return this.half().flow; }
  block(id) { return this.flow().blocks.find((b) => b.id === id); }

  // ------------------------------------------------------------ show / refresh
  refresh() {
    const on = this.active();
    this.root.hidden = !on;
    document.body.classList.toggle('flow-editing', on);
    if (!on) { this.highlight(null); return; }
    if (this.selId && !this.block(this.selId)) this.selId = null;
    // keep focus/scroll where they were
    const list = this.root.querySelector('.fp-list');
    const scroll = list ? list.scrollTop : 0;
    this.root.innerHTML = '';
    const tabs = h('div', { class: 'fp-tabs' },
      ...[['order', 'Order of Worship'], ['cover', 'Cover'], ['styles', 'Styles']].map(([k, label]) =>
        h('button', { class: this.tab === k ? 'active' : '', onclick: () => { this.tab = k; this.refresh(); } }, label)));
    this.root.append(tabs);
    const over = (this.half().layout || {}).overflowBlocks || [];
    if (over.length) {
      this.root.append(h('div', { class: 'fp-warn' },
        over.length + ' block(s) do not fit on the worship pages: ',
        ...over.map((id, i) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); this.tab = 'order'; this.select(id); } },
          (i ? ', ' : '') + (blockSummary(this.block(id) || {}).slice(0, 30) || id)))));
    }
    if (this.tab === 'order') this.renderOrder(scroll);
    else if (this.tab === 'cover') this.renderCover();
    else this.renderStyles();
    this.highlight(this.tab === 'order' ? this.selId : null);
  }

  select(id, { scrollPage = true } = {}) {
    this.selId = id;
    this.refresh();
    const row = this.root.querySelector('.fp-row.sel');
    if (row) row.scrollIntoView({ block: 'nearest' });
    if (scrollPage && id) {
      const hit = document.querySelector('.page [data-block="' + CSS.escape(id) + '"]');
      if (hit) hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  highlight(id) {
    document.querySelectorAll('.flow-hl').forEach((e) => e.classList.remove('flow-hl'));
    if (!id) return;
    document.querySelectorAll('.page [data-block="' + CSS.escape(id) + '"]').forEach((e) => e.classList.add('flow-hl'));
  }

  edit(mutate, opts) { return this.editor.editFlow(mutate, opts); }

  // ------------------------------------------------------------ Order of Worship
  renderOrder(scroll) {
    const blocks = this.flow().blocks;
    const sel = this.selId;
    const i = blocks.findIndex((b) => b.id === sel);
    const kindSel = h('select', { title: 'Add a block after the selected one' },
      h('option', { value: '' }, 'Add…'), ...KINDS.map((k) => h('option', { value: k }, KIND_LABEL[k])));
    kindSel.onchange = () => { const k = kindSel.value; kindSel.value = ''; if (k) this.add(k); };
    const bar = h('div', { class: 'fp-bar' },
      kindSel,
      h('button', { title: 'Move up', disabled: i <= 0, onclick: () => this.move(-1) }, '↑'),
      h('button', { title: 'Move down', disabled: i < 0 || i >= blocks.length - 1, onclick: () => this.move(1) }, '↓'),
      h('button', { title: 'Duplicate', disabled: i < 0, onclick: () => this.duplicate() }, 'Duplicate'),
      h('button', { title: 'Delete', disabled: i < 0, onclick: () => this.remove() }, 'Delete'));
    const over = new Set((this.half().layout || {}).overflowBlocks || []);
    const bp = (this.half().layout || {}).blockPage || {};
    const list = h('div', { class: 'fp-list' }, ...blocks.map((b) => h('div', {
      class: 'fp-row' + (b.id === sel ? ' sel' : '') + (over.has(b.id) ? ' over' : ''), dataset: { id: b.id },
      onclick: () => this.select(b.id),
    }, h('span', { class: 'fp-kind k-' + b.kind }, KIND_LABEL[b.kind] || b.kind),
       h('span', { class: 'fp-sum' }, blockSummary(b) || '—'),
       h('span', { class: 'fp-pg' }, over.has(b.id) ? '!' : (bp[b.id] ? 'p' + bp[b.id] : '')))));
    this.root.append(bar, list);
    list.scrollTop = scroll;
    if (i >= 0) this.root.append(this.form(blocks[i]));
    else this.root.append(h('div', { class: 'fp-hint' }, 'Click a block (or a line on a page) to edit it. Changes re-lay the pages at once; Undo (Ctrl+Z) steps back.'));
  }

  newId(kind) { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '-' + kind; }

  add(kind) {
    const b = newBlock(kind, this.newId(kind));
    const id = this.selId;
    return this.edit((flow) => {
      const i = flow.blocks.findIndex((x) => x.id === id);
      flow.blocks.splice(i < 0 ? flow.blocks.length : i + 1, 0, b);
    }).then(() => { this.select(b.id); return b; });
  }

  move(dir) {
    const id = this.selId;
    return this.edit((flow) => {
      const i = flow.blocks.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= flow.blocks.length) return;
      [flow.blocks[i], flow.blocks[j]] = [flow.blocks[j], flow.blocks[i]];
    }).then(() => this.select(id));
  }

  duplicate() {
    const src = this.block(this.selId);
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = this.newId(src.kind);
    return this.edit((flow) => {
      const i = flow.blocks.findIndex((x) => x.id === src.id);
      flow.blocks.splice(i + 1, 0, copy);
    }).then(() => { this.select(copy.id); return copy; });
  }

  remove() {
    const id = this.selId;
    const blocks = this.flow().blocks;
    const i = blocks.findIndex((x) => x.id === id);
    const nextId = (blocks[i + 1] || blocks[i - 1] || {}).id || null;
    return this.edit((flow) => { flow.blocks = flow.blocks.filter((x) => x.id !== id); })
      .then(() => this.select(nextId, { scrollPage: false }));
  }

  // set one field of the selected block (path like 'heading.label')
  set(id, path, value) {
    return this.edit((flow) => {
      const b = flow.blocks.find((x) => x.id === id);
      if (!b) return;
      const keys = path.split('.');
      let o = b;
      for (const k of keys.slice(0, -1)) o = (o[k] ||= {});
      const last = keys[keys.length - 1];
      if (value === '' || value == null || value === false) delete o[last]; else o[last] = value;
    }).then(() => this.select(id, { scrollPage: false }));
  }

  // ------------------------------------------------------------ the block form
  form(b) {
    const f = h('div', { class: 'fp-form' });
    const row = (label, ...ctl) => h('label', { class: 'fp-field' }, h('span', {}, label), ...ctl);
    const text = (path, value, opts = {}) => {
      const inp = h(opts.area ? 'textarea' : 'input', { value: value ?? '', rows: opts.rows, dataset: { field: path } });
      if (opts.area) inp.value = value ?? '';
      inp.addEventListener('change', () => this.set(b.id, path, opts.parse ? opts.parse(inp.value) : inp.value));
      if (opts.area) inp.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
      });
      return inp;
    };
    f.append(h('div', { class: 'fp-title' }, KIND_LABEL[b.kind] + ' block'));

    if (!['section', 'rubric', 'space'].includes(b.kind)) {
      const hd = b.heading || {};
      const standing = h('input', { type: 'checkbox', checked: !!hd.standing, dataset: { field: 'heading.standing' } });
      standing.onchange = () => this.set(b.id, 'heading.standing', standing.checked);
      f.append(h('fieldset', {}, h('legend', {}, 'Order-of-worship line'),
        h('label', { class: 'fp-check' }, standing, ' Congregation stands (prints ' + (this.flow().standingMark || '*') + ')'),
        row('Label', text('heading.label', hd.label)),
        row('Title', text('heading.middle', hd.middle)),
        row('Right', text('heading.right', hd.right))));
    }
    switch (b.kind) {
      case 'item':
        f.append(row('Instruction (italic, centred)', text('rubric', b.rubric, { area: true, rows: 2 })));
        break;
      case 'section': case 'rubric':
        f.append(row(b.kind === 'section' ? 'Divider text' : 'Instruction', text('text', b.text, { area: true, rows: 2 })));
        break;
      case 'dialog': f.append(this.dialogEditor(b)); break;
      case 'prayer': {
        const uni = h('input', { type: 'checkbox', checked: b.unison !== false, dataset: { field: 'unison' } });
        uni.onchange = () => this.edit((fl) => { const x = fl.blocks.find((y) => y.id === b.id); x.unison = uni.checked; }).then(() => this.select(b.id, { scrollPage: false }));
        f.append(h('label', { class: 'fp-check' }, uni, ' Said together (bold)'),
          row('Lines — one per line; start a line with Tab to indent it',
            text('lines', (b.lines || []).join('\n'), { area: true, rows: Math.min(14, (b.lines || []).length + 2),
              parse: (v) => v.replace(/\r/g, '').split('\n').map((l) => l.replace(/^ {2,}/, '\t')).filter((l) => l.trim()) })));
        break;
      }
      case 'scripture':
        f.append(row('Text — a blank line starts a new paragraph',
          text('paragraphs', (b.paragraphs || []).join('\n\n'), { area: true, rows: 10,
            parse: (v) => v.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean) })));
        break;
      case 'hymn': case 'image': f.append(this.imageEditor(b)); break;
      case 'text':
        f.append(h('div', { class: 'fp-sub' }, 'Text — edit in place (Ctrl+B / I / U work); changes apply when you click away'),
          this.richEditor(b.paragraphs || [], (paras) => this.edit((fl) => { fl.blocks.find((y) => y.id === b.id).paragraphs = paras; })
            .then(() => this.select(b.id, { scrollPage: false })), 'rich-text'));
        break;
      case 'space':
        f.append(row('Height (pt)', text('height', b.height, { parse: (v) => Number(v) || 11 })));
        break;
    }
    // common settings
    const brk = h('input', { type: 'checkbox', checked: !!b.pageBreakBefore, dataset: { field: 'pageBreakBefore' } });
    brk.onchange = () => this.set(b.id, 'pageBreakBefore', brk.checked);
    const keep = h('select', { dataset: { field: 'keepTogether' } },
      h('option', { value: '', selected: b.keepTogether == null }, 'Automatic'),
      h('option', { value: 'yes', selected: b.keepTogether === true }, 'Keep on one page'),
      h('option', { value: 'no', selected: b.keepTogether === false }, 'May split'));
    keep.onchange = () => this.edit((fl) => {
      const x = fl.blocks.find((y) => y.id === b.id);
      if (!keep.value) delete x.keepTogether; else x.keepTogether = keep.value === 'yes';
    }).then(() => this.select(b.id, { scrollPage: false }));
    f.append(h('fieldset', {}, h('legend', {}, 'Layout'),
      row('Space before (pt)', text('spaceBefore', b.spaceBefore, { parse: (v) => Number(v) || '' })),
      row('Page break', h('span', {}, brk, ' start on a new page')),
      row('Keep together', keep)));
    if (!['section', 'space'].includes(b.kind)) {
      f.append(h('fieldset', {}, h('legend', {}, 'Margin note (optional, beside the block)'),
        this.richEditor((b.note || []).map((p) => (typeof p === 'string' ? this.plainPara(p, 'note') : p)), (paras) => this.edit((fl) => {
          const x = fl.blocks.find((y) => y.id === b.id);
          const real = paras.filter((p) => p.runs.some((r) => r.text.trim()));
          if (real.length) x.note = real; else delete x.note;
        }).then(() => this.select(b.id, { scrollPage: false })), 'rich-note', true)));
    }
    return f;
  }

  plainPara(text, role) {
    const st = styleOf(this.flow(), role);
    return { style: role, align: st.align || 'left', runs: text ? [{ text, font: st.font, size: st.size }] : [], mark: { font: st.font, size: st.size } };
  }

  dialogEditor(b) {
    const wrap = h('fieldset', {}, h('legend', {}, 'Lines — People lines print bold automatically'));
    const lines = structuredClone(b.lines || []);
    const commit = () => this.edit((fl) => { fl.blocks.find((y) => y.id === b.id).lines = lines.filter((l) => l.text.trim()); })
      .then(() => this.select(b.id, { scrollPage: false }));
    lines.forEach((l, i) => {
      const who = h('select', { dataset: { line: i } },
        h('option', { value: 'leader', selected: l.who === 'leader' }, 'Leader'),
        h('option', { value: 'people', selected: l.who !== 'leader' }, 'People'));
      who.onchange = () => { lines[i].who = who.value; commit(); };
      const t = h('input', { value: l.text, class: 'fp-line ' + (l.who === 'leader' ? '' : 'people'), dataset: { line: i } });
      t.onchange = () => { lines[i].text = t.value; commit(); };
      const x = h('button', { title: 'Remove line', onclick: () => { lines.splice(i, 1); commit(); } }, '×');
      wrap.append(h('div', { class: 'fp-dline' }, who, t, x));
    });
    wrap.append(h('div', { class: 'fp-bar' },
      h('button', { onclick: () => { lines.push({ who: 'leader', text: 'Leader line' }); commit(); } }, '+ Leader'),
      h('button', { onclick: () => { lines.push({ who: 'people', text: 'People line' }); commit(); } }, '+ People')));
    return wrap;
  }

  imageEditor(b) {
    const wrap = h('fieldset', {}, h('legend', {}, 'Music / pictures — full 6" width unless set; a picture never splits'));
    const base = this.app.week().baseUrl;
    (b.images || []).forEach((a, i) => {
      const w = (b.imageWidths && b.imageWidths[i]) || '';
      const width = h('input', { type: 'number', step: '0.05', value: w ? (w / 72).toFixed(2) : '', placeholder: '6.00', title: 'Width in inches' });
      width.onchange = () => this.edit((fl) => {
        const x = fl.blocks.find((y) => y.id === b.id);
        x.imageWidths = x.imageWidths || [];
        x.imageWidths[i] = width.value ? Math.round(parseFloat(width.value) * 72 * 100) / 100 : null;
        if (x.imageWidths.every((v) => !v)) delete x.imageWidths;
      }).then(() => this.select(b.id, { scrollPage: false }));
      wrap.append(h('div', { class: 'fp-img' },
        h('img', { src: new URL(a, base).href }),
        h('span', { class: 'fp-sum' }, a.split('/').pop()),
        h('label', {}, 'W ', width),
        h('button', { title: 'Remove', onclick: () => this.edit((fl) => {
          const x = fl.blocks.find((y) => y.id === b.id);
          x.images.splice(i, 1);
          if (x.imageWidths) x.imageWidths.splice(i, 1);
        }).then(() => this.select(b.id, { scrollPage: false })) }, '×')));
    });
    wrap.append(h('button', { onclick: async () => {
      const rel = await window.bb.importPicture(this.app.file());
      if (rel) await this.addImage(b.id, rel);
    } }, 'Add picture…'));
    return wrap;
  }

  addImage(id, rel) {
    return this.edit((fl) => { const x = fl.blocks.find((y) => y.id === id); (x.images ||= []).push(rel); })
      .then(() => this.select(id, { scrollPage: false }));
  }

  // a small rich-text editor: the paragraphs drawn by the real renderer, contentEditable; read back
  // with the same serializer the page editor uses
  richEditor(paras, onCommit, cls, allowEmpty = false) {
    const box = h('div', { class: 'fp-rich ' + cls, contenteditable: 'true', spellcheck: 'true' });
    const flow = h('div', { class: 'flow' });
    const src = paras.length ? paras : (allowEmpty ? [this.plainPara('', cls === 'rich-note' ? 'note' : 'body')] : []);
    for (const p of src) flow.append(paragraphEl(p));
    box.append(flow);
    box.addEventListener('paste', pastePlain);
    box.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); } });
    box.addEventListener('blur', () => {
      const out = serializeFlow(flow).map((p) => { delete p.continues; return p; });
      const before = paras.length ? paras : [];
      const clean = (list) => list.filter((p) => p.runs.some((r) => r.text.trim()));
      if (canon(clean(out)) === canon(clean(before))) return;
      onCommit(out);
    });
    return box;
  }

  // ------------------------------------------------------------ Cover
  renderCover() {
    const c = this.flow().cover || {};
    const f = h('div', { class: 'fp-form' }, h('div', { class: 'fp-title' }, 'Cover (page 1)'));
    const setCover = (path, v) => this.edit((fl) => {
      fl.cover ||= {};
      const keys = path.split('.');
      let o = fl.cover;
      for (const k of keys.slice(0, -1)) o = (o[k] ||= {});
      o[keys[keys.length - 1]] = v;
    }).then(() => this.refresh());
    const inp = (path, v) => {
      const e = h('input', { value: v || '', dataset: { field: 'cover.' + path } });
      e.onchange = () => setCover(path, e.value);
      return e;
    };
    const row = (label, ctl) => h('label', { class: 'fp-field' }, h('span', {}, label), ctl);
    const art = c.art || {};
    f.append(row('Date', inp('date', c.date)), row('Sunday', inp('day', c.day)), row('Service', inp('service', c.service)),
      h('fieldset', {}, h('legend', {}, 'Artwork'),
        art.asset ? h('img', { class: 'fp-cover-art', src: new URL(art.asset, this.app.week().baseUrl).href }) : h('div', { class: 'fp-hint' }, 'No picture'),
        h('button', { onclick: async () => { const rel = await window.bb.importPicture(this.app.file()); if (rel) await setCover('art.asset', rel); } }, 'Change picture…'),
        row('Title', inp('art.title', art.title)), row('Artist', inp('art.artist', art.artist))),
      h('div', { class: 'fp-sub' }, 'Commentary (edit in place; applies when you click away)'),
      this.richEditor(c.commentary || [], (paras) => setCover('commentary', paras), 'rich-text', true));
    this.root.append(f);
  }

  // ------------------------------------------------------------ Styles
  renderStyles() {
    const fl = this.flow();
    const f = h('div', { class: 'fp-form' }, h('div', { class: 'fp-title' }, 'Styles — one change updates every block'));
    const setStyle = (role, k, v) => this.edit((flow) => {
      flow.styles ||= {};
      const st = (flow.styles[role] ||= {});
      // an explicit false / left is kept: deleting it would bring back the default (e.g. People = bold)
      if (v === '' || v == null) delete st[k]; else st[k] = v;
    }).then(() => this.refresh());
    for (const role of ROLES) {
      const st = styleOf(fl, role);
      const font = h('select', { dataset: { style: role, k: 'font' } }, ...FONTS.concat(FONTS.includes(st.font) ? [] : [st.font]).map((n) => h('option', { selected: n === st.font }, n)));
      font.onchange = () => setStyle(role, 'font', font.value);
      const num = (k, step = 0.5) => {
        const e = h('input', { type: 'number', step, value: st[k] ?? '', dataset: { style: role, k } });
        e.onchange = () => setStyle(role, k, e.value === '' ? '' : Number(e.value));
        return e;
      };
      const chk = (k, label) => {
        const e = h('input', { type: 'checkbox', checked: !!st[k], dataset: { style: role, k } });
        e.onchange = () => setStyle(role, k, e.checked);
        return h('label', { class: 'fp-check' }, e, label);
      };
      const align = h('select', { dataset: { style: role, k: 'align' } }, ...['left', 'center', 'right', 'justify'].map((a) => h('option', { selected: (st.align || 'left') === a }, a)));
      align.onchange = () => setStyle(role, 'align', align.value);
      f.append(h('fieldset', { class: 'fp-style' }, h('legend', {}, ROLE_LABEL[role]),
        h('div', { class: 'fp-srow' }, font, h('label', {}, 'pt ', num('size')), chk('bold', 'B'), chk('italic', 'I'), align),
        h('div', { class: 'fp-srow' }, h('label', {}, 'before ', num('spaceBefore')), h('label', {}, 'after ', num('spaceAfter')),
          h('label', {}, 'indent ', num('indentLeft', 1)))));
    }
    this.root.append(f);
  }
}
