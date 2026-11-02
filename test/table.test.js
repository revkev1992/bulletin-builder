// Unit test for the table model (src/renderer/table.js): merge / split cells and how row / column
// operations keep merges whole.   node test/table.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  // the renderer module is ESM; node needs an .mjs copy to import it outside Electron
  const src = path.join(__dirname, '../src/renderer/table.js');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bb-table-')), 'table.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(src, 'utf8'));
  const T = await import('file://' + tmp.replace(/\\/g, '/'));
  let fails = 0;
  const ok = (name, pass, extra) => { fails += pass ? 0 : 1; console.log((pass ? '  ok   ' : '  FAIL ') + name + (pass ? '' : ' ' + JSON.stringify(extra || {}))); };
  const text = (t, r, c) => t.cells[r][c].paragraphs.map((p) => p.runs.map((x) => x.text).join('')).join('|');
  const put = (t, r, c, s) => { t.cells[r][c] = { paragraphs: [T.emptyPara(s)] }; };
  const shape = (t) => t.cells.map((row) => row.map((cl) => (cl.covered ? 'x' : cl.span ? cl.span.join('') : '.')).join('')).join('/');

  let t = T.newTable('t', { x: 0, y: 0, w: 300, rows: 3, cols: 3 });
  put(t, 0, 0, 'A'); put(t, 0, 1, 'B'); put(t, 1, 0, 'C'); put(t, 1, 1, 'D'); put(t, 2, 2, 'E');
  const m = T.mergeCells(t, 0, 0, 1, 1);
  ok('merge 2×2: anchor spans [2,2], three covered, text carried in reading order', shape(m) === '22x./xx./...' && text(m, 0, 0) === 'A|B|C|D', { s: shape(m), t: text(m, 0, 0) });
  ok('anchorOf a covered cell finds the anchor', String(T.anchorOf(m, 1, 1)) === '0,0' && String(T.anchorOf(m, 2, 2)) === '2,2');
  ok('merge of one cell is nothing', T.mergeCells(t, 2, 2, 2, 2) === null);
  const m2 = T.mergeCells(m, 1, 1, 2, 2);
  ok('merging into a merge takes the whole merge: 3×3', shape(m2) === '33xx/xxx/xxx' && text(m2, 0, 0) === 'A|B|C|D|E', { s: shape(m2) });
  const sp = T.splitCell(m, 1, 0);
  ok('split (from a covered cell): back to plain cells, text stays in the first', shape(sp) === '.../.../...' && text(sp, 0, 0) === 'A|B|C|D' && text(sp, 0, 1) === '' && !sp.cells[0][0].span, { s: shape(sp) });
  ok('split of a plain cell is nothing', T.splitCell(t, 0, 0) === null);

  // rows / columns around a 2×2 merge at the top-left
  const ir = T.insertRow(m, 1);
  ok('insert a row inside the merge: the merge grows to 3 rows, new cells covered', ir.rows === 4 && shape(ir) === '32x./xx./xx./...', { s: shape(ir) });
  const ir2 = T.insertRow(m, 2);
  ok('insert a row after the merge: untouched', ir2.rows === 4 && shape(ir2) === '22x./xx./.../...', { s: shape(ir2) });
  const dr = T.deleteRow(m, 0);
  ok('delete the merge\'s first row: the next row takes the text, span [1,2]', dr.rows === 2 && shape(dr) === '12x./...' && text(dr, 0, 0) === 'A|B|C|D', { s: shape(dr), t: text(dr, 0, 0) });
  const dr2 = T.deleteRow(m, 1);
  ok('delete the merge\'s second row: span shrinks to 1 row', dr2.rows === 2 && shape(dr2) === '12x./...', { s: shape(dr2) });
  const ic = T.insertColumn(m, 1);
  ok('insert a column inside the merge: the merge grows to 3 columns', ic.cols === 4 && shape(ic) === '23xx./xxx./....' && Math.abs(ic.colWidths.reduce((a, b) => a + b, 0) - ic.w) < 0.5, { s: shape(ic) });
  const dc = T.deleteColumn(m, 0);
  ok('delete the merge\'s first column: the next column takes the text, span [2,1]', dc.cols === 2 && shape(dc) === '21./x./..' && text(dc, 0, 0) === 'A|B|C|D', { s: shape(dc) });
  const dc2 = T.deleteColumn(m, 1);
  ok('delete the merge\'s second column: span shrinks', dc2.cols === 2 && shape(dc2) === '21./x./..', { s: shape(dc2) });
  // a merge fully inside one row, then delete that row below it
  const mr = T.mergeCells(t, 2, 0, 2, 2);
  ok('merge a whole row: [1,3]', shape(mr) === '.../.../13xx');
  const dr3 = T.deleteRow(mr, 2);
  ok('delete that row: gone cleanly', dr3.rows === 2 && shape(dr3) === '.../...');

  console.log(fails ? fails + ' check(s) failed' : 'table model: all checks pass');
  process.exit(fails ? 1 : 0);
})();
