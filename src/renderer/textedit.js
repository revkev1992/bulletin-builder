// Phase 2b: typing inside text frames, and re-flowing a linked story across its frames.
//
// While a frame is being edited its .flow is contentEditable and the browser owns the DOM. When
// editing ends, serializeFlow() reads the text back by COMPUTED style (so whatever spans the
// browser created, bold/italic/font/size come out right) into the format's paragraphs + runs.
// reflowStory() then pours a linked story through its frames, measuring with the real renderer.

import { paragraphEl, layoutTabs, layoutWraps, cssFont } from './render.js';

// ------------------------------------------------------------------ DOM -> model
function hex(rgb) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  if (!m) return null;
  return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function familyOf(cssFamily) {
  const first = (cssFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  return first.startsWith('bbx-') ? first.slice(4) : first;
}

function decorated(node, stop, line) {
  for (let e = node; e && e !== stop; e = e.parentElement) {
    if ((getComputedStyle(e).textDecorationLine || '').includes(line)) return true;
  }
  return false;
}

function runPropsOf(e, para) {
  const cs = getComputedStyle(e);
  const px = parseFloat(cs.fontSize);
  const shifted = cs.verticalAlign === 'super' || cs.verticalAlign === 'sub';
  let size = px * 0.75;
  if (shifted) size = size / 0.66;
  const r = { font: familyOf(cs.fontFamily), size: Math.round(size * 10) / 10 };
  if (parseInt(cs.fontWeight, 10) >= 600) r.bold = true;
  if (cs.fontStyle === 'italic') r.italic = true;
  if (decorated(e, para, 'underline')) r.underline = true;
  if (decorated(e, para, 'line-through')) r.strike = true;
  if (cs.fontVariantCaps === 'small-caps') r.smallCaps = true;
  if (cs.textTransform === 'uppercase') r.allCaps = true;
  if (cs.verticalAlign === 'super') r.superscript = true;
  if (cs.verticalAlign === 'sub') r.subscript = true;
  const c = hex(cs.color);
  if (c && c !== '#000000') r.color = c;
  const ls = parseFloat(cs.letterSpacing);
  if (ls && px) r.tracking = Math.round(((ls / px) / 0.5) * 100 + 100);
  return r;
}

const sameProps = (a, b) => {
  const ka = Object.keys(a).filter((k) => k !== 'text'), kb = Object.keys(b).filter((k) => k !== 'text');
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

function readParagraph(p, base) {
  const runs = [];
  const push = (text, props) => {
    text = text && text.replace(/​/g, '');   // caret anchors from editing, never saved
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && sameProps(last, props)) last.text += text;
    else runs.push({ text, ...props });
  };
  const nodes = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) nodes.push(c);
      else if (c.nodeType === 1) {
        if (c.classList.contains('tab')) nodes.push({ tab: c });
        else if (c.tagName === 'BR') { if (!c.classList.contains('tab-break')) nodes.push({ br: c }); }
        else walk(c);
      }
    }
  };
  walk(p);
  // The browser keeps a placeholder <br> in an empty line: a lone <br>, or the second of two at the
  // end (Shift+Enter at the end of a line). A single <br> after text is a real line break — reflow
  // can cut a paragraph right after one.
  const n = nodes.length;
  if (n && nodes[n - 1].br && (n === 1 || nodes[n - 2].br)) nodes.pop();
  let lastProps = null;
  for (const n of nodes) {
    if (n.tab || n.br) {
      const props = lastProps || runPropsOf(n.tab || n.br.parentElement, p);
      push(n.tab ? '\t' : '\n', props);
      continue;
    }
    const props = runPropsOf(n.parentElement, p);
    lastProps = props;
    push(n.data.replace(/​/g, ''), props);
  }
  if (runs.length === 1 && runs[0].text === ' ') runs.length = 0; // empty line placeholder
  const para = { ...base, runs };
  if (p.style.textAlign) para.align = p.style.textAlign;
  const last = runs[runs.length - 1];
  if (!para.mark && last) para.mark = { font: last.font, size: last.size };
  return para;
}

