// Phase 3: flow mode for the worship half. Design: docs/PHASE3_DESIGN.md.
//
// The worship half keeps an ordered list of liturgical blocks (half.flow). layoutFlow() compiles
// the blocks into the format's ordinary paragraphs and pictures, measures them with the real
// renderer, and pours them onto the worship pages' 6" text grid. The result is written back as
// ORDINARY frames marked `generated: true`, so renderPage(), PDF export and every Phase 2 tool see
// nothing new. Frames placed by hand on a flow page are kept as they are.

import { paragraphEl, layoutTabs, cssFont } from './render.js';
import { splitParagraph } from './textedit.js';

export const LAYOUT_VERSION = 3;   // bump when pagination rules change: saved layouts are redone
export const KINDS = ['item', 'section', 'dialog', 'prayer', 'scripture', 'hymn', 'image', 'rubric', 'text', 'space'];
export const KIND_LABEL = {
  item: 'Item', section: 'Section', dialog: 'Leader / People', prayer: 'Prayer', scripture: 'Scripture',
  hymn: 'Hymn (music)', image: 'Picture', rubric: 'Instruction', text: 'Text', space: 'Space',
};
export const ROLES = ['item', 'section', 'rubric', 'leader', 'people', 'prayer', 'scripture', 'body', 'credit', 'note'];
export const ROLE_LABEL = {
  item: 'Order-of-worship line', section: 'Section divider', rubric: 'Instruction (italic)',
  leader: 'Leader line', people: 'People line', prayer: 'Unison prayer', scripture: 'Scripture',
  body: 'Text', credit: 'Credits', note: 'Margin note',
};

const FONT = 'Palatino Linotype';
const DEFAULT_GRID = { left: 36, top: 36, width: 432, height: 540,
  tabs: [{ pos: 36, align: 'left' }, { pos: 216, align: 'center' }, { pos: 432, align: 'right' }] };
export const DEFAULT_STYLES = {
  item: { font: FONT, size: 11, spaceBefore: 11, keepWithNext: true },
  rubric: { font: FONT, size: 11, italic: true, align: 'center' },
  section: { font: FONT, size: 11, align: 'center', spaceBefore: 11, keepWithNext: true },
  leader: { font: FONT, size: 11, indentLeft: 18 },
  people: { font: FONT, size: 11, bold: true, indentLeft: 36 },
  prayer: { font: FONT, size: 11, bold: true, indentLeft: 18 },
  scripture: { font: FONT, size: 11, align: 'justify', indentLeft: 18, indentRight: 18, indentFirst: 18 },
  credit: { font: FONT, size: 10 },
  body: { font: FONT, size: 11 },
  note: { font: 'Avenir Next LT Pro', size: 10 },
};

// Cover geometry: the 9-20-26 Publisher cover (page 1), in points.
const COVER = {
  masthead: { x: 36, y: 28.173, w: 432, h: 163.358 },
  logo: { x: 68.4, y: 41.406, w: 41.645, h: 92.042 },
  rule: { x: 68.4, y: 168.057, w: 367.2 },
  art: { x: 68.4, y: 175.18, w: 367.2, h: 243.18 },
  caption: { w: 321.807, h: 33.64 },
  commentary: { x: 36, y: 456.213, w: 432, h: 136.705 },
};
const NOTE = { w: 133, gap: 6 };

const textLen = (p) => p.runs.reduce((n, r) => n + r.text.length, 0);
export const isFlow = (half) => !!(half && half.mode === 'flow' && half.flow);
export function grid(flow) { return { ...DEFAULT_GRID, ...(flow.grid || {}) }; }
export function styleOf(flow, role) { return { ...DEFAULT_STYLES[role], ...((flow.styles || {})[role] || {}) }; }

