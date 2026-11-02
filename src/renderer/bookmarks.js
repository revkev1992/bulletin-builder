// Insert ▸ Bookmark (Publisher): a named place in the text that a hyperlink can point at
// (Insert ▸ Link ▸ "Place in this document"). A bookmark is a zero-width run { text: '', bookmark: name }
// drawn as <span class="run bookmark" id="bm-<id>">, so the PDF carries the link target too.
// Installed on Editor.prototype; the dialog lives in app.js.
import { bookmarkId } from './render.js';

// every bookmark in the week: [{ name, id, half, page, frameId }]
export function allBookmarks(week) {
  const out = [];
  if (!week) return out;
  const visitParas = (paras, where) => { for (const p of paras || []) for (const r of p.runs || []) if (r.bookmark) out.push({ name: r.bookmark, id: bookmarkId(r.bookmark), ...where }); };
  const visit = (f, where) => {
    if (f.text) visitParas(f.text.paragraphs, { ...where, frameId: f.id });
    if (f.kind === 'table') for (const row of f.cells || []) for (const cl of row) visitParas(cl.paragraphs, { ...where, frameId: f.id });
    (f.children || []).forEach((c) => visit(c, where));
  };
  for (const p of week.manifest.pages) {
    const half = week.halves[p.half];
    const pg = half && half.pages[String(p.number)];
    if (pg) for (const f of pg.frames || []) visit(f, { half: p.half, page: p.number });
  }
  return out;
}

export function installBookmarks(Editor) {
  const P = Editor.prototype;

  // a bookmark where you are typing
  P.insertBookmark = function (name) {
    const flow = this.editingFlow();
    if (!flow) { this.app.setStatus('Click in some text first: the bookmark goes where you are typing.'); return false; }
    const s = window.getSelection();
    if (!s.rangeCount || !flow.contains(s.anchorNode)) return false;
    const r = s.getRangeAt(0);
    r.collapse(true);
    const span = document.createElement('span');
    span.className = 'run bookmark';
    span.contentEditable = 'false';
    span.dataset.bookmark = name;
    span.id = 'bm-' + bookmarkId(name);
    span.title = 'Bookmark: ' + name;
    r.insertNode(span);
    const z = document.createTextNode('​');
    span.after(z);
    const after = document.createRange();
    after.setStart(z, 1); after.collapse(true);
    s.removeAllRanges(); s.addRange(after);
    flow.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', bubbles: true }));
    this.setDirty(true);
    this.app.setStatus('Bookmark "' + name + '" added. Insert ▸ Link ▸ Place in this document points a link at it.');
    return true;
  };

  // remove every bookmark of that name from the half being edited (one undo step)
  P.deleteBookmark = async function (name) {
    if (!this.half) return false;
    if (this.textEdit) await this.endTextEdit();
    const pages = [];
    const strip = (paras) => { let hit = false; for (const p of paras || []) { const n = (p.runs || []).length; p.runs = (p.runs || []).filter((r) => r.bookmark !== name); if (p.runs.length !== n) hit = true; } return hit; };
    const visit = (f) => { let hit = false; if (f.text && strip(f.text.paragraphs)) hit = true; if (f.kind === 'table') for (const row of f.cells || []) for (const cl of row) if (strip(cl.paragraphs)) hit = true; for (const c of f.children || []) if (visit(c)) hit = true; return hit; };
    for (const n of this.app.pageNumbers()) {
      if (!this.editable(n)) continue;
      const pg = this.pageEntryReal(n);
      if (pg && (pg.frames || []).some((f) => allBookmarksIn(f).includes(name))) pages.push(n);
    }
    if (!pages.length) { this.app.setStatus('No bookmark "' + name + '" on the ' + this.half + ' pages.'); return false; }
    await this.commit(pages, () => { for (const n of pages) for (const f of this.pageEntryReal(n).frames) visit(f); });
    this.app.setStatus('Bookmark "' + name + '" removed. Undo takes it back.');
    return true;
  };
}

function allBookmarksIn(f) {
  const names = [];
  const paras = (ps) => { for (const p of ps || []) for (const r of p.runs || []) if (r.bookmark) names.push(r.bookmark); };
  if (f.text) paras(f.text.paragraphs);
  if (f.kind === 'table') for (const row of f.cells || []) for (const cl of row) paras(cl.paragraphs);
  for (const c of f.children || []) names.push(...allBookmarksIn(c));
  return names;
}