export function serializeFlow(flow) {
  const out = [];
  let base = {};
  for (const c of flow.childNodes) {
    if (c.nodeType === 1 && c.classList.contains('wrap-float')) continue;
    if (c.nodeType === 3) {
      if (c.data.trim()) out.push({ ...base, runs: [{ text: c.data, font: 'Palatino Linotype', size: 11 }] });
      continue;
    }
    if (c.nodeType !== 1) continue;
    try { base = JSON.parse(c.dataset.para || 'null') || base; } catch (_) { /* keep previous */ }
    out.push(readParagraph(c, base));
  }
  // "continues" only means something on the last paragraph of a frame
  out.forEach((p, i) => { if (i < out.length - 1) delete p.continues; });
  return out;
}

// ------------------------------------------------------------------ formatting commands
export function formatSelection(cmd, value, flow) {
  document.execCommand('styleWithCSS', false, true);
  switch (cmd) {
    case 'bold': case 'italic': case 'underline':
      document.execCommand(cmd);
      break;
    case 'font':
      document.execCommand('fontName', false, value);
      break;
    case 'size': {
      // execCommand only knows sizes 1-7; mark the selection with 7, then rewrite it in points
      document.execCommand('fontSize', false, '7');
      for (const e of flow.querySelectorAll('[style*="xxx-large"], font[size="7"]')) {
        e.style.fontSize = value + 'pt';
        e.removeAttribute('size');
      }
      break;
    }
    case 'grow': case 'shrink':
      styleSelection(flow, (e, cs) => { e.style.fontSize = stepSize(ptOf(cs), cmd === 'grow' ? 1 : -1) * (shiftedCs(cs) ? 0.66 : 1) + 'pt'; });
      break;
    case 'superscript': case 'subscript': {
      const want = cmd === 'superscript' ? 'super' : 'sub';
      styleSelection(flow, (e, cs) => {
        const size = ptOf(cs);
        if (cs.verticalAlign === want) { e.style.verticalAlign = 'baseline'; e.style.fontSize = size + 'pt'; }
        else { e.style.verticalAlign = want; e.style.fontSize = (size * 0.66) + 'pt'; }
      });
      break;
    }
    case 'color':
      styleSelection(flow, (e) => { e.style.color = value; });
      break;
    case 'tracking':
      styleSelection(flow, (e) => { e.style.letterSpacing = ((Number(value) - 100) / 100) * 0.5 + 'em'; });
      break;
    case 'clear': {
      // back to the paragraph's own font and size, plain (Publisher's Clear All Formatting)
      const ps = selectedParas(flow);
      let mark = {};
      try { mark = (JSON.parse((ps[0] && ps[0].dataset.para) || '{}').mark) || {}; } catch (_) { /* default */ }
      styleSelection(flow, (e) => {
        e.style.fontFamily = cssFont(mark.font || 'Palatino Linotype');
        e.style.fontSize = (mark.size || 11) + 'pt';
        Object.assign(e.style, { fontWeight: '400', fontStyle: 'normal', textDecoration: 'none', letterSpacing: 'normal',
          verticalAlign: 'baseline', color: '#000000', fontVariant: 'normal', textTransform: 'none' });
        // formatting nested inside the selection goes too: inner spans inherit the reset above
        for (const d of [...e.querySelectorAll('*')]) {
          if (d.classList.contains('tab') || d.tagName === 'BR') continue;
          if (/^(SUP|SUB|B|STRONG|I|EM|U|S|STRIKE|FONT)$/.test(d.tagName)) d.replaceWith(...d.childNodes);
          else d.removeAttribute('style');
        }
      });
      break;
    }
    case 'case':
      changeCase(flow, value);
      break;
    case 'indent': case 'outdent':
      rebuildParas(flow, selectedParas(flow), (p) => {
        const left = Math.max(0, (p.indentLeft || 0) + (cmd === 'indent' ? HANG : -HANG));
        const q = { ...p, indentLeft: left };
        if (q.tabs && q.indentFirst < 0) q.tabs = [{ pos: left, align: 'left' }];
        return q;
      });
      break;
    case 'retab': {     // a Tab was just typed: lay the paragraph out again so it lands on its stop now
      rebuildParas(flow, selectedParas(flow), (p) => p);
      // the caret belongs just after the new tab; a zero-width tab lets Chrome snap it back into the
      // word before, so give the text after the tab a zero-width anchor (dropped when saved)
      const o = selectionOffsets(flow);
      if (!o) break;
      let total = 0;
      for (const a of atoms(flow)) {
        total += a.len;
        if (!a.tab || total !== o.start) continue;
        const seg = a.node.nextElementSibling && a.node.nextElementSibling.classList.contains('seg') ? a.node.nextElementSibling : null;
        if (!seg) break;
        const first = document.createTreeWalker(seg, NodeFilter.SHOW_TEXT).nextNode();
        const z = document.createTextNode('​');
        if (first) first.parentNode.insertBefore(z, first); else seg.appendChild(z);
        const r = document.createRange();
        r.setStart(z, 1); r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        break;
      }
      break;
    }
    case 'tabs':        // the ruler / Tabs dialog: the selected paragraphs get exactly these stops
      rebuildParas(flow, selectedParas(flow), (p) => {
        const q = { ...p };
        if (value && value.length) q.tabs = value.map((s) => ({ ...s })).sort((a, b) => a.pos - b.pos); else delete q.tabs;
        return q;
      });
      break;
    case 'lineSpacing':
      rebuildParas(flow, selectedParas(flow), (p) => ({ ...p, lineSpacing: { multiple: Number(value) } }));
      break;
    case 'paragraph':   // Paragraph dialog: { indentLeft, indentFirst, indentRight, spaceBefore, spaceAfter, lineSpacing }
      rebuildParas(flow, selectedParas(flow), (p) => {
        const q = { ...p };
        for (const k of ['indentLeft', 'indentFirst', 'indentRight', 'spaceBefore', 'spaceAfter']) {
          if (value[k] == null || Number.isNaN(value[k])) continue;
          if (value[k]) q[k] = value[k]; else delete q[k];
        }
        if (value.lineSpacing) q.lineSpacing = { multiple: value.lineSpacing };
        return q;
      });
      break;
    case 'bullets': {
      const ps = selectedParas(flow);
      const allOn = ps.length && ps.every((p) => p.textContent.startsWith('\u2022'));
      rebuildParas(flow, ps, (p) => setList(p, allOn ? null : BULLET));
      break;
    }
    case 'numbering': {
      const ps = selectedParas(flow);
      const allOn = ps.length && ps.every((p) => /^\d+\./.test(p.textContent));
      rebuildParas(flow, ps, (p, i) => setList(p, allOn ? null : (i + 1) + '.\t'));
      break;
    }
    case 'align': {
      const sel = window.getSelection();
      for (const p of flow.querySelectorAll('p')) {
        if (sel.rangeCount && sel.getRangeAt(0).intersectsNode(p)) p.style.textAlign = value;
      }
      break;
    }
  }
}