// ------------------------------------------------------------------ hashing
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function flowHash(week, half) {
  const pages = worshipPages(week);
  return LAYOUT_VERSION + '-' + fnv(JSON.stringify([half.flow, pages, week.manifest.page]));
}
export function worshipPages(week) {
  return week.manifest.pages.filter((p) => p.half === 'worship').map((p) => p.number).sort((a, b) => a - b);
}

// ------------------------------------------------------------------ compile: block -> items
// item = { type: 'para', para, keepWithNext, keepTogether, block } | { type: 'image', asset, w, h, block, spaceBefore }
function paraFrom(style, text, extra = {}) {
  const runText = text;
  const run = { text: runText, font: style.font, size: style.size };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.color) run.color = style.color;
  const p = { style: extra.role, align: style.align || 'left', runs: runText ? [run] : [], mark: { font: style.font, size: style.size } };
  for (const k of ['spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'indentFirst', 'lineSpacing']) if (style[k] != null) p[k] = style[k];
  return Object.assign(p, extra.props || {});
}

function headingText(flow, h) {
  const mark = h.standing ? (flow.standingMark || '*') : '';
  const label = mark + (h.label || '');
  if (h.middle) return { text: label + '\t' + h.middle + '\t' + (h.right || ''), tabs: [{ pos: 216, align: 'center' }, { pos: 432, align: 'right' }] };
  if (h.right) return { text: label + '\t' + h.right, tabs: [{ pos: 432, align: 'right' }] };
  return { text: label, tabs: [] };
}

export function compileBlock(flow, b, natural) {
  const items = [];
  const g = grid(flow);
  const P = (role, text, opts = {}) => {
    const st = styleOf(flow, role);
    const para = paraFrom(st, text, { role, props: opts.props });
    para.block = b.id;
    if (!para.tabs) para.tabs = g.tabs.map((t) => ({ ...t }));
    items.push({ type: 'para', para, block: b.id, keepWithNext: !!(opts.keepWithNext ?? st.keepWithNext), keepTogether: !!opts.keepTogether });
    return para;
  };
  if (b.heading && (b.heading.label || b.heading.middle || b.heading.right)) {
    const h = headingText(flow, b.heading);
    const hp = P('item', h.text, { keepWithNext: true, keepTogether: true, props: { tabs: h.tabs } });
    // a hymn's tune name (the right-hand column) is set in small caps, as in the Publisher bulletins
    if (/^\*?\s*HYMN\b/i.test(b.heading.label || '') && b.heading.right && hp.runs.length === 1) {
      const r = hp.runs[0], i = r.text.lastIndexOf('\t');
      if (i >= 0) hp.runs = [{ ...r, text: r.text.slice(0, i + 1) }, { ...r, text: r.text.slice(i + 1), smallCaps: true }];
    }
  }
  if (b.rubric) for (const line of String(b.rubric).split('\n')) if (line.trim()) P('rubric', line, { keepTogether: true });
  const lines = (arr) => (arr || []).filter((l) => (typeof l === 'string' ? l : l.text || '').length);
  switch (b.kind) {
    case 'section': P('section', b.text || '', { keepWithNext: true, keepTogether: true }); break;
    case 'rubric': for (const line of String(b.text || '').split('\n')) if (line.trim()) P('rubric', line, { keepTogether: true }); break;
    case 'dialog':
      for (const l of lines(b.lines)) {
        const role = l.who === 'leader' ? 'leader' : 'people';
        P(role, l.text, { keepTogether: true });
      }
      break;
    case 'prayer': {
      const st = styleOf(flow, 'prayer');
      for (const l of lines(b.lines)) {
        const indented = /^\t/.test(l);
        const p = P('prayer', l.replace(/^\t+/, ''), { keepTogether: true,
          props: { indentLeft: (st.indentLeft || 0) + (indented ? 18 : 0), tabs: [{ pos: (st.indentLeft || 0) + 18, align: 'left' }, ...g.tabs.slice(1)] } });
        if (b.unison === false) p.runs.forEach((r) => delete r.bold);
      }
      break;
    }
    case 'scripture': for (const t of b.paragraphs || []) P('scripture', String(t)); break;
    case 'text':
      for (const src of b.paragraphs || []) {
        const para = structuredClone(src);
        para.block = b.id;
        delete para.continues;
        items.push({ type: 'para', para, block: b.id, keepWithNext: !!para.keepWithNext, keepTogether: false });
      }
      break;
    case 'hymn': case 'image':
      (b.images || []).forEach((asset, i) => {
        const nat = natural[asset] || { w: 4, h: 3 };
        const w = Math.min(g.width, (b.imageWidths && b.imageWidths[i]) || b.width || g.width);
        items.push({ type: 'image', asset, w, h: w * nat.h / nat.w, block: b.id, spaceBefore: 0 });
      });
      break;
    case 'space': items.push({ type: 'space', h: Number(b.height) || 11, block: b.id }); break;
    default: break;
  }
  if (!items.length) return items;
  // short liturgical units stay on one page: every line but the last keeps with the next
  // (a block taller than a page still breaks — the backoff never empties a page)
  const paras = items.filter((it) => it.type === 'para');
  const together = b.keepTogether ?? (['dialog', 'prayer', 'section', 'rubric', 'item'].includes(b.kind) ||
    (b.kind === 'text' && paras.length <= 8 && paras.every((it) => textLen(it.para) < 400)));
  if (together) {
    items.forEach((it, i) => { if (i < items.length - 1) it.keepWithNext = true; if (it.type === 'para') it.keepTogether = true; });
  }
  // a block's LAST line keeps with the next block only for a section divider (or when the block
  // asks for it): a heading-only item such as "*HYMN ⇥ TFWS 2009" must not drag the whole next
  // unit (the Collect dialog) onto its page — that pushed 10-18's hymn from page 2 to page 3
  const tail = items[items.length - 1];
  // (a `text` block keeps Word's own keep-with-next on its last paragraph)
  tail.keepWithNext = !!(b.keepWithNext ?? (b.kind === 'section' || (b.kind === 'text' && tail.keepWithNext)));
  // a margin note takes a column on the right: the block's lines stop short of it
  if (b.note && b.note.length) {
    for (const it of paras) it.para.indentRight = Math.max(it.para.indentRight || 0, NOTE.w + NOTE.gap);
    const h = items.find((it) => it.type === 'para' && it.para.style === 'item');
    if (h) h.para.indentRight = 0;   // the heading line keeps its full width (right-hand names)
    // the note hangs beside the first body line; the next block must start below it
    const anchor = paras.find((it) => it.para.style !== 'item') || paras[0];
    if (anchor) anchor.noteH = measureHeight(noteParas(flow, b), NOTE.w - 8.88) + 6.76;
  }
  const first = items[0];
  if (b.spaceBefore) {
    if (first.type === 'para') first.para.spaceBefore = (first.para.spaceBefore || 0) + Number(b.spaceBefore);
    else first.spaceBefore = (first.spaceBefore || 0) + Number(b.spaceBefore);
  }
  if (b.pageBreakBefore) first.pageBreakBefore = true;
  return items;
}

// ------------------------------------------------------------------ measuring harness
function harness(week, g) {
  const host = document.createElement('div');
  host.className = 'page measuring flow-measure';
  Object.assign(host.style, { position: 'absolute', left: '-30000px', top: '0', width: week.manifest.page.width + 'pt',
    height: '100000pt', visibility: 'hidden', overflow: 'visible' });
  const frame = document.createElement('div');
  frame.className = 'frame frame-text measuring';
  Object.assign(frame.style, { left: g.left + 'pt', top: '0', width: g.width + 'pt', height: '100000pt' });
  const area = document.createElement('div');
  area.className = 'text-area';
  Object.assign(area.style, { left: '0', top: '0', width: g.width + 'pt', height: '100000pt' });
  area.dataset.wpt = g.width;
  const flow = document.createElement('div');
  flow.className = 'flow';
  area.appendChild(flow);
  frame.appendChild(area);
  host.appendChild(frame);
  document.body.appendChild(host);
  const pxPerPt = () => area.getBoundingClientRect().width / g.width;
  return { host, frame, area, flow, pxPerPt, remove: () => host.remove() };
}

async function naturalSizes(week, assets) {
  const out = {};
  await Promise.all([...new Set(assets)].map((a) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { out[a] = { w: im.naturalWidth || 4, h: im.naturalHeight || 3 }; res(); };
    im.onerror = () => { out[a] = { w: 4, h: 3 }; res(); };
    im.src = new URL(a, week.baseUrl).href;
  })));
  return out;
}

