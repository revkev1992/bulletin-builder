// The one renderer. Screen, PDF and (later) the website all draw a page through renderPage(),
// so what you see while editing is what prints. Everything is positioned in CSS points.

// ------------------------------------------------------------------ fonts
// Publisher stores weights as separate font names ("Candara Light", "Archer Bold"). Chromium
// matches CSS families by family name, so each captured name also gets an @font-face alias that
// looks it up by its full/PostScript name via local().
const aliased = new Set();
let fontStyleEl = null;

function fontAlias(name) {
  const alias = 'bbx-' + name;
  if (!aliased.has(name)) {
    aliased.add(name);
    if (!fontStyleEl) {
      fontStyleEl = document.createElement('style');
      document.head.appendChild(fontStyleEl);
    }
    const q = (s) => 'local("' + s.replace(/"/g, '') + '")';
    const srcs = [name, name.replace(/\s+/g, ''), name.replace(/\s+/g, '-'), name + ' Regular'].map(q).join(', ');
    fontStyleEl.sheet.insertRule('@font-face { font-family: "' + alias + '"; src: ' + srcs + '; }', fontStyleEl.sheet.cssRules.length);
  }
  return alias;
}

export function cssFont(name) {
  if (!name) return 'serif';
  return '"' + name + '", "' + fontAlias(name) + '", "Palatino Linotype", serif';
}

// Single line spacing = the font's own line height (ascent + descent + gap), measured once per font.
const ratioCache = new Map();
function lineRatio(font) {
  if (ratioCache.has(font)) return ratioCache.get(font);
  const s = document.createElement('span');
  s.textContent = 'Hg';
  s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:100px;line-height:normal;display:inline-block;font-family:' + cssFont(font);
  document.body.appendChild(s);
  const r = s.getBoundingClientRect().height / 100 || 1.2;
  s.remove();
  ratioCache.set(font, r);
  return r;
}

export function missingFonts(names) {
  const probe = 'mmmmmmmmmmlli 1234 WAVE';
  const width = (fam) => {
    const s = document.createElement('span');
    s.textContent = probe;
    s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:72px;font-family:' + fam;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const out = [];
  for (const n of names) {
    const fam = '"' + n + '", "' + fontAlias(n) + '"';
    if (width(fam + ', monospace') === width('monospace') && width(fam + ', serif') === width('serif')) out.push(n);
  }
  return out;
}

// ------------------------------------------------------------------ helpers
const pt = (v) => (Math.round(v * 1000) / 1000) + 'pt';

function el(tag, cls, style) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  return e;
}

export function pageContent(week, n) {
  const entry = week.manifest.pages.find((p) => p.number === n);
  const half = entry && week.halves[entry.half];
  return { half: entry ? entry.half : null, page: (half && half.pages[String(n)]) || { frames: [] } };
}

// ------------------------------------------------------------------ text
function runSpan(run, para) {
  const span = el('span', 'run');
  const size = run.size || (para.mark && para.mark.size) || 11;
  const font = run.font || (para.mark && para.mark.font);
  const s = span.style;
  s.fontFamily = cssFont(font);
  s.fontSize = pt(size);
  if (run.bold) s.fontWeight = '700';
  if (run.italic) s.fontStyle = 'italic';
  const deco = [];
  if (run.underline) deco.push('underline');
  if (run.strike) deco.push('line-through');
  if (deco.length) s.textDecoration = deco.join(' ');
  if (run.smallCaps) s.fontVariant = 'small-caps';
  if (run.allCaps) s.textTransform = 'uppercase';
  if (run.color) s.color = run.color;
  if (run.tracking && run.tracking !== 100) s.letterSpacing = ((run.tracking - 100) / 100) * 0.5 + 'em';
  if (run.superscript || run.subscript) {
    s.verticalAlign = run.superscript ? 'super' : 'sub';
    s.fontSize = pt(size * 0.66);
  }
  span.dataset.size = size;
  span.dataset.font = font || '';
  return span;
}

function lineHeightFor(para, font, size) {
  const ls = para.lineSpacing || {};
  if (ls.exact) return pt(ls.exact);
  return pt(lineRatio(font) * size * (ls.multiple || 1));
}

function extraLeading(para) {
  const m = (para.lineSpacing || {}).multiple;
  if (!m || m <= 1) return 0;
  const mark = para.mark || (para.runs[0] || {});
  const sizes = para.runs.map((r) => r.size || 0).concat(mark.size || 11);
  return (m - 1) * lineRatio(mark.font || 'Palatino Linotype') * Math.max(...sizes);
}

