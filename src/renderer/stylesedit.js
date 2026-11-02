// Home ▸ Styles ▸ right-click a style: Modify…, Update to Match Selection, Delete (Publisher).
// A style's definition lives in the week file (manifest.styles); changing it restyles EVERY paragraph
// of the half you are editing that uses it ("styles are global, so one change updates everything").
// One undo step: the half as it was AND the style list as it was (editor.restore knows the entry).
import { normStyle, restyleParagraph } from './styles-gallery.js';

const UNDO_LIMIT = 100;

export function installStyles(Editor) {
  const P = Editor.prototype;

  // every paragraph in the editable half using style `name` → fn(para); returns the pages touched
  P.restyleWhere = function (name, fn) {
    const touched = new Set();
    const stories = new Set();
    const visit = (f, n) => {
      if (f.text && !f.generated) {
        let hit = false;
        f.text.paragraphs = f.text.paragraphs.map((p) => { if (p.style !== name) return p; hit = true; return fn(p); });
        if (hit) { touched.add(n); if (f.text.chain) stories.add(f.text.chain.story); }
      }
      (f.children || []).forEach((c) => visit(c, n));
    };
    for (const n of this.app.pageNumbers()) {
      if (!this.editable(n)) continue;
      const pg = this.pageEntry(n);
      if (pg) for (const f of pg.frames) visit(f, n);
    }
    return { pages: [...touched], stories: [...stories] };
  };

  // change (or delete, newSt = null) one style: save the list, restyle the paragraphs, one undo step
  P.changeStyle = async function (name, newSt) {
    if (!this.half) return false;
    if (this.textEdit) await this.endTextEdit();
    const week = this.week();
    const oldList = week.manifest.styles || [];
    const oldRaw = oldList.find((s) => s.name === name);
    const oldSt = oldRaw ? normStyle(oldRaw) : null;
    const list = newSt ? (oldRaw ? oldList.map((s) => (s.name === name ? newSt : s)) : [...oldList, newSt]) : oldList.filter((s) => s.name !== name);
    try {
      await window.bb.setStyles(this.app.file(), list);
    } catch (err) {
      this.app.setStatus('<span class="warn">' + String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '</span>');
      return false;
    }
    const half = week.halves[this.half];
    this.undo.push(JSON.stringify({ styles: oldList, half }));
    if (this.undo.length > UNDO_LIMIT) this.undo.shift();
    this.redo = [];
    week.manifest.styles = list;
    const r = newSt ? this.restyleWhere(name, (p) => restyleParagraph(p, oldSt, newSt))
      : this.restyleWhere(name, (p) => { const q = { ...p }; delete q.style; return q; });   // deleted: the look stays, the name goes
    this.setDirty(true);
    await this.app.rerender(r.pages);
    for (const st of r.stories) await this.app.rerender(this.reflow(st));
    this.drawSelection();
    return r.pages.length;
  };

  // Undo / Redo of a style change: the half AND the style list go back together
  P.restoreStyles = async function (entry, toStack) {
    const week = this.week();
    const s = JSON.parse(entry);
    toStack.push(JSON.stringify({ styles: week.manifest.styles || [], half: week.halves[this.half] }));
    try { await window.bb.setStyles(this.app.file(), s.styles); } catch (_) { /* the paragraphs still go back */ }
    week.manifest.styles = s.styles;
    week.halves[this.half] = s.half;
    this.setDirty(true);
    if (this.sel && !this.topFrame(this.sel.page, this.sel.id)) this.sel = null;
    this.multi = this.sel ? this.multi.filter((id) => this.topFrame(this.sel.page, id)) : [];
    const pages = this.app.pageNumbers().filter((n) => this.halfOf(n) === this.half);
    await this.app.rerender(pages);
    this.drawSelection();
  };
}