// ------------------------------------------------------------------ pagination
// Fill one page starting at `start` (= { k, partial }), never taking items at index >= limit.
function placePage(items, start, limit, H, g, bottom, defaultTab) {
  const placements = [];   // { k, kind: 'para'|'image'|'space', split?: true, y?, para? }
  const frames = [];       // { type:'text', y, h, paras } | { type:'image', ... }
  let y = g.top;
  let seg = null;
  let next = null;
  let noteFloor = 0, noteBlock = null;   // a margin note's bottom: the next block starts below it
  const segHeight = () => H.flow.getBoundingClientRect().height / H.pxPerPt();
  const fits = () => {
    layoutTabs(H.frame, defaultTab);
    return seg.y + segHeight() <= bottom + 0.5;
  };
  const open = () => { H.flow.innerHTML = ''; seg = { y, paras: [], tops: [] }; };
  const close = () => {
    if (!seg) return;
    if (seg.paras.length) {
      layoutTabs(H.frame, defaultTab);
      const h = segHeight();
      frames.push({ type: 'text', y: seg.y, h, paras: seg.paras });
      y = seg.y + h;
    }
    seg = null;
  };
  for (let k = start.k; k < items.length && k < limit; k++) {
    const it = k === start.k && start.partial ? start.partial : items[k];
    if (noteFloor && it.block !== noteBlock) {
      const cur = seg ? seg.y + segHeight() : y;
      if (noteFloor > cur) { close(); y = noteFloor; }
      noteFloor = 0;
    }
    const empty = placements.length === 0;
    if (it.pageBreakBefore && !empty && !(k === start.k && start.partial)) { next = { k }; break; }
    if (it.type === 'image' || it.type === 'space') {
      close();
      const gap = empty ? 0 : (it.spaceBefore || 0);
      let w = it.w || 0, h = it.h;
      const room = bottom - g.top;
      if (it.type === 'image' && h > room) { w = w * room / h; h = room; }
      if (y + gap + h > bottom + 0.5 && !empty) { next = { k }; break; }
      if (it.type === 'image') frames.push({ type: 'image', asset: it.asset, x: g.left + (g.width - w) / 2, y: y + gap, w, h, block: it.block });
      y += gap + h;
      placements.push({ k, kind: it.type, block: it.block, y: y - h });
      continue;
    }
    if (!seg) open();
    const para = structuredClone(it.para);
    if (empty && seg.paras.length === 0) delete para.spaceBefore;
    const el = paragraphEl(para);
    H.flow.appendChild(el);
    if (fits()) {
      seg.paras.push(para);
      const py = seg.y + el.offsetTop / H.pxPerPt();
      placements.push({ k, kind: 'para', block: it.block, y: py });
      if (it.noteH) { noteFloor = py + it.noteH + 4; noteBlock = it.block; }
      continue;
    }
    el.remove();
    // a keep-together line moves whole, unless it alone is taller than a page
    if (it.keepTogether && !(empty && seg.paras.length === 0)) { next = { k }; break; }
    const text = para.runs.map((r) => r.text).join('');
    const n = textLen(para);
    const cuts = [];
    for (let c = 1; c < n; c++) if (text[c - 1] === ' ' || text[c - 1] === '\n') cuts.push(c);
    let lo = 0, hi = cuts.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [head] = splitParagraph(para, cuts[mid]);
      const probe = paragraphEl(head);
      H.flow.appendChild(probe);
      const ok = fits();
      probe.remove();
      if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best >= 0) {
      const [head, tail] = splitParagraph(para, cuts[best]);
      delete head.continues;
      delete tail.continues;
      head.splitHead = true;     // Finish Layout links the pages: this paragraph carries on in the next box
      if (head.align === 'justify') head.justifyLast = true;
      H.flow.appendChild(paragraphEl(head));
      seg.paras.push(head);
      placements.push({ k, kind: 'para', block: it.block, split: true, y: seg.y });
      next = { k, partial: { ...it, para: tail, pageBreakBefore: false } };
      break;
    }
    if (empty && seg.paras.length === 0) {
      // nothing of it fits even on an empty page (a single unbreakable line): place it anyway
      H.flow.appendChild(paragraphEl(para));
      seg.paras.push(para);
      placements.push({ k, kind: 'para', block: it.block, y: seg.y });
      continue;
    }
    next = { k };
    break;
  }
  close();
  if (!next && limit < items.length) {
    // stopped by the keep-with-next limit: resume there (or after the partial we started with)
    next = { k: Math.max(limit, start.partial ? start.k + 1 : start.k) };
  }
  return { placements, frames, next };
}