export function paragraphEl(para) {
  const p = el('p', 'para');
  const s = p.style;
  s.textAlign = para.align || 'left';
  if (para.spaceBefore) s.marginTop = pt(para.spaceBefore);
  if (para.spaceAfter) s.marginBottom = pt(para.spaceAfter);
  if (para.indentLeft) s.paddingLeft = pt(para.indentLeft);
  if (para.indentRight) s.paddingRight = pt(para.indentRight);
  if (para.indentFirst) s.textIndent = pt(para.indentFirst);
  const mark = para.mark || (para.runs[0] || {});
  const markFont = mark.font || 'Palatino Linotype';
  const markSize = mark.size || 11;
  // the paragraph's own strut: an empty line is as tall as its paragraph mark
  s.fontFamily = cssFont(markFont);
  s.fontSize = pt(markSize);
  s.lineHeight = lineHeightFor(para, markFont, markSize);
  if (para.tabs) p.dataset.tabs = JSON.stringify(para.tabs);
  if (para.block) p.dataset.block = para.block;              // flow mode: which block this line belongs to
  if (para.justifyLast) s.textAlignLast = 'justify';         // head of a justified paragraph split across pages
  // paragraph settings (everything but the text) ride along so the editor can read them back
  const { runs: _runs, ...props } = para;
  p.dataset.para = JSON.stringify(props);

  let seg = null; // text after a tab lives in a .seg so right/centre tabs can measure it
  const target = () => seg || p;
  for (const run of para.runs) {
    const parts = run.text.replace(/\u000c/g, '').split(/(\t|\n|\u000b)/);
    for (const part of parts) {
      if (part === '') continue;
      if (part === '\t') {
        const tab = el('span', 'tab');
        p.appendChild(tab);
        seg = el('span', 'seg');
        p.appendChild(seg);
        continue;
      }
      if (part === '\n' || part === '\u000b') {
        target().appendChild(document.createElement('br'));
        continue;
      }
      const span = runSpan(run, para);
      span.textContent = part;
      span.style.lineHeight = lineHeightFor(para, span.dataset.font, Number(span.dataset.size));
      target().appendChild(span);
    }
  }
  // an empty line needs real width: a zero-width character would let blank lines tuck in beside
  // a full-width wrapped picture, where Publisher pushes them below it
  if (!p.textContent) p.appendChild(document.createTextNode(' '));
  return p;
}

function textFrame(f, box) {
  const t = f.text;
  const [it, ir, ib, il] = t.inset || [0, 0, 0, 0];
  const area = el('div', 'text-area', {
    left: pt(il), top: pt(it), width: pt(Math.max(0, f.w - il - ir)), height: pt(Math.max(0, f.h - it - ib)),
    justifyContent: { middle: 'center', bottom: 'flex-end' }[t.valign] || 'flex-start',
  });
  area.dataset.wpt = Math.max(0, f.w - il - ir);
  if (t.columns > 1) {
    area.style.display = 'block';
    area.dataset.columns = t.columns;
    area.style.columnCount = t.columns;
    area.style.columnGap = pt(t.columnGap || 0);
    area.style.columnFill = 'auto';
  }
  if (t.chain) box.dataset.story = t.chain.story + '#' + t.chain.index;
  const flow = el('div', 'flow');
  for (const para of t.paragraphs) flow.appendChild(paragraphEl(para));
  area.appendChild(flow);
  box.appendChild(area);
}