// ---- Publisher Home > Font extras. Each wraps the selection in marker spans (a unique highlight
// colour), then restyles exactly those spans, so fonts/sizes already in the text are kept.
const MARK = 'rgb(1, 2, 3)';
function styleSelection(flow, fn) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return false;
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('hiliteColor', false, MARK);
  const marked = [...flow.querySelectorAll('span, font')].filter((e) => e.style.backgroundColor === MARK);
  for (const e of marked) { e.style.backgroundColor = ''; fn(e, getComputedStyle(e)); }
  return marked.length > 0;
}
const SIZES = [6, 7, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72, 96, 144];
const shiftedCs = (cs) => cs.verticalAlign === 'super' || cs.verticalAlign === 'sub';
const ptOf = (cs) => { const v = parseFloat(cs.fontSize) * 0.75; return shiftedCs(cs) ? v / 0.66 : v; };
export function stepSize(size, dir) {
  const r = Math.round(size * 2) / 2;
  if (dir > 0) return SIZES.find((x) => x > r + 0.01) ?? Math.min(1638, r + 12);
  return [...SIZES].reverse().find((x) => x < r - 0.01) ?? Math.max(1, r - 1);
}
const CASES = {
  lower: (t) => t.toLowerCase(),
  upper: (t) => t.toUpperCase(),
  title: (t) => t.toLowerCase().replace(/(^|[\s\-"\u201c(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  sentence: (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  toggle: (t) => [...t].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''),
};
function changeCase(flow, how) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const r = sel.getRangeAt(0);
  const fn = CASES[how];
  // transform the selected text as ONE string (so word/sentence boundaries across runs are seen),
  // then write each piece back into its own text node: formatting is kept
  const pieces = [];
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!r.intersectsNode(n)) continue;
    const a = n === r.startContainer ? r.startOffset : 0;
    const b = n === r.endContainer ? r.endOffset : n.data.length;
    if (b > a) pieces.push({ n, a, b });
  }
  const whole = fn(pieces.map((x) => x.n.data.slice(x.a, x.b)).join(''));
  let k = 0;
  for (const x of pieces) {
    const len = x.b - x.a;
    x.n.data = x.n.data.slice(0, x.a) + whole.slice(k, k + len) + x.n.data.slice(x.b);
    k += len;
  }
  // keep the text selected, as Publisher does (setting .data collapses the selection)
  if (pieces.length) {
    const nr = document.createRange();
    nr.setStart(pieces[0].n, pieces[0].a);
    nr.setEnd(pieces[pieces.length - 1].n, pieces[pieces.length - 1].b);
    sel.removeAllRanges();
    sel.addRange(nr);
  }
}