export async function layoutFlow(week, half) {
  const flow = half.flow;
  const g = grid(flow);
  const bottom = g.top + g.height;
  const defaultTab = week.manifest.defaultTabStop || 36;
  await document.fonts.ready;
  const natural = await naturalSizes(week, [
    ...(flow.blocks || []).flatMap((b) => b.images || []),
    ...((flow.cover && flow.cover.art && flow.cover.art.asset) ? [flow.cover.art.asset] : []),
  ]);
  const items = (flow.blocks || []).flatMap((b) => compileBlock(flow, b, natural));
  const pages = worshipPages(week);
  const coverPage = pages[0];
  const bodyPages = pages.slice(1);
  const H = harness(week, g);
  const out = {};          // page -> frames[]
  const blockPage = {};    // block id -> first page it lands on
  const notesAt = [];      // { block, page, y }
  let state = { k: 0 };
  try {
    for (const n of bodyPages) {
      if (state.k >= items.length) { out[n] = []; continue; }
      let limit = items.length;
      let r = placePage(items, state, limit, H, g, bottom, defaultTab);
      // keep-with-next: never end a page on a heading whose next line went over
      while (r.next && !r.next.partial && r.placements.length > 1) {
        const last = r.placements[r.placements.length - 1];
        if (last.split || !items[last.k].keepWithNext) break;
        let cut = r.placements.length - 1;
        while (cut > 0 && !r.placements[cut - 1].split && items[r.placements[cut - 1].k].keepWithNext) cut--;
        if (cut === 0) break;
        limit = r.placements[cut].k;
        r = placePage(items, state, limit, H, g, bottom, defaultTab);
      }
      out[n] = framesFor(n, r.frames);
      for (const pl of r.placements) {
        if (!(pl.block in blockPage)) blockPage[pl.block] = n;
      }
      for (const pl of r.placements) {
        if (blockPage[pl.block] !== n || notesAt.some((x) => x.block === pl.block)) continue;
        const it = items[pl.k];
        if (it.type === 'para' && it.para.style === 'item') continue;   // beside the body, under its heading
        notesAt.push({ block: pl.block, page: n, y: pl.y });
      }
      state = r.next || { k: items.length };
    }
  } finally {
    H.remove();
  }
  const overflowBlocks = state.k < items.length ? [...new Set(items.slice(state.k).map((it) => it.block))] : [];
  // margin notes beside the first line of their block
  for (const { block, page, y } of notesAt) {
    const b = flow.blocks.find((x) => x.id === block);
    if (!b || !b.note || !b.note.length) continue;
    const nf = noteFrame(week, flow, b, page, y, g);
    // a thin rule down its left edge, like the connector lines beside the Word / Publisher notes
    out[page].push(nf, { id: 'gr-' + b.id, kind: 'shape', generated: true, block: b.id, shape: { type: 'line' },
      x: nf.x + 1, y: nf.y + 2, w: 0, h: r2(nf.h - 4), z: 5, stroke: { color: '#000000', width: 0.75 } });
  }
  // write: generated frames replace the old generated ones; hand-placed frames stay
  const pageObj = (n) => (half.pages[String(n)] ||= { frames: [] });
  for (const n of pages) {
    const pg = pageObj(n);
    const hand = (pg.frames || []).filter((f) => !f.generated);
    const gen = n === coverPage ? (flow.cover ? coverFrames(week, flow, natural) : []) : (out[n] || []);
    pg.frames = [...gen, ...hand];
  }
  half.layout = { flowHash: flowHash(week, half), version: LAYOUT_VERSION, overflowBlocks, blockPage };
  return half.layout;
}

