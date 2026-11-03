// GUI suite: Table Format ▸ Merge — Merge with Cell to the Right / Below, Merge Cells… (rows × cols),
// Split Cells; merged cells draw as one <td> with a span; rows / columns keep a merge whole; Undo.
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const T = () => ed(`(() => { const f = ed.topFrame(${P}, window.__tbl); return f && JSON.parse(JSON.stringify(f)); })()`);
  const cellRect = (r, c) => h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td[data-row="${r}"][data-col="${c}"]`);
  const tds = () => h.js(`[...document.querySelectorAll('.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td')].map((td) => td.dataset.row + ',' + td.dataset.col + ':' + td.rowSpan + 'x' + td.colSpan)`);
  const shape = (t) => t.cells.map((row) => row.map((cl) => (cl.covered ? 'x' : cl.span ? cl.span.join('') : '.')).join('')).join('/');
  const text = (t, r, c) => t.cells[r][c].paragraphs.map((p) => p.runs.map((x) => x.text).join('')).join('|');

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(700);

  // a 3 × 3 table with a word in each of the first two cells
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-table');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="rows"]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  h.tbl = await ed('ed.sel && ed.sel.id');
  await h.js(`window.__tbl = ${JSON.stringify(h.tbl)}`);
  let r = await cellRect(0, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.type('Sunday');
  r = await cellRect(0, 1);
  await h.click(r.x + 8, r.y + 8);
  await h.type('Schedule');
  h.ok('typing in cell (0,1)', await ed('ed.textEdit && ed.textEdit.cell[1] === 1'));

  // Merge with Cell to the Right from (0,0)
  r = await cellRect(0, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Table Format ▸ Merge is enabled in a table', !(await h.disabled('#tb-merge')));
  await h.clickSel('#tb-merge');
  h.ok('Merge opens its menu', !!(await h.rect('.rb-menu[data-menu-name="tablemerge"]:not([hidden]) #tb-merge-right')));
  await h.clickSel('#tb-merge-right');
  await h.wait(500);
  let t = await T();
  h.ok('Merge Right: (0,0) spans 2 columns, (0,1) covered, the texts joined', shape(t) === '12x./.../...' && text(t, 0, 0) === 'Sunday|Schedule', { s: shape(t), t: text(t, 0, 0) });
  let d = await tds();
  h.ok('…drawn as 8 cells, the first with colspan 2', d.length === 8 && d[0] === '0,0:1x2', { d });
  h.ok('…and the caret is back in the merged cell', await ed('ed.textEdit && ed.textEdit.cell[0] === 0 && ed.textEdit.cell[1] === 0'));
  const w00 = (await cellRect(0, 0)).w, w02 = (await cellRect(0, 2)).w;
  h.ok('…the merged cell is as wide as two columns', Math.abs(w00 - 2 * w02) < 3, { w00, w02 });
  await h.shot('merge-right');

  // Merge with Cell Below: the 1×2 becomes 2×2
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-merge');
  await h.clickSel('#tb-merge-down');
  await h.wait(500);
  t = await T();
  h.ok('Merge Down on a merged cell: 2 × 2', shape(t) === '22x./xx./...', { s: shape(t) });
  d = await tds();
  h.ok('…drawn with rowspan 2 and colspan 2', d[0] === '0,0:2x2' && d.length === 6, { d });

  // an inserted row inside the merge keeps it whole
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-row-below');
  await h.wait(500);
  t = await T();
  h.ok('Insert Row Below inside the merge: the merge grows to 3 rows (the row below the caret row is covered)', t.rows === 4 && shape(t) === '32x./xx./xx./...', { s: shape(t) });
  await h.clickSel('#undo');
  await h.wait(500);
  t = await T();
  h.ok('Undo: 3 rows, 2 × 2 again', t.rows === 3 && shape(t) === '22x./xx./...', { s: shape(t) });

  // Split Cells from the merged cell
  r = await cellRect(0, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-merge');
  await h.clickSel('#tb-split');
  await h.wait(500);
  t = await T();
  h.ok('Split Cells: 9 plain cells, the text kept in the first', shape(t) === '.../.../...' && text(t, 0, 0) === 'Sunday|Schedule' && text(t, 0, 1) === '', { s: shape(t) });
  h.ok('…drawn as 9 cells again', (await tds()).length === 9);
  await h.shot('split');

  // Merge Cells… 2 rows × 3 columns from (1,0)
  r = await cellRect(1, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-merge');
  await h.until(`!!document.querySelector('.rb-menu[data-menu-name="tablemerge"]:not([hidden])')`, 2000);
  await h.clickSel('#tb-merge-dlg');
  h.ok('Merge Cells… asks for rows and columns', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="rows"]')`, 2000));
  await h.js(`(() => { const d = document.querySelector('dialog.pub-dialog[open]'); d.querySelector('input[name="rows"]').value = '2'; d.querySelector('input[name="cols"]').value = '3'; })()`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(500);
  t = await T();
  h.ok('Merge Cells 2 × 3 from (1,0): the bottom two rows are one cell', shape(t) === '.../23xx/xxx', { s: shape(t) });
  d = await tds();
  h.ok('…drawn as 4 cells, the merged one 2x3', d.length === 4 && d[3] === '1,0:2x3', { d });
  await h.shot('merge-block');
  // typing goes into the merged cell
  await h.type('Everyone welcome');
  await h.key('Escape', [], 400);
  t = await T();
  h.ok('typing lands in the merged cell', text(t, 1, 0) === 'Everyone welcome', { t: text(t, 1, 0) });
  // delete the merge's first row: the text moves down, the merge is 1 × 3
  r = await cellRect(1, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-row-del');
  await h.wait(500);
  t = await T();
  h.ok('Delete Row on the merge\'s first row: 2 rows, the text kept in a 1 × 3 cell', t.rows === 2 && shape(t) === '.../13xx' && text(t, 1, 0) === 'Everyone welcome', { s: shape(t), t: text(t, 1, 0) });
  await h.clickSel('#undo');
  await h.wait(500);
  t = await T();
  h.ok('Undo brings the 2 × 3 back', t.rows === 3 && shape(t) === '.../23xx/xxx', { s: shape(t) });
};
