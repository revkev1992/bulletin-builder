// Publisher's Home ▸ Styles: the week's named paragraph styles (imported from Publisher, plus any
// made here with New Style…). Click a style to apply it to the paragraph(s) you are typing in;
// "New Style…" saves the formatting of the paragraph you are in under a name. Styles live in the
// week file (manifest.styles); Publisher's own entries are kept exactly as imported.

const ALIGN = { 0: 'left', 1: 'center', 2: 'right', 3: 'justify', 4: 'justify', 5: 'justify', 6: 'justify', 7: 'justify' };
const on = (v) => v === true || v === -1 || v === 1;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// one style as { name, run: {font,size,bold,…}, para: {align,spaceBefore,…} } — from either form
export function normStyle(s) {
  if (s.run || s.para) return { name: s.name, run: { ...(s.run || {}) }, para: { ...(s.para || {}) } };
  const f = s.font || {}, p = s.paragraph || {};
  const run = {};
  if (f.Name) run.font = f.Name;
  if (f.Size) run.size = Math.round(f.Size * 100) / 100;
  for (const [k, d] of [['Bold', 'bold'], ['Italic', 'italic'], ['SmallCaps', 'smallCaps'], ['AllCaps', 'allCaps'], ['StrikeThrough', 'strike']]) if (on(f[k])) run[d] = true;
  if (f.Underline) run.underline = true;
  const col = f.Color && f.Color.hex;
  if (col && col !== '#000000') run.color = col;
  if (f.Tracking && f.Tracking !== 100) run.tracking = f.Tracking;
  const para = { align: ALIGN[p.Alignment] || 'left' };
  if (p.LineSpacingRule === 4) para.lineSpacing = { exact: p.LineSpacing };
  else if ((p.LineSpacingRule === 0 || p.LineSpacingRule === 5) && p.LineSpacing && p.LineSpacing !== 1) para.lineSpacing = { multiple: Math.round(p.LineSpacing * 1000) / 1000 };
  else if (p.LineSpacingRule === 1) para.lineSpacing = { multiple: 1.5 };
  else if (p.LineSpacingRule === 2) para.lineSpacing = { multiple: 2 };
  for (const [k, d] of [['SpaceBefore', 'spaceBefore'], ['SpaceAfter', 'spaceAfter'], ['LeftIndent', 'indentLeft'], ['RightIndent', 'indentRight'], ['FirstLineIndent', 'indentFirst']]) if (p[k]) para[d] = p[k];
  if (on(p.KeepWithNext)) para.keepWithNext = true;
  return { name: s.name, run, para };
}

// a paragraph (model form) with a style applied: the style's paragraph settings + character
// formatting replace what was there (Publisher's "apply style"); tabs are kept
export function applyStyleToPara(p, st) {
  const q = { ...p, style: st.name };
  for (const k of ['align', 'spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'indentFirst', 'lineSpacing', 'keepWithNext']) {
    if (st.para[k] != null && st.para[k] !== 0) q[k] = st.para[k]; else delete q[k];
  }
  if (!q.align) q.align = 'left';
  const runProps = (r) => {
    const o = { text: r.text };
    for (const [k, v] of Object.entries(st.run)) o[k] = v;
    return o;
  };
  q.runs = p.runs.map(runProps);
  q.mark = { font: st.run.font || (p.mark || {}).font, size: st.run.size || (p.mark || {}).size };
  return q;
}

// a style from the paragraph you are in (New Style…)
export function styleFromPara(name, p) {
  const r = p.runs.find((x) => x.text.trim()) || p.runs[0] || p.mark || {};
  const run = {};
  for (const k of ['font', 'size', 'bold', 'italic', 'underline', 'smallCaps', 'allCaps', 'strike', 'color', 'tracking']) if (r[k] != null && r[k] !== false) run[k] = r[k];
  const para = {};
  for (const k of ['align', 'spaceBefore', 'spaceAfter', 'indentLeft', 'indentRight', 'indentFirst', 'lineSpacing', 'keepWithNext']) if (p[k] != null && p[k] !== 0 && p[k] !== false) para[k] = p[k];
  return { name, run, para };
}

// the gallery menu's contents (rebuilt each time it opens)
export function galleryHtml(styles, current) {
  const item = (s) => {
    const st = normStyle(s);
    const css = ['font-family:"' + esc(st.run.font || 'Palatino Linotype') + '"', 'font-size:' + Math.min(18, Math.max(9, st.run.size || 11)) + 'pt',
      st.run.bold ? 'font-weight:700' : '', st.run.italic ? 'font-style:italic' : '', st.run.color ? 'color:' + st.run.color : ''].filter(Boolean).join(';');
    return '<button type="button" class="sg-item' + (s.name === current ? ' current' : '') + '" data-style="' + esc(s.name) + '" style=\'' + css + '\'>' + esc(s.name) + '</button>';
  };
  return '<div class="sg-list">' + styles.map(item).join('') + '</div><div class="ctx-sep"></div>' +
    '<button type="button" class="sg-cmd" id="sg-new">New Style…</button>';
}
