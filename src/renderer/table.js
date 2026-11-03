// Insert ▸ Table (Publisher): a frame of kind 'table' — rows × columns of cells, each cell its own
// text (paragraphs, like a text box), with borders and a cell fill. The table's box is its width;
// rows grow with their text, so the frame's height follows the content (the editor stores the
// measured height after every edit). Drawn as a real <table> by render.js (tableEl) so the PDF and
// the website get a table too.
//
//   { kind: 'table', x, y, w, h, z, rows, cols, colWidths: [pt], rowHeights: [pt] (minimum),
//     border: { color, width } | null, inset: pt,
//     cells: [ [ { paragraphs: [para…], fill?: '#RRGGBB' }, … ], … ] }
const r2 = (v) => Math.round(v * 100) / 100;
const FONT = 'Palatino Linotype', SIZE = 10;

export const emptyPara = (text = '', font = FONT) => ({ style: 'Normal', align: 'left', mark: { font, size: SIZE }, runs: text ? [{ text, font, size: SIZE }] : [] });
export const emptyCell = () => ({ paragraphs: [emptyPara()] });

// font: the week's body font (Page Design ▸ Fonts) for the new cells
export function newTable(id, { x, y, w, rows = 3, cols = 3, z = 1, font = FONT } = {}) {
  const cw = r2(w / cols);
  return { id, kind: 'table', x: r2(x), y: r2(y), w: r2(cw * cols), h: rows * 20, z, rows, cols,
    colWidths: Array.from({ length: cols }, () => cw), rowHeights: Array.from({ length: rows }, () => 20),
    border: { color: '#000000', width: 0.75 }, inset: 2.88,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ paragraphs: [emptyPara('', font)] }))) };
}

// Merged cells (Table Format ▸ Merge / Split): the top-left cell of a merge is the ANCHOR and carries
// `span: [rows, cols]`; the cells it covers carry `covered: true` (kept in the grid so rows and
// columns stay rectangular; not drawn). anchorOf(t, r, c) finds the anchor a covered cell belongs to.
const spanOf = (cell) => (cell && cell.span) || [1, 1];
export function anchorOf(t, r, c) {
  if (!t.cells[r] || !t.cells[r][c]) return null;
  if (!t.cells[r][c].covered) return [r, c];
  for (let rr = r; rr >= 0; rr--) for (let cc = c; cc >= 0; cc--) {
    const cl = t.cells[rr][cc];
    if (cl.covered) continue;
    const [rs, cs] = spanOf(cl);
    if (rr + rs > r && cc + cs > c) return [rr, cc];
  }
  return [r, c];
}
// the rectangle (r0, c0, r1, c1 inclusive) grown until it cuts through no merge
function wholeRect(t, r0, c0, r1, c1) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const a = anchorOf(t, r, c);
      if (!a) continue;
      const [ar, ac] = a; const [rs, cs] = spanOf(t.cells[ar][ac]);
      const nr0 = Math.min(r0, ar), nc0 = Math.min(c0, ac), nr1 = Math.max(r1, ar + rs - 1), nc1 = Math.max(c1, ac + cs - 1);
      if (nr0 !== r0 || nc0 !== c0 || nr1 !== r1 || nc1 !== c1) { r0 = nr0; c0 = nc0; r1 = nr1; c1 = nc1; changed = true; }
    }
  }
  return [r0, c0, r1, c1];
}
const hasText = (cell) => (cell.paragraphs || []).some((p) => (p.runs || []).some((x) => x.text) || p.picture);