// ------------------------------------------------------------------ frames
function frameEl(f, assetBase) {
  const box = el('div', 'frame frame-' + f.kind, {
    left: pt(f.x), top: pt(f.y), width: pt(f.w), height: pt(f.h), zIndex: String(f.z || 0),
  });
  box.dataset.id = f.id;
  if (f.generated) box.dataset.generated = '1';
  if (f.block && f.kind !== 'text') box.dataset.block = f.block;   // flow pictures/rules: their block
  const tf = [];
  if (f.rotation) tf.push('rotate(' + f.rotation + 'deg)');
  if (f.flipH) tf.push('scaleX(-1)');
  if (f.flipV) tf.push('scaleY(-1)');
  if (tf.length) box.style.transform = tf.join(' ');
  if (f.fill && f.kind !== 'shape') {
    box.style.backgroundColor = f.fill.color;
    if (f.fill.opacity != null) box.style.opacity = f.fill.opacity;
  }

  if (f.kind === 'group') {
    // children keep page coordinates, so they are drawn by the page, not inside this box
    box.classList.add('frame-group-box');
    return box;
  }
  if (f.kind === 'image') {
    const im = f.image || {};
    if (!im.asset) {
      box.classList.add('missing');
      box.title = 'Missing picture: ' + (im.missing || '');
      return box;
    }
    const [l, t, r, b] = im.crop || [0, 0, 0, 0];
    const fw = f.w / Math.max(0.0001, 1 - l - r);
    const fh = f.h / Math.max(0.0001, 1 - t - b);
    const img = el('img', null, { left: pt(-l * fw), top: pt(-t * fh), width: pt(fw), height: pt(fh) });
    img.src = new URL(im.asset, assetBase).href;
    img.draggable = false;
    img.style.pointerEvents = 'none';
    box.appendChild(img);
    if (im.matchConfidence === 'low') box.dataset.lowConfidence = '1';
    return box;
  }
  if (f.kind === 'shape') {
    const st = f.stroke || { color: '#000', width: 0.75 };
    if (f.shape && f.shape.type === 'line') {
      const horizontal = f.w >= f.h;
      Object.assign(box.style, horizontal
        ? { height: '0', borderTop: pt(st.width) + ' solid ' + st.color, top: pt(f.y - st.width / 2) }
        : { width: '0', borderLeft: pt(st.width) + ' solid ' + st.color, left: pt(f.x - st.width / 2) });
    } else {
      box.style.border = pt(st.width) + ' solid ' + st.color;
      box.style.boxSizing = 'border-box';
      if (f.fill) box.style.backgroundColor = f.fill.color;
    }
    return box;
  }
  if (f.kind === 'text') {
    if (f.stroke) {
      box.style.border = pt(f.stroke.width) + ' solid ' + f.stroke.color;
      box.style.boxSizing = 'border-box';
    }
    textFrame(f, box);
  }
  return box;
}

function flatten(frames, out = []) {
  for (const f of frames) {
    out.push(f);
    if (f.children) flatten(f.children, out);
  }
  return out;
}

// Text wrap: an object with wrap set, IN FRONT of a text frame and overlapping it, pushes that
// frame's text aside (Publisher's "square" / "top and bottom"). Each obstacle becomes a float at
// the top of the frame's flow, starting at the obstacle's top edge, so lines above the obstacle
// still use the full width.
function applyWrap(textFrame, area, obstacles) {
  const t = textFrame.text;
  if (!t || area.dataset.columns) return;
  const [it, ir, ib, il] = t.inset || [0, 0, 0, 0];
  const ax = textFrame.x + il, ay = textFrame.y + it;
  const aw = textFrame.w - il - ir, ah = textFrame.h - it - ib;
  const flow = area.querySelector('.flow');
  // a line collides only if its TEXT reaches the obstacle: the extra leading of "1.19 sp"-style
  // spacing may overlap it (calibrated on the 9-20-26 back page: LEARN/GIVE/CONNECT headings)
  const slack = Math.max(0, ...t.paragraphs.map(extraLeading));

  // 1. each obstacle in front of this frame -> a band on one side: { side, y0, y1, width, full }
  const bands = { left: [], right: [] };
  for (const o of obstacles) {
    if ((o.z || 0) <= (textFrame.z || 0) || o.id === textFrame.id) continue;
    const [dt, dr, db, dl] = o.wrap.dist || [0, 0, 0, 0];
    const x0 = Math.max(0, o.x - dl - ax), x1 = Math.min(aw, o.x + o.w + dr - ax);
    const y0 = Math.max(0, o.y - dt - ay), y1 = Math.min(ah, o.y + o.h + db - ay);
    if (x1 <= x0 || y1 <= y0) continue;
    const roomLeft = x0, roomRight = aw - x1;
    let side, width;
    if (o.wrap.type === 'topBottom' || (roomLeft < 36 && roomRight < 36)) { side = 'left'; width = aw; }
    else if (roomLeft <= roomRight) { side = 'left'; width = x1; }
    else { side = 'right'; width = aw - x0; }
    bands[side].push({ side, y0: Math.min(y0 + slack, y1), y1, width });
  }
  // 2. overlapping bands on one side merge into one (the wider wins)
  const merged = [];
  for (const side of ['left', 'right']) {
    const list = bands[side].sort((p, q) => p.y0 - q.y0);
    for (const bd of list) {
      const prev = merged.filter((m) => m.side === side).pop();
      if (prev && bd.y0 < prev.y1) { prev.y1 = Math.max(prev.y1, bd.y1); prev.width = Math.max(prev.width, bd.width); }
      else merged.push({ ...bd });
    }
  }
  // 3. emit floats top to bottom. CSS never places a float above an earlier one, so each band gets a
  //    zero-width spacer (sized from wherever that spacer will actually land) and then the real
  //    float, cleared below it. (shape-outside would be simpler, but Chromium then ignores
  //    paragraph indents beside the shape.)
  merged.sort((p, q) => p.y0 - q.y0);
  const sideBottom = { left: 0, right: 0 };
  let maxTop = 0;
  const nodes = [];
  for (const bd of merged) {
    const spacerTop = Math.max(sideBottom[bd.side], maxTop);
    const top = Math.max(bd.y0, spacerTop);
    nodes.push(el('div', 'wrap-float', { float: bd.side, clear: bd.side, width: '0', height: pt(top - spacerTop) }));
    const f = el('div', 'wrap-float', { float: bd.side, clear: bd.side, width: pt(bd.width), height: pt(Math.max(0, bd.y1 - top)) });
    if (bd.width >= aw - 0.5) f.dataset.full = '1';
    nodes.push(f);
    sideBottom[bd.side] = bd.y1;
    maxTop = top;
  }
  for (const n of nodes.reverse()) flow.insertBefore(n, flow.firstChild);
}

