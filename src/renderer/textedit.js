// Phase 2b: typing inside text frames, and re-flowing a linked story across its frames.
//
// While a frame is being edited its .flow is contentEditable and the browser owns the DOM. When
// editing ends, serializeFlow() reads the text back by COMPUTED style (so whatever spans the
// browser created, bold/italic/font/size come out right) into the format's paragraphs + runs.
// reflowStory() then pours a linked story through its frames, measuring with the real renderer.

import { paragraphEl, layoutTabs, layoutWraps } from './render.js';

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
    case 'align': {
      const sel = window.getSelection();
      for (const p of flow.querySelectorAll('p')) {
        if (sel.rangeCount && sel.getRangeAt(0).intersectsNode(p)) p.style.textAlign = value;
      }
      break;
    }
  }
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