// merge the cells from (r0,c0) to (r1,c1): one cell, the text of the others carried into it in reading
// order (as Publisher does); null when nothing to merge
export function mergeCells(t, r0, c0, r1, c1) {
  const c = structuredClone(t);
  [r0, c0, r1, c1] = wholeRect(c, Math.min(r0, r1), Math.min(c0, c1), Math.max(r0, r1), Math.max(c0, c1));
  r1 = Math.min(r1, c.rows - 1); c1 = Math.min(c1, c.cols - 1);
  if (r0 === r1 && c0 === c1) return null;
  const anchor = c.cells[r0][c0];
  const paras = [];
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    const cl = c.cells[r][cc];
    if (cl.covered) continue;
    if (hasText(cl)) paras.push(...cl.paragraphs);
    if (r !== r0 || cc !== c0) c.cells[r][cc] = { ...emptyCell(), covered: true };
  }
  anchor.paragraphs = paras.length ? paras : [emptyPara()];
  delete anchor.covered;
  anchor.span = [r1 - r0 + 1, c1 - c0 + 1];
  return c;
}
// split a merged cell back into its cells (the text stays in the top-left one); null when not merged
export function splitCell(t, r, cc) {
  const a = anchorOf(t, r, cc);
  if (!a) return null;
  const [ar, ac] = a;
  const [rs, cs] = spanOf(t.cells[ar][ac]);
  if (rs === 1 && cs === 1) return null;
  const c = structuredClone(t);
  for (let rr = ar; rr < ar + rs; rr++) for (let k = ac; k < ac + cs; k++) if (rr !== ar || k !== ac) c.cells[rr][k] = emptyCell();
  delete c.cells[ar][ac].span;
  return c;
}

// row / column operations (pure: return a changed copy). Merges are kept whole: a row inserted inside
// a merge extends it; deleting a merge's first row moves its anchor down (text kept)
export function insertRow(t, at) {
  const c = structuredClone(t);
  const i = Math.max(0, Math.min(c.rows, at));
  const row = Array.from({ length: c.cols }, emptyCell);
  for (let r = 0; r < i; r++) for (let k = 0; k < c.cols; k++) {
    const cl = c.cells[r][k];
    if (cl.covered) continue;
    const [rs, cs] = spanOf(cl);
    if (rs > 1 && r + rs > i) { cl.span = [rs + 1, cs]; for (let kk = k; kk < k + cs; kk++) row[kk] = { ...emptyCell(), covered: true }; }
  }
  c.cells.splice(i, 0, row);
  c.rowHeights.splice(i, 0, c.rowHeights[Math.min(i, c.rowHeights.length - 1)] || 20);
  c.rows++;
  return c;
}
export function deleteRow(t, at) {
  if (t.rows <= 1) return null;
  const c = structuredClone(t);
  for (let k = 0; k < c.cols; k++) {
    const cl = c.cells[at][k];
    if (cl.covered) {                                    // a merge from above passes through this row
      const [ar, ac] = anchorOf(c, at, k);
      if (ar !== at && ac === k) { const [rs, cs] = spanOf(c.cells[ar][ac]); c.cells[ar][ac].span = rs - 1 > 1 || cs > 1 ? [rs - 1, cs] : undefined; if (!c.cells[ar][ac].span) delete c.cells[ar][ac].span; }
      continue;
    }
    const [rs, cs] = spanOf(cl);
    if (rs > 1) {                                        // the merge's first row: the next row takes over
      const next = { paragraphs: cl.paragraphs, ...(cl.fill ? { fill: cl.fill } : {}) };
      if (rs - 1 > 1 || cs > 1) next.span = [rs - 1, cs];
      c.cells[at + 1][k] = next;
    }
  }
  c.cells.splice(at, 1); c.rowHeights.splice(at, 1); c.rows--;
  return c;
}
export function insertColumn(t, at) {
  const c = structuredClone(t);
  const i = Math.max(0, Math.min(c.cols, at));
  // the new column takes its width from its neighbour; the others shrink so the table keeps its width
  const w = c.colWidths[Math.min(i, c.colWidths.length - 1)] || 72;
  const total = c.colWidths.reduce((a, b) => a + b, 0);
  const k = total / (total + w);
  c.colWidths = c.colWidths.map((x) => r2(x * k));
  c.colWidths.splice(i, 0, r2(w * k));
  c.cells.forEach((row, r) => {
    let cell = emptyCell();
    for (let k2 = 0; k2 < i; k2++) {
      const cl = c.cells[r][k2];
      if (cl.covered) continue;
      const [rs, cs] = spanOf(cl);
      if (cs > 1 && k2 + cs > i) { cl.span = [rs, cs + 1]; cell = { ...emptyCell(), covered: true }; }
    }
    // a merge passing through from a row above also covers the new cell
    if (!cell.covered) { const a = anchorOf(c, r, Math.min(i, c.cols - 1)); if (a && a[0] !== r && a[1] < i && a[1] + spanOf(c.cells[a[0]][a[1]])[1] > i) cell = { ...emptyCell(), covered: true }; }
    row.splice(i, 0, cell);
  });
  c.cols++;
  return c;
}
export function deleteColumn(t, at) {
  if (t.cols <= 1) return null;
  const c = structuredClone(t);
  for (let r = 0; r < c.rows; r++) {
    const cl = c.cells[r][at];
    if (cl.covered) {
      const [ar, ac] = anchorOf(c, r, at);
      if (ac !== at && ar === r) { const [rs, cs] = spanOf(c.cells[ar][ac]); if (rs > 1 || cs - 1 > 1) c.cells[ar][ac].span = [rs, cs - 1]; else delete c.cells[ar][ac].span; }
      continue;
    }
    const [rs, cs] = spanOf(cl);
    if (cs > 1) {
      const next = { paragraphs: cl.paragraphs, ...(cl.fill ? { fill: cl.fill } : {}) };
      if (rs > 1 || cs - 1 > 1) next.span = [rs, cs - 1];
      c.cells[r][at + 1] = next;
    }
  }
  const gone = c.colWidths[at];
  c.colWidths.splice(at, 1);
  const total = c.colWidths.reduce((a, b) => a + b, 0);
  const k = (total + gone) / total;
  c.colWidths = c.colWidths.map((x) => r2(x * k));          // the others widen so the table keeps its width
  for (const row of c.cells) row.splice(at, 1);
  c.cols--;
  return c;
}