export function renderPage(week, n) {
  const { width, height } = week.manifest.page;
  const { half, page } = pageContent(week, n);
  const pg = el('div', 'page', { width: pt(width), height: pt(height) });
  pg.dataset.page = n;
  if (half) pg.dataset.half = half;
  if (page.background) pg.style.backgroundColor = page.background;
  const all = flatten(page.frames).sort((a, b) => (a.z || 0) - (b.z || 0));
  const obstacles = all.filter((f) => f.wrap && f.kind !== 'group');
  for (const f of all) {
    const box = frameEl(f, week.baseUrl);
    if (f.kind === 'text') applyWrap(f, box.querySelector('.text-area'), obstacles);
    pg.appendChild(box);
  }
  return pg;
}

export function renderPasteboard(week) {
  const items = [];
  for (const h of Object.values(week.halves)) items.push(...flatten(h.pasteboard || []));
  if (!items.length) return null;
  const minX = Math.min(...items.map((f) => f.x)), minY = Math.min(...items.map((f) => f.y));
  const maxX = Math.max(...items.map((f) => f.x + f.w)), maxY = Math.max(...items.map((f) => f.y + f.h));
  const board = el('div', 'pasteboard', { width: pt(maxX - minX + 72), height: pt(maxY - minY + 72) });
  for (const f of items) {
    const shifted = { ...f, x: f.x - minX + 36, y: f.y - minY + 36 };
    board.appendChild(frameEl(shifted, week.baseUrl));
  }
  return board;
}

// ------------------------------------------------------------------ layout passes
// Tabs: CSS has no tab stops, so each tab is an inline-block whose width is solved left to right:
// find where the tab starts, take the next stop past it, and size the gap so the following text
// lands left-, centre- or right-aligned on that stop.
export function layoutTabs(root, defaultStop = 36) {
  for (const p of root.querySelectorAll('p.para')) {
    const tabs = p.querySelectorAll(':scope > .tab');
    if (!tabs.length) continue;
    const area = p.closest('.text-area');
    const stops = JSON.parse(p.dataset.tabs || '[]').sort((a, b) => a.pos - b.pos);
    p.querySelectorAll(':scope > br.tab-break').forEach((b) => b.remove());
    tabs.forEach((t) => { t.style.width = '0'; });
    const areaRect = area.getBoundingClientRect();
    const pxPerPt = areaRect.width / Number(area.dataset.wpt || 1);
    if (!pxPerPt) continue;
    const cs = getComputedStyle(p);
    const right = (p.getBoundingClientRect().right - areaRect.left - parseFloat(cs.paddingRight)) / pxPerPt;
    tabs.forEach((tab) => {
      let x = (tab.getBoundingClientRect().left - areaRect.left) / pxPerPt;
      const nextStop = (from) => stops.find((s) => s.pos > from + 0.01);
      // a tab whose stop lies past the right edge starts a new line, then tabs from its start
      const probe = nextStop(x);
      const target = probe ? probe.pos : (Math.floor(x / defaultStop) + 1) * defaultStop;
      if (target > right + 0.5) {
        tab.before(Object.assign(document.createElement('br'), { className: 'tab-break' }));
        x = (tab.getBoundingClientRect().left - areaRect.left) / pxPerPt;
      }
      let stop = nextStop(x);
      if (!stop) {
        const last = stops.length ? stops[stops.length - 1].pos : 0;
        const from = Math.max(x, last);
        stop = { pos: (Math.floor(from / defaultStop) + 1) * defaultStop, align: 'left' };
      }
      const seg = tab.nextElementSibling;
      let segW = 0;
      if (seg && stop.align !== 'left') {
        const r = seg.getClientRects()[0];
        segW = r ? r.width / pxPerPt : 0;
        if (stop.align === 'decimal') {
          const i = seg.textContent.indexOf('.');
          if (i >= 0) segW = segW * (i / Math.max(1, seg.textContent.length));
        }
      }
      let w = stop.pos - x;
      // flow-mode lines get a little slack: on screen at zoom, pixel rounding could push the last word
      // onto a new line. Imported Publisher frames keep exact widths (their breaks must match Publisher's).
      const slack = p.dataset.block ? 0.6 : 0;
      if (stop.align === 'right' || stop.align === 'decimal') w -= segW + slack;
      else if (stop.align === 'center') w -= segW / 2 + slack / 2;
      tab.style.width = pt(Math.max(0, w));
      if (stop.leader) tab.classList.add('leader-' + stop.leader);
    });
  }
}