function framesFor(n, frames) {
  let k = 0;
  return frames.map((f) => {
    k++;
    if (f.type === 'image') {
      return { id: 'g' + n + '-' + k, kind: 'image', generated: true, block: f.block, x: r2(f.x), y: r2(f.y), w: r2(f.w), h: r2(f.h), z: 1,
        image: { asset: f.asset, crop: [0, 0, 0, 0], fit: 'fit' } };
    }
    const blocks = [...new Set(f.paras.map((p) => p.block).filter(Boolean))];
    return { id: 'g' + n + '-' + k, kind: 'text', generated: true, block: blocks[0], blocks,
      x: 36, y: r2(f.y), w: 432, h: r2(f.h + 1.5), z: 1,
      text: { inset: [0, 0, 0, 0], valign: 'top', paragraphs: f.paras } };
  });
}
const r2 = (v) => Math.round(v * 100) / 100;

function noteParas(flow, b) {
  const st = styleOf(flow, 'note');
  return (b.note || []).map((src) => {
    const p = typeof src === 'string' ? paraFrom(st, src, { role: 'note' }) : structuredClone(src);
    p.block = b.id;
    return p;
  });
}

function noteFrame(week, flow, b, page, y, g) {
  const paras = noteParas(flow, b);
  // the right-hand column of the text area, beside the block's lines (which stop short of it)
  const x = g.left + g.width - NOTE.w;
  const inset = [2.88, 2.88, 2.88, 6];
  return { id: 'gn-' + b.id, kind: 'text', generated: true, block: b.id, note: true, x: r2(x), y: r2(y), w: NOTE.w,
    h: r2(measureHeight(paras, NOTE.w - inset[1] - inset[3]) + inset[0] + inset[2] + 1), z: 5,
    text: { inset, valign: 'top', paragraphs: paras } };
}

