// GUI suite: Insert ▸ Table (Publisher) — a rows × columns table, typing in cells, Table Format
// (insert / delete rows and columns, borders, cell fill), resizing keeps the columns in proportion.
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const T = () => ed(`(() => { const f = ed.topFrame(${P}, window.__tbl); return f && JSON.parse(JSON.stringify(f)); })()`);
  const cellRect = (r, c) => h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td[data-row="${r}"][data-col="${c}"]`);
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(700);

  // Insert ▸ Table ▸ 3 × 3
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Insert ▸ Table is enabled while editing', !(await h.disabled('#ins-table')));
  await h.clickSel('#ins-table');
  h.ok('Table asks for rows and columns', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="rows"]')`, 2000));
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  h.tbl = await ed('ed.sel && ed.sel.id');
  await h.js(`window.__tbl = ${JSON.stringify(h.tbl)}`);
  let t = await T();
  h.ok('a 3 × 3 table is on the page, selected', t && t.kind === 'table' && t.rows === 3 && t.cols === 3 && t.cells.length === 3 && t.cells[0].length === 3, { t: t && { rows: t.rows, cols: t.cols } });
  h.ok('…drawn as a real table with 9 cells', (await h.js(`document.querySelectorAll('.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td').length`)) === 9);
  h.ok('…its columns add up to its width', Math.abs(sum(t.colWidths) - t.w) < 0.5, { cw: t.colWidths, w: t.w });
  h.ok('Table Format tab shows', (await h.js(`document.querySelector('.rb-tab[data-tab="format"]').textContent`)) === 'Table Format');
  await h.shot('table');

  // type in a cell
  let r = await cellRect(0, 0);
  await h.click(r.x + 8, r.y + 8);
  h.ok('a click in a cell starts typing there', await ed('!!ed.textEdit && ed.textEdit.cell && ed.textEdit.cell[0] === 0 && ed.textEdit.cell[1] === 0'));
  await h.type('Sunday');
  r = await cellRect(1, 2);
  await h.click(r.x + 8, r.y + 8);
  await h.type('9 AM');
  await h.key('Escape', [], 500);
  t = await T();
  const text = (rr, cc) => t.cells[rr][cc].paragraphs.map((p) => p.runs.map((x) => x.text).join('')).join('');
  h.ok('typing is saved in the right cells', text(0, 0) === 'Sunday' && text(1, 2) === '9 AM', { a: text(0, 0), b: text(1, 2) });
  const h0 = t.h;

  // Table Format: insert a row below the first, a column before the last; delete them again
  r = await cellRect(0, 1);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-row-below');
  await h.wait(400);
  t = await T();
  h.ok('Insert Row Below: 4 rows, the new one empty under "Sunday"', t.rows === 4 && t.cells.length === 4 && text(0, 0) === 'Sunday' && text(1, 0) === '' && t.h > h0, { rows: t.rows });
  r = await cellRect(0, 2);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-col-left');
  await h.wait(400);
  t = await T();
  h.ok('Insert Column Left: 4 columns, the table keeps its width', t.cols === 4 && t.cells[0].length === 4 && Math.abs(sum(t.colWidths) - t.w) < 0.5 && text(2, 3) === '9 AM', { cw: t.colWidths, w: t.w });
  await h.shot('table-4x4');
  r = await cellRect(1, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-row-del');
  await h.wait(400);
  t = await T();
  h.ok('Delete Row: 3 rows again', t.rows === 3 && text(1, 3) === '9 AM');
  r = await cellRect(0, 2);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-col-del');
  await h.wait(400);
  t = await T();
  h.ok('Delete Column: 3 columns, width kept', t.cols === 3 && Math.abs(sum(t.colWidths) - t.w) < 0.5 && text(1, 2) === '9 AM', { cw: t.colWidths });

  // cell fill and borders
  r = await cellRect(0, 0);
  await h.click(r.x + 8, r.y + 8);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-fill');
  await h.clickSel('.tf-swatch[data-color="#FFF2CC"]');
  await h.wait(400);
  t = await T();
  h.ok('Cell Fill: the cell is coloured', t.cells[0][0].fill === '#FFF2CC' && /255, 242, 204/.test(await h.js(`getComputedStyle(document.querySelector('.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td[data-row="0"][data-col="0"]')).backgroundColor`)));
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-borders');
  await h.clickSel('#tb-border-none');
  await h.wait(400);
  t = await T();
  h.ok('Borders ▸ None', t.border === null && (await h.js(`getComputedStyle(document.querySelector('.page-shell[data-page="${P}"] .frame[data-id="${h.tbl}"] td')).borderTopWidth`)) === '0px');
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-borders');
  await h.clickSel('#tb-border-all');
  await h.wait(400);
  t = await T();
  h.ok('Borders ▸ All', t.border && t.border.width > 0);
  await h.shot('table-styled');

  // resize from the right handle: the columns scale in proportion (Esc leaves the table selected)
  await h.key('Escape', [], 400);
  h.ok('Esc leaves the table selected with its handles', !!(await h.rect(`.page-shell[data-page="${P}"] .sel-box .handle.h-e`)));
  const hd = await h.rect(`.page-shell[data-page="${P}"] .sel-box .handle.h-e`);
  await h.drag(hd.cx, hd.cy, hd.cx + 60, hd.cy, { mods: ['alt'] });
  const t2 = await T();
  h.ok('dragging the right handle widens the table and its columns together', t2.w > t.w + 20 && Math.abs(sum(t2.colWidths) - t2.w) < 0.5 && Math.abs(t2.colWidths[0] / t2.w - t.colWidths[0] / t.w) < 0.01, { w: t2.w, cw: t2.colWidths });
  await h.clickSel('#undo');
  await h.wait(300);
  h.ok('Undo puts the width back', Math.abs((await T()).w - t.w) < 0.5);

  // a table in the PDF / print renderer: still a table (the renderer is one); delete it
  await h.key('Delete', [], 400);
  h.ok('Delete removes the table', !(await T()));
  await h.clickSel('#undo');
  await h.wait(300);
  h.ok('…and Undo brings it back with its text', (await T()) && text(0, 0) === 'Sunday');
};
