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

export const emptyPara = (text = '') => ({ style: 'Normal', align: 'left', mark: { font: FONT, size: SIZE }, runs: text ? [{ text, font: FONT, size: SIZE }] : [] });
export const emptyCell = () => ({ paragraphs: [emptyPara()] });

export function newTable(id, { x, y, w, rows = 3, cols = 3, z = 1 } = {}) {
  const cw = r2(w / cols);
  return { id, kind: 'table', x: r2(x), y: r2(y), w: r2(cw * cols), h: rows * 20, z, rows, cols,
    colWidths: Array.from({ length: cols }, () => cw), rowHeights: Array.from({ length: rows }, () => 20),
    border: { color: '#000000', width: 0.75 }, inset: 2.88,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell)) };
}

// row / column operations (pure: return a changed copy)
export function insertRow(t, at) {
  const c = structuredClone(t);
  const i = Math.max(0, Math.min(c.rows, at));
  c.cells.splice(i, 0, Array.from({ length: c.cols }, emptyCell));
  c.rowHeights.splice(i, 0, c.rowHeights[Math.min(i, c.rowHeights.length - 1)] || 20);
  c.rows++;
  return c;
}
export function deleteRow(t, at) {
  if (t.rows <= 1) return null;
  const c = structuredClone(t);
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
  for (const row of c.cells) row.splice(i, 0, emptyCell());
  c.cols++;
  return c;
}
export function deleteColumn(t, at) {
  if (t.cols <= 1) return null;
  const c = structuredClone(t);
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
      const td = document.createElement('td');
      td.dataset.row = r; td.dataset.col = c;
      // the inset is the cell's padding, so the text area's width is exactly what the tab layout measures
      td.style.cssText = 'padding:' + inset + 'pt;vertical-align:top;' + (b ? 'border:' + b.width + 'pt solid ' + b.color + ';' : 'border:0;') + (cell.fill ? 'background:' + cell.fill + ';' : '');
      const area = document.createElement('div');
      area.className = 'text-area cell-area';
      area.style.cssText = 'position:static;display:block;overflow:visible;width:' + Math.max(1, f.colWidths[c] - 2 * inset - (b ? b.width : 0)) + 'pt;';
      area.dataset.wpt = Math.max(1, f.colWidths[c] - 2 * inset - (b ? b.width : 0));
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