function measureHeight(paras, width) {
  const host = document.createElement('div');
  host.className = 'page measuring';
  Object.assign(host.style, { position: 'absolute', left: '-30000px', top: '0', width: width + 'pt', visibility: 'hidden' });
  const flow = document.createElement('div');
  flow.className = 'flow';
  for (const p of paras) flow.appendChild(paragraphEl(p));
  host.appendChild(flow);
  document.body.appendChild(host);
  const pxPerPt = host.getBoundingClientRect().width / width;
  const h = flow.getBoundingClientRect().height / pxPerPt;
  host.remove();
  return h;
}

// ------------------------------------------------------------------ cover
export function coverFrames(week, flow, natural) {
  const c = flow.cover || {};
  const P = (text, font, size, extra = {}, runExtra = {}) => ({ style: 'cover', align: 'center', tabs: [{ pos: 216, align: 'center' }],
    runs: text ? [{ text, font, size, ...runExtra }] : [], mark: { font, size }, ...extra });
  const frames = [];
  const C = COVER;
  frames.push({ id: 'gc-masthead', kind: 'text', generated: true, block: 'cover', ...C.masthead, z: 19, fill: { color: '#FFFFFF' },
    text: { inset: [0, 0, 0, 0], valign: 'top', paragraphs: [
      { ...P('Highland', 'Archer Bold', 48, {}, { allCaps: true }) },
      P('United Methodist Church', 'Archer Bold', 20, {}, { tracking: 112.5 }),
      P(c.date || '', FONT, 14),
      P(c.day || '', FONT, 14, {}, { italic: true }),
      P(c.service || '', FONT, 14),
    ] } });
  if (c.logo) frames.push({ id: 'gc-logo', kind: 'image', generated: true, block: 'cover', ...C.logo, z: 20, image: { asset: c.logo, crop: [0, 0, 0, 0], fit: 'crop' } });
  frames.push({ id: 'gc-rule', kind: 'shape', generated: true, block: 'cover', x: C.rule.x, y: C.rule.y, w: C.rule.w, h: 0, z: 21,
    shape: { type: 'line' }, stroke: { color: '#000000', width: 1.5 } });
  const art = c.art || {};
  let artBottom = C.art.y + C.art.h;
  if (art.asset) {
    const nat = natural[art.asset] || { w: C.art.w, h: C.art.h };
    const s = Math.min(C.art.w / nat.w, C.art.h / nat.h);
    const w = nat.w * s, h = nat.h * s;
    frames.push({ id: 'gc-art', kind: 'image', generated: true, block: 'cover', x: r2(C.art.x + (C.art.w - w) / 2), y: C.art.y, w: r2(w), h: r2(h), z: 75,
      image: { asset: art.asset, crop: [0, 0, 0, 0], fit: 'fit' } });
    artBottom = C.art.y + h;
  }
  frames.push({ id: 'gc-caption', kind: 'text', generated: true, block: 'cover', x: r2(C.art.x + C.art.w - C.caption.w), y: r2(artBottom), w: C.caption.w, h: C.caption.h, z: 18,
    text: { inset: [2.88, 2.88, 2.88, 2.88], valign: 'top', paragraphs: [
      { style: 'cover', align: 'right', runs: art.title ? [{ text: art.title, font: FONT, size: 10, italic: true }] : [], mark: { font: FONT, size: 10 } },
      { style: 'cover', align: 'right', runs: art.artist ? [{ text: art.artist, font: FONT, size: 10 }] : [], mark: { font: FONT, size: 10 } },
    ] } });
  frames.push({ id: 'gc-commentary', kind: 'text', generated: true, block: 'cover', ...C.commentary, z: 22,
    text: { inset: [7.2, 7.2, 7.2, 7.2], valign: 'top', paragraphs: structuredClone(c.commentary || []) } });
  return frames;
}