// the <table> for a frame (render.js calls this; paragraphEl draws each cell's text)
export function tableEl(f, paragraphEl) {
  const tbl = document.createElement('table');
  tbl.className = 'bb-table';
  const b = f.border;
  tbl.style.cssText = 'border-collapse:collapse;table-layout:fixed;width:' + f.w + 'pt;';
  const colgroup = document.createElement('colgroup');
  for (const w of f.colWidths) { const col = document.createElement('col'); col.style.width = w + 'pt'; colgroup.appendChild(col); }
  tbl.appendChild(colgroup);
  const inset = f.inset ?? 2.88;
  f.cells.forEach((row, r) => {
    const tr = document.createElement('tr');
    tr.style.height = (f.rowHeights[r] || 20) + 'pt';
    row.forEach((cell, c) => {
      if (cell.covered) return;                         // part of a merged cell: drawn by its anchor
      const td = document.createElement('td');
      td.dataset.row = r; td.dataset.col = c;
      const [rs, cs] = cell.span || [1, 1];
      if (rs > 1) td.rowSpan = rs;
      if (cs > 1) td.colSpan = cs;
      const colW = f.colWidths.slice(c, c + cs).reduce((a, x) => a + x, 0);
      // the inset is the cell's padding, so the text area's width is exactly what the tab layout measures
      td.style.cssText = 'padding:' + inset + 'pt;vertical-align:top;' + (b ? 'border:' + b.width + 'pt solid ' + b.color + ';' : 'border:0;') + (cell.fill ? 'background:' + cell.fill + ';' : '');
      const area = document.createElement('div');
      area.className = 'text-area cell-area';
      area.style.cssText = 'position:static;display:block;overflow:visible;width:' + Math.max(1, colW - 2 * inset - (b ? b.width : 0)) + 'pt;';
      area.dataset.wpt = Math.max(1, colW - 2 * inset - (b ? b.width : 0));
      const flow = document.createElement('div');
      flow.className = 'flow';
      for (const p of cell.paragraphs) flow.appendChild(paragraphEl(p, f.id));
      area.appendChild(flow);
      td.appendChild(area);
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
  return tbl;
}