// Publisher moves a line that collides with a full-width picture down in whole line steps until
// it clears, rather than snapping it to the picture's bottom edge. Extend each full-width float so
// the first line below it lands on that same grid.
export function layoutWraps(root) {
  for (const f of root.querySelectorAll('.wrap-float[data-full]')) {
    const flow = f.parentElement;
    const area = flow.closest('.text-area');
    const pxPerPt = area.getBoundingClientRect().width / Number(area.dataset.wpt || 1);
    if (!pxPerPt) continue;
    const top = f.getBoundingClientRect().top, bottom = f.getBoundingClientRect().bottom;
    const rects = [];
    for (const span of flow.querySelectorAll('p.para')) {
      const rg = document.createRange();
      rg.selectNodeContents(span);
      for (const r of rg.getClientRects()) rects.push({ r, p: span });
    }
    // where the interrupted line would have started: bottom of the last line box above the float
    let p0 = flow.getBoundingClientRect().top;
    for (const { r, p } of rects) {
      if (r.bottom <= top + 0.5) {
        const lh = parseFloat(getComputedStyle(p).lineHeight) || r.height;
        p0 = Math.max(p0, r.top + (r.height - lh) / 2 + lh);
      }
    }
    const after = rects.find(({ r }) => r.top >= bottom - 0.5);
    if (!after) continue;
    const lh = parseFloat(getComputedStyle(after.p).lineHeight);
    if (!lh) continue;
    const steps = Math.ceil((bottom - p0) / lh - 0.001);
    const newBottom = p0 + steps * lh;
    if (newBottom > bottom + 0.5) f.style.height = pt((newBottom - top) / pxPerPt);
  }
}

// Frames whose text doesn't fit. In Phase 1 this is a fidelity check (Publisher fitted them);
// in Phase 2 it becomes the user-facing overflow warning.
export function findOverflow(root) {
  const out = [];
  root.classList.add('measuring'); // switches off the baseline nudge, which adds scroll height
  for (const area of root.querySelectorAll('.text-area')) {
    const fr = area.closest('.frame');
    fr.classList.remove('overflow');
    let over;
    if (area.dataset.columns) {
      over = area.scrollWidth - area.clientWidth; // extra columns spill sideways
    } else {
      // only text that actually falls outside counts; trailing blank lines are harmless
      const limit = area.getBoundingClientRect().bottom;
      let lowest = -Infinity;
      for (const p of area.querySelectorAll('p.para')) {
        if (!p.textContent.replace(/[s ​]/g, '')) continue;
        lowest = Math.max(lowest, p.getBoundingClientRect().bottom);
      }
      over = lowest - limit;
    }
    if (over > 1) {
      fr.classList.add('overflow');
      out.push({ page: Number(area.closest('[data-page]')?.dataset.page), frame: fr.dataset.id, overflowPx: Math.round(over) });
    }
  }
  root.classList.remove('measuring');
  return out;
}

export function fontsUsed(week) {
  const names = new Set();
  const visit = (frames) => {
    for (const f of frames) {
      if (f.text) for (const p of f.text.paragraphs) {
        if (p.mark && p.mark.font) names.add(p.mark.font);
        for (const r of p.runs) if (r.font) names.add(r.font);
      }
      if (f.children) visit(f.children);
    }
  };
  for (const h of Object.values(week.halves)) {
    for (const pg of Object.values(h.pages || {})) visit(pg.frames || []);
    visit(h.pasteboard || []);
  }
  return [...names].sort();
}