// ------------------------------------------------------------------ helpers for the panel / editor
export function blockSummary(b) {
  const h = b.heading || {};
  const head = [h.standing ? '*' : '', h.label || ''].join('') + (h.middle ? ' — ' + h.middle : '') + (h.right ? ' — ' + h.right : '');
  switch (b.kind) {
    case 'section': return b.text || '';
    case 'rubric': return (b.text || '').split('\n')[0];
    case 'text': return head || ((b.paragraphs || [])[0] ? b.paragraphs[0].runs.map((r) => r.text).join('').slice(0, 60) : '');
    case 'space': return (b.height || 11) + ' pt';
    case 'image': return (b.images || []).map((a) => a.split('/').pop()).join(', ');
    default: return head || (b.lines && b.lines[0] ? (typeof b.lines[0] === 'string' ? b.lines[0] : b.lines[0].text) : '') || (b.paragraphs && b.paragraphs[0]) || '';
  }
}

export function newBlock(kind, id) {
  const b = { id, kind };
  if (['item', 'dialog', 'prayer', 'scripture', 'hymn'].includes(kind)) b.heading = { standing: false, label: 'NEW ITEM', middle: '', right: '' };
  if (kind === 'section') b.text = '——— SECTION ———';
  if (kind === 'rubric') b.text = 'Instruction';
  if (kind === 'dialog') b.lines = [{ who: 'leader', text: 'Leader line' }, { who: 'people', text: 'People line' }];
  if (kind === 'prayer') { b.unison = true; b.lines = ['Prayer line']; }
  if (kind === 'scripture') b.paragraphs = ['Scripture text'];
  if (kind === 'hymn' || kind === 'image') b.images = [];
  if (kind === 'text') b.paragraphs = [{ style: 'body', align: 'left', runs: [{ text: 'Text', font: FONT, size: 11 }], mark: { font: FONT, size: 11 } }];
  if (kind === 'space') b.height = 11;
  return b;
}

