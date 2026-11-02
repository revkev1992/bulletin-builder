// Table editing (Insert ▸ Table, Table Format): installed on Editor.prototype. The cell being typed
// in is editor.textEdit.cell = [row, col] (beginTextEdit knows tables); the row / column commands
// work on that cell, or on the first row / column when the table is only selected.
import { newTable, insertRow, deleteRow, insertColumn, deleteColumn, mergeCells, splitCell, anchorOf } from './table.js';

const r2 = (v) => Math.round(v * 100) / 100;

export function installTables(Editor) {
  const P = Editor.prototype;

  P.insertTable = async function (rows, cols) {
    const n = this.targetPage();
    if (n == null) { this.app.setStatus('Click a page you are editing first.'); return null; }
    if (this.pageEntry(n).locked) { this.app.setStatus('Page ' + n + ' is locked.'); return null; }
    if (this.textEdit) await this.endTextEdit();
    const m = this.marginBox(n);
    const w = Math.min(m.w, 288);
    const t = newTable(this.newId(), { x: m.x + (m.w - w) / 2, y: m.y + 36, w, rows, cols, z: this.maxZ(n) + 1 });
    const f = await this.addFrame(n, t);
    this.syncTableHeight(n, f.id);
    this.app.setStatus('Table inserted: click in a cell to type; Table Format adds rows and columns.');
    return f;
  };

  // the frame's height follows its rows (they grow with their text); kept in the model so the
  // selection box and snapping see the real size — a silent update, no undo step of its own
  P.syncTableHeight = function (n, id) {
    const sh = this.app.shellOf(n);
    const el = sh && sh.querySelector('.frame[data-id="' + id + '"] table');
    const f = this.topFrame(n, id);
    if (!el || !f || f.kind !== 'table') return;
    const h = r2(el.offsetHeight * 0.75);          // layout px → pt (the zoom does not change offsetHeight)
    if (Math.abs(h - f.h) > 0.5) { f.h = h; this.drawSelection(); }
  };

  // the table being worked on and the cell: { n, f, r, c } or null
  P.tableTarget = function () {
    const t = this.textEdit;
    if (t && t.cell) return { n: t.n, f: this.anyFrame(t.n, t.id), r: t.cell[0], c: t.cell[1] };
    const f = this.frame();
    if (f && f.kind === 'table' && this.sel) return { n: this.sel.page, f, r: 0, c: 0 };
    return null;
  };

  // kind: row-above | row-below | row-del | col-left | col-right | col-del
  P.tableOp = async function (kind) {
    const tg = this.tableTarget();
    if (!tg || !this.editable(tg.n) || this.locked(tg.n, this.topFrame(tg.n, tg.f.id))) { this.app.setStatus('Click in a table first.'); return false; }
    const cell = this.textEdit && this.textEdit.cell;
    if (this.textEdit) await this.endTextEdit();
    const f = this.anyFrame(tg.n, tg.f.id);
    const next = { 'row-above': () => insertRow(f, tg.r), 'row-below': () => insertRow(f, tg.r + 1), 'row-del': () => deleteRow(f, tg.r),
      'col-left': () => insertColumn(f, tg.c), 'col-right': () => insertColumn(f, tg.c + 1), 'col-del': () => deleteColumn(f, tg.c) }[kind]();
    if (!next) { this.app.setStatus('A table keeps at least one row and one column.'); return false; }
    await this.commit([tg.n], () => {
      const pg = this.pageEntry(tg.n);
      const i = pg.frames.findIndex((x) => x.id === f.id);
      if (i >= 0) pg.frames[i] = next;
    });
    this.syncTableHeight(tg.n, f.id);
    this.select(tg.n, f.id);
    // carry on typing in the cell that is now where the caret was
    if (cell) {
      const r = kind === 'row-above' ? cell[0] + 1 : kind === 'row-del' ? Math.min(cell[0], next.rows - 1) : cell[0];
      const c = kind === 'col-left' ? cell[1] + 1 : kind === 'col-del' ? Math.min(cell[1], next.cols - 1) : cell[1];
      this.beginTextEdit(tg.n, f.id, null, { cell: anchorOf(next, r, c) || [r, c] });
    }
    this.app.setStatus(({ 'row-above': 'Row inserted above', 'row-below': 'Row inserted below', 'row-del': 'Row deleted', 'col-left': 'Column inserted to the left', 'col-right': 'Column inserted to the right', 'col-del': 'Column deleted' })[kind] + '.');
    return true;
  };

  // Table Format ▸ Merge ▸ Merge Right / Merge Down / Merge Cells… (rows × cols from the cell you are in)
  // and Split Cells (the cell you are in back into its cells). kind: right | down | split | { rows, cols }
  P.tableMerge = async function (kind) {
    const tg = this.tableTarget();
    if (!tg || !this.editable(tg.n) || this.locked(tg.n, this.topFrame(tg.n, tg.f.id))) { this.app.setStatus('Click in a table cell first.'); return false; }
    const f0 = this.anyFrame(tg.n, tg.f.id);
    const [ar, ac] = anchorOf(f0, tg.r, tg.c) || [tg.r, tg.c];
    const span = (f0.cells[ar][ac].span) || [1, 1];
    let next = null, what = '';
    if (kind === 'split') { next = splitCell(f0, ar, ac); what = 'Cell split into ' + (span[0] * span[1]) + ' cells.'; if (!next) { this.app.setStatus('This cell is not merged.'); return false; } }
    else if (kind === 'right') { if (ac + span[1] >= f0.cols) { this.app.setStatus('No cell to the right to merge with.'); return false; } next = mergeCells(f0, ar, ac, ar + span[0] - 1, ac + span[1]); what = 'Merged with the cell to the right.'; }
    else if (kind === 'down') { if (ar + span[0] >= f0.rows) { this.app.setStatus('No cell below to merge with.'); return false; } next = mergeCells(f0, ar, ac, ar + span[0], ac + span[1] - 1); what = 'Merged with the cell below.'; }
    else if (kind && kind.rows) { next = mergeCells(f0, ar, ac, ar + Math.max(1, kind.rows) - 1, ac + Math.max(1, kind.cols) - 1); what = 'Cells merged.'; }
    if (!next) { this.app.setStatus('Nothing to merge.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    await this.commit([tg.n], () => {
      const pg = this.pageEntry(tg.n);
      const i = pg.frames.findIndex((x) => x.id === f0.id);
      if (i >= 0) pg.frames[i] = next;
    });
    this.syncTableHeight(tg.n, f0.id);
    this.select(tg.n, f0.id);
    this.beginTextEdit(tg.n, f0.id, null, { cell: [ar, ac] });
    this.app.setStatus(what + ' Undo takes it back.');
    return true;
  };

  // Table Format ▸ Borders (all | none | outside) and Cell Fill (colour | null) on the cell being typed in
  P.tableStyle = async function (change) {
    const tg = this.tableTarget();
    if (!tg || !this.editable(tg.n)) return false;
    const cell = this.textEdit && this.textEdit.cell;
    if (this.textEdit) await this.endTextEdit();
    await this.commit([tg.n], () => {
      const f = this.anyFrame(tg.n, tg.f.id);
      if ('border' in change) f.border = change.border === 'none' ? null : { color: (f.border && f.border.color) || '#000000', width: (f.border && f.border.width) || 0.75 };
      if ('borderColor' in change) f.border = { color: change.borderColor, width: (f.border && f.border.width) || 0.75 };
      if ('borderWidth' in change) f.border = { color: (f.border && f.border.color) || '#000000', width: change.borderWidth };
      if ('fill' in change) { const cl = f.cells[tg.r][tg.c]; if (change.fill) cl.fill = change.fill.toUpperCase(); else delete cl.fill; }
      if ('fillAll' in change) for (const row of f.cells) for (const cl of row) { if (change.fillAll) cl.fill = change.fillAll.toUpperCase(); else delete cl.fill; }
    });
    this.syncTableHeight(tg.n, tg.f.id);
    this.select(tg.n, tg.f.id);
    if (cell) this.beginTextEdit(tg.n, tg.f.id, null, { cell });
    return true;
  };
}
