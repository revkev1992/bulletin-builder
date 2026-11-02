// Insert ▸ Header & Footer ▸ Page Number / Header / Footer (Publisher). A page number is a FIELD: a
// run { field: 'pageNumber' } that every page draws as its own number (render.js fieldText), so it
// is right after pages are inserted, moved or deleted. Header / Footer / Page Number "on every page"
// put a small text box in the top or bottom margin of every page you are editing (Publisher keeps
// those on the master page; a week has no master, so each page gets its own, tagged with a role).
// Installed on Editor.prototype.
const r2 = (v) => Math.round(v * 100) / 100;
const FONT = 'Palatino Linotype', SIZE = 9, BOX_H = 16;

// "Highland UMC — page # of ##" → runs with page-number / page-count fields
export function runsFromTemplate(text, base) {
  const runs = [];
  for (const part of text.split(/(##|#)/)) {
    if (!part) continue;
    if (part === '#') runs.push({ ...base, text: '#', field: 'pageNumber' });
    else if (part === '##') runs.push({ ...base, text: '#', field: 'pageCount' });
    else runs.push({ ...base, text: part });
  }
  return runs;
}

export function installFields(Editor) {
  const P = Editor.prototype;

  // a field where you are typing (an unbreakable piece the page fills in)
  P.insertField = function (field) {
    const flow = this.editingFlow();
    if (!flow) { this.app.setStatus('Click in some text first: the page number goes where you are typing.'); return false; }
    const s = window.getSelection();
    if (!s.rangeCount || !flow.contains(s.anchorNode)) return false;
    const r = s.getRangeAt(0);
    r.deleteContents();
    const span = document.createElement('span');
    span.className = 'run field';
    span.contentEditable = 'false';
    span.dataset.field = field;
    span.textContent = field === 'pageCount' ? String(this.app.pageNumbers().length) : String(this.textEdit.n);
    r.insertNode(span);
    // the caret after the field, with a zero-width anchor so typing carries on outside it
    const z = document.createTextNode('​');
    span.after(z);
    const after = document.createRange();
    after.setStart(z, 1); after.collapse(true);
    s.removeAllRanges(); s.addRange(after);
    flow.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', bubbles: true }));
    this.setDirty(true);
    this.app.setStatus((field === 'pageCount' ? 'Number of pages' : 'Page number') + ' inserted — a field that updates by itself.');
    return true;
  };

  // a one-line text box in the top or bottom margin of every page you are editing (role = header /
  // footer / pagenum). text: a template ("# of ##"); align: left / center / right
  P.addPageBoxes = async function (role, where, text, align = 'center') {
    if (!this.half) { this.app.setStatus('Choose which pages you are changing first (Bulletin ▸ I am changing).'); return 0; }
    if (this.textEdit) await this.endTextEdit();
    const { width: W, height: H } = this.pageSize();
    const m = this.week().manifest.margins || {};
    const top = m.top ?? 36, bottom = m.bottom ?? 36;
    const pages = this.app.pageNumbers().filter((n) => this.editable(n) && !this.pageEntry(n).locked);
    const added = [];
    await this.commit(pages, () => {
      for (const n of pages) {
        const pg = this.pageEntry(n);
        pg.frames = pg.frames.filter((f) => f.role !== role);          // replace an earlier one
        const odd = n % 2 === 1;
        const inside = m.inside ?? m.left ?? 36, outside = m.outside ?? m.right ?? 36;
        const left = odd ? inside : outside, right = odd ? outside : inside;
        const y = where === 'top' ? Math.max(0, r2((top - BOX_H) / 2)) : Math.min(H - BOX_H, r2(H - bottom + (bottom - BOX_H) / 2));
        const base = { font: FONT, size: SIZE };
        pg.frames.push({ id: this.newId(), kind: 'text', role, x: left, y, w: r2(W - left - right), h: BOX_H, z: this.maxZ(n) + 1,
          text: { inset: [0, 0, 0, 0], valign: 'middle', paragraphs: [{ style: 'Normal', align, mark: base, runs: runsFromTemplate(text, base) }] } });
        added.push(n);
      }
    });
    this.select(null, null);
    this.app.setStatus(({ header: 'Header', footer: 'Footer', pagenum: 'Page number' })[role] + ' put on ' + added.length + ' page' + (added.length === 1 ? '' : 's') + ' (the ' + this.half + ' pages). Undo takes it back.');
    return added.length;
  };

  P.removePageBoxes = async function (role) {
    if (!this.half) return 0;
    if (this.textEdit) await this.endTextEdit();
    const pages = this.app.pageNumbers().filter((n) => this.editable(n) && (this.pageEntry(n).frames || []).some((f) => f.role === role));
    if (!pages.length) { this.app.setStatus('No ' + ({ header: 'headers', footer: 'footers', pagenum: 'page numbers' })[role] + ' on the ' + this.half + ' pages.'); return 0; }
    await this.commit(pages, () => { for (const n of pages) { const pg = this.pageEntry(n); pg.frames = pg.frames.filter((f) => f.role !== role); } });
    this.select(null, null);
    this.app.setStatus(({ header: 'Headers', footer: 'Footers', pagenum: 'Page numbers' })[role] + ' removed from ' + pages.length + ' page' + (pages.length === 1 ? '' : 's') + '. Undo takes it back.');
    return pages.length;
  };
}