export { cssFont };

// ------------------------------------------------------------------ Finish Layout (item 6)
// Bulletin ▸ Finish Layout: the laid-out worship pages become ordinary Publisher-style objects.
// Every body text box (pages 2…) is linked, in reading order, into ONE story; each page's last box
// ends with a text box break so the page breaks stay where the layout put them (delete one with ¶ on
// to let text flow on), and is stretched to the bottom margin so added lines have room. Pictures,
// margin notes and the cover become ordinary unlocked objects. The draft (blocks, styles, cover) is
// kept in half.draft, so Back to Draft can lay it out again — throwing away hand changes to the
// converted boxes (boxes added by hand stay).
export async function finishLayout(week, half) {
  await layoutFlow(week, half);                       // fresh, so split paragraphs are marked
  const g = grid(half.flow);
  const bottom = g.top + g.height;
  const pages = worshipPages(week);
  const story = 'worship-' + Date.now().toString(36);
  let index = 0;
  for (const n of pages) {
    const pg = half.pages[String(n)];
    if (!pg) continue;
    const gen = pg.frames.filter((f) => f.generated);
    const texts = n === pages[0] ? [] : gen.filter((f) => f.kind === 'text' && !f.note).sort((a, b) => a.y - b.y);
    for (const t of texts) {
      t.text.chain = { story, index: index++ };
      for (const p of t.text.paragraphs) { if (p.splitHead) p.continues = true; delete p.splitHead; }
    }
    const last = texts[texts.length - 1];
    if (last) {
      const lp = last.text.paragraphs[last.text.paragraphs.length - 1];
      if (lp && !lp.continues) {
        if (lp.runs.length) lp.runs[lp.runs.length - 1].text += '\u000c';
        else lp.runs.push({ text: '\u000c', font: (lp.mark || {}).font || 'Palatino Linotype', size: (lp.mark || {}).size || 11 });
        // a page-end break holds the page together only in ITS box: when typing pushes this paragraph
        // on to the next page the break stays quiet there, so one extra line moves one line, not a page
        lp.boxEnd = last.id;
      }
      const below = gen.some((f) => f !== last && !f.note && f.kind !== 'shape' && f.y >= last.y + last.h - 1);
      if (!below) last.h = Math.round((bottom - last.y) * 100) / 100;
    }
    for (const f of gen) { delete f.generated; f.fromDraft = true; }
  }
  half.draft = { flow: half.flow, layout: half.layout, finishedAt: new Date().toISOString() };
  delete half.flow;
  delete half.layout;
  half.mode = 'finished';
  return { story, boxes: index };
}

// Bulletin ▸ Back to Draft: the order of worship lays the pages out again from the kept draft
export async function backToDraft(week, half) {
  if (!half.draft) return false;
  half.mode = 'flow';
  half.flow = half.draft.flow;
  half.layout = half.draft.layout;
  delete half.draft;
  for (const n of worshipPages(week)) {
    const pg = half.pages[String(n)];
    if (pg) pg.frames = pg.frames.filter((f) => !f.fromDraft);
  }
  await layoutFlow(week, half);
  return true;
}
export const isFinished = (half) => !!(half && half.mode === 'finished' && half.draft);