// Selection inside a flow as character offsets (survives a re-render of the frame). A tab counts as
// ONE character whether it is a raw "	" (just typed) or a laid-out .tab span (rendered), and text
// inside a .tab span is ignored — so offsets taken before a paragraph is rebuilt still fit after.
function atoms(root) {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out.push({ node: c, len: c.data.length });
      else if (c.nodeType === 1) { if (c.classList.contains('tab')) out.push({ node: c, len: 1, tab: true }); else walk(c); }
    }
  };
  walk(root);
  return out;
}
export const atomLength = (el) => atoms(el).reduce((a, x) => a + x.len, 0);
function offsetOf(flow, node, off) {
  const list = atoms(flow);
  let total = 0;
  if (node.nodeType === 3) {
    for (const a of list) { if (a.node === node) return total + off; total += a.len; }
    return total;
  }
  // a boundary between child nodes: count everything before child[off]
  const stop = node.childNodes[off] || null;
  for (const a of list) {
    if (stop && (a.node === stop || (stop.contains && stop.contains(a.node)))) return total;
    if (!stop && !node.contains(a.node) && total > 0 && node.compareDocumentPosition(a.node) & Node.DOCUMENT_POSITION_FOLLOWING) return total;
    total += a.len;
  }
  return total;
}
export function selectionOffsets(flow) {
  const s = window.getSelection();
  if (!flow || !s.rangeCount || !flow.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  return { start: offsetOf(flow, r.startContainer, r.startOffset), end: offsetOf(flow, r.endContainer, r.endOffset) };
}
function pointAt(flow, k) {
  const list = atoms(flow);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.tab) {
      if (k === 0) return [a.node.parentNode, [...a.node.parentNode.childNodes].indexOf(a.node)];
      k -= 1;
      if (k === 0 && !(list[i + 1] && !list[i + 1].tab)) return [a.node.parentNode, [...a.node.parentNode.childNodes].indexOf(a.node) + 1];
      continue;
    }
    if (k <= a.len) return [a.node, k];
    k -= a.len;
  }
  const last = list[list.length - 1];
  return last ? (last.tab ? [last.node.parentNode, [...last.node.parentNode.childNodes].indexOf(last.node) + 1] : [last.node, last.len]) : [flow, 0];
}
export function restoreOffsets(flow, o) {
  if (!flow || !o) return;
  const r = document.createRange();
  r.setStart(...pointAt(flow, o.start));
  r.setEnd(...pointAt(flow, o.end));
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

// ---- Publisher Home > Paragraph. A paragraph's settings ride in data-para; each command rebuilds
// the selected paragraphs from their current text (readParagraph) with the new settings.
function selectedParas(flow) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  const ps = [...flow.children].filter((c) => c.tagName === 'P');
  const hit = ps.filter((p) => r.intersectsNode(p));
  if (hit.length) return hit;
  const at = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const p = at && at.closest('p');
  return p ? [p] : [];
}
const BULLET = '\u2022\t';
const NUM = /^(\d+)\.\t/;
const HANG = 18;
const leadingText = (para) => para.runs.map((x) => x.text).join('');
function stripMarker(para, re) {
  const runs = para.runs.map((x) => ({ ...x }));
  let cut = (leadingText(para).match(re) || [''])[0].length;
  for (const x of runs) { const t = Math.min(cut, x.text.length); x.text = x.text.slice(t); cut -= t; if (!cut) break; }
  return { ...para, runs: runs.filter((x) => x.text.length) };
}
function setList(para, marker) {
  let p = para;
  const had = leadingText(p).startsWith(BULLET) || NUM.test(leadingText(p));
  if (leadingText(p).startsWith(BULLET)) p = stripMarker(p, /^\u2022\t/);
  if (NUM.test(leadingText(p))) p = stripMarker(p, NUM);
  if (!marker) {
    // back to a plain paragraph: undo the hanging indent the list added
    if (had) { p = { ...p }; p.indentLeft = Math.max(0, (p.indentLeft || 0) - HANG); delete p.indentFirst; delete p.tabs; }
    return p;
  }
  const first = p.runs[0] || { text: '', font: (p.mark || {}).font, size: (p.mark || {}).size };
  const runs = [{ ...first, text: marker }, ...p.runs];
  const left = had ? (p.indentLeft || 0) : (p.indentLeft || 0) + HANG;
  return { ...p, runs, indentLeft: left, indentFirst: -HANG, tabs: [{ pos: left, align: 'left' }] };
}
function rebuildParas(flow, ps, fn) {
  // keep exactly what was selected (Publisher does): character offsets, shifted by any list marker
  // added/removed in front of it
  const where = selectionOffsets(flow);
  const lenBefore = ps.map((p) => atomLength(p));
  const els = ps.map((p, i) => {
    let props = {};
    try { props = JSON.parse(p.dataset.para || '{}'); } catch (_) { /* keep defaults */ }
    const el = paragraphEl(fn(readParagraph(p, props), i, ps.length));
    p.replaceWith(el);
    return el;
  });
  layoutTabs(flow.closest('.frame') || flow, 36);
  if (where && els.length) {
    const d0 = atomLength(els[0]) - lenBefore[0];
    const dAll = els.reduce((a, el, i) => a + atomLength(el) - lenBefore[i], 0);
    restoreOffsets(flow, { start: Math.max(0, where.start + d0), end: Math.max(0, where.end + dAll) });
    return true;
  }
  if (els.length) {
    const r = document.createRange();
    r.setStart(els[0], 0);
    r.setEnd(els[els.length - 1], els[els.length - 1].childNodes.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  return els.length > 0;
}
export function paragraphSettings(flow) {
  const p = selectedParas(flow)[0];
  if (!p) return null;
  try { return JSON.parse(p.dataset.para || '{}'); } catch (_) { return {}; }
}

export function pastePlain(e) {
  e.preventDefault();
  const text = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n');
  text.split('\n').forEach((line, i) => {
    if (i) document.execCommand('insertParagraph');
    if (line) document.execCommand('insertText', false, line);
  });
}

// ------------------------------------------------------------------ reflow
const textLen = (p) => p.runs.reduce((n, r) => n + r.text.length, 0);

export function splitParagraph(p, k) {
  const head = { ...p, runs: [], continues: true };
  const tail = { ...p, runs: [] };
  delete tail.continues;
  delete tail.spaceBefore;   // the continuation is not a new paragraph
  delete tail.indentFirst;
  let left = k;
  for (const r of p.runs) {
    if (left >= r.text.length) { head.runs.push({ ...r }); left -= r.text.length; continue; }
    if (left > 0) head.runs.push({ ...r, text: r.text.slice(0, left) });
    tail.runs.push({ ...r, text: r.text.slice(Math.max(0, left)) });
    left = 0;
  }
  if (p.continues) tail.continues = true;
  return [head, tail];
}

export function joinStory(frames) {
  const out = [];
  for (const f of frames) {
    for (const p of f.text.paragraphs) {
      const prev = out[out.length - 1];
      if (prev && prev.continues) {
        prev.runs.push(...p.runs.map((r) => ({ ...r })));
        if (p.continues) prev.continues = true; else delete prev.continues;
        if (p.runs.length) prev.mark = p.mark || prev.mark;
      } else {
        out.push(structuredClone(p));
      }
    }
  }
  if (out.length) delete out[out.length - 1].continues;
  return out;
}

const hasBreak = (p) => p.runs.some((r) => r.text.includes('\u000c'));

// Pour `paras` into one frame's text area. Returns { taken, rest }.
function fitInto(area, paras, defaultTab) {
  const flow = area.querySelector('.flow');
  for (const c of [...flow.children]) if (!c.classList.contains('wrap-float')) c.remove();
  const root = area.closest('.frame') || area;
  root.classList.add('measuring');
  const limit = () => area.getBoundingClientRect().bottom + 0.5;
  const fits = () => {
    layoutTabs(root, defaultTab);
    layoutWraps(root);
    layoutTabs(root, defaultTab);
    const last = flow.lastElementChild;
    return !last || last.classList.contains('wrap-float') || last.getBoundingClientRect().bottom <= limit();
  };
  const taken = [];
  let i = 0;
  for (; i < paras.length; i++) {
    const el = paragraphEl(paras[i]);
    flow.appendChild(el);
    if (fits()) {
      taken.push(paras[i]);
      if (hasBreak(paras[i])) { i++; break; }
      continue;
    }
    // doesn't fit whole: find the longest head that does, cut at a space
    el.remove();
    const n = textLen(paras[i]);
    const text = paras[i].runs.map((r) => r.text).join('');
    const cuts = [];
    for (let k = 1; k < n; k++) if (text[k - 1] === ' ' || text[k - 1] === '\n') cuts.push(k);
    let lo = 0, hi = cuts.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [head] = splitParagraph(paras[i], cuts[mid]);
      const probe = paragraphEl(head);
      flow.appendChild(probe);
      const ok = fits();
      probe.remove();
      if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best >= 0) {
      const [head, tail] = splitParagraph(paras[i], cuts[best]);
      taken.push(head);
      root.classList.remove('measuring');
      return { taken, rest: [tail, ...paras.slice(i + 1)] };
    }
    break;
  }
  root.classList.remove('measuring');
  return { taken, rest: paras.slice(i) };
}

// frames: [{ n, frame }] in chain order (the frames ARE the model objects; they are updated)
export function reflowStory(frames, areaOf, defaultTab = 36) {
  let rest = joinStory(frames.map((x) => x.frame));
  frames.forEach((x, k) => {
    if (k === frames.length - 1) { x.frame.text.paragraphs = rest; rest = []; return; }
    const area = areaOf(x);
    if (!area) { x.frame.text.paragraphs = []; return; }
    const r = fitInto(area, rest, defaultTab);
    x.frame.text.paragraphs = r.taken;
    rest = r.rest;
  });
}

// Canonical form for deciding whether an edit changed anything: key order, float noise, Publisher's
// kerning threshold (not shown, not readable back) and the formatting of a bare line break or tab
// don't count as changes.
export function canon(paras) {
  const clean = paras.map((p) => {
    const runs = [];
    const pieces = [];
    for (const r of p.runs) {
      const { kerning: _k, ...props } = r;
      for (const t of r.text.split(/([\n\t]+)/)) if (t) pieces.push({ ...props, text: t });
    }
    for (const rest of pieces) {
      const ctl = /^[\n\t]+$/.test(rest.text);
      const prev = runs[runs.length - 1];
      if (ctl && prev) { prev.text += rest.text; continue; }
      if (prev && prev._ctlOnly) { rest.text = prev.text + rest.text; runs.pop(); }
      runs.push(ctl ? { text: rest.text, _ctlOnly: true } : rest);
    }
    const merged = [];
    for (const r of runs) {
      const { _ctlOnly, ...x } = r;
      const prev = merged[merged.length - 1];
      const same = prev && JSON.stringify({ ...prev, text: 0 }) === JSON.stringify({ ...x, text: 0 });
      if (same) prev.text += x.text; else merged.push(x);
    }
    return { ...p, runs: merged };
  });
  return JSON.stringify(clean, (k, v) => {
    if (typeof v === 'number') return Math.round(v * 10) / 10;
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]));
    return v;
  });
}
