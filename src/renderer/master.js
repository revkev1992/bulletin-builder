// Master pages (Publisher: Page Design ▸ Master Pages, View ▸ Master Page). A half has one two-page
// master — a LEFT side (even pages) and a RIGHT side (odd pages; page 1 is a right-hand page). Objects
// on the master are drawn behind every page of that half (a page may ignore the master:
// page.master = false). Saved in the half file: half.master = { left: { frames }, right: { frames } }.
//
// Master view reuses the whole editor: while editor.masterMode is on, pageEntry(n) answers with the
// master side that page n shows, so selecting, moving, typing, undo and the ribbon all work unchanged;
// the pages are drawn from the master alone (render.js renderPage with { master: true }) and a change
// re-renders every page that shares the side. Installed on Editor.prototype.
const SIDE_LABEL = { left: 'left-hand', right: 'right-hand' };

export const masterSideOf = (n) => (n % 2 === 1 ? 'right' : 'left');
export const emptyMaster = () => ({ left: { frames: [] }, right: { frames: [] } });

// the master of a half object, made on first use
export function masterOf(half) {
  if (!half) return null;
  if (!half.master) half.master = emptyMaster();
  for (const s of ['left', 'right']) if (!half.master[s]) half.master[s] = { frames: [] };
  for (const s of ['left', 'right']) if (!half.master[s].frames) half.master[s].frames = [];
  return half.master;
}

export function installMaster(Editor) {
  const P = Editor.prototype;

  P.masterSide = function (n) { return masterSideOf(n); };
  // the master side page n shows: { frames, locked?, guides? } — the shape of a page entry
  P.masterEntry = function (n) {
    const half = this.week().halves[this.halfOf(n)];
    const m = masterOf(half);
    return m ? m[this.masterSide(n)] : null;
  };
  // the pages (of the half being edited) drawn from the same master side(s) as `pages`
  P.masterPages = function (pages) {
    const sides = new Set((pages && pages.length ? pages : this.app.pageNumbers()).map((n) => this.masterSide(n)));
    return this.app.pageNumbers().filter((n) => this.halfOf(n) === this.half && sides.has(this.masterSide(n)));
  };
  P.masterHas = function (halfName) {
    const m = this.week().halves[halfName] && this.week().halves[halfName].master;
    return !!(m && ((m.left && m.left.frames && m.left.frames.length) || (m.right && m.right.frames && m.right.frames.length)));
  };

  // View ▸ Master Page / Normal, Page Design ▸ Master Pages ▸ Edit Master Pages
  P.setMasterMode = async function (on) {
    on = !!on;
    if (on === !!this.masterMode) return false;
    if (on && !this.half) { this.app.setStatus('Choose which pages you are changing first (Bulletin ▸ I am changing): the master page belongs to a half.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    if (this.crop) this.crop = null;
    const lp = this.sel ? this.sel.page : this.lastPage;
    this.sel = null; this.multi = [];
    this.masterMode = on;
    await this.app.setMasterView(on, lp);
    this.app.setStatus(on
      ? 'Master page: what you put here appears on every ' + (this.half === 'worship' ? 'worship' : 'announcements') + ' page — the left-hand master on the even pages, the right-hand master on the odd pages. View ▸ Normal to go back to the pages.'
      : 'Back to the pages.');
    return true;
  };
  P.toggleMasterMode = function () { return this.setMasterMode(!this.masterMode); };

  // Page Design ▸ Master Pages ▸ "This page uses the master page" (off = page.master: false)
  P.pageUsesMaster = function (n) { const pg = this.masterMode ? this.pageEntryReal(n) : this.pageEntry(n); return !!pg && pg.master !== false; };
  P.setPageUsesMaster = async function (on, n = this.targetPage()) {
    if (n == null || !this.editable(n)) { this.app.setStatus('Click a page you are editing first.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    const pg = this.pageEntryReal(n);
    if ((pg.master !== false) === !!on) return false;
    await this.commit([n], () => { const p = this.pageEntryReal(n); if (on) delete p.master; else p.master = false; });
    this.app.setStatus(on ? 'Page ' + n + ' shows the master page again.' : 'Page ' + n + ' ignores the master page (nothing from the master is drawn on it).');
    return true;
  };

  // Page Design ▸ Master Pages ▸ Send to Master Page: the selected objects leave the page and go on the
  // master side that page shows, keeping their place — so they now appear on every page of that side
  P.sendToMaster = async function () {
    if (this.masterMode) { this.app.setStatus('You are already on the master page.'); return false; }
    const n = this.sel && this.sel.page;
    if (n == null || !this.editable(n)) { this.app.setStatus('Select an object on a page you are editing first.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    const ids = [this.sel.id, ...this.multi];
    const pg = this.pageEntry(n);
    const moving = pg.frames.filter((f) => ids.includes(f.id) && !f.generated && !f.locked);
    if (!moving.length) { this.app.setStatus('Nothing to send: the selection is locked or part of the order of worship.'); return false; }
    const side = this.masterSide(n);
    const pages = this.app.pageNumbers().filter((k) => this.halfOf(k) === this.half && this.masterSide(k) === side);
    await this.commit(pages, () => {
      const p = this.pageEntry(n);
      p.frames = p.frames.filter((f) => !moving.includes(f));
      const m = this.masterEntry(n);
      for (const f of moving) { delete f.role; m.frames.push(f); }
      delete p.master;                                   // the page now shows the master it just got
    });
    this.select(n, null);
    this.app.setStatus(moving.length + ' object' + (moving.length === 1 ? '' : 's') + ' sent to the ' + SIDE_LABEL[side] + ' master page: now on every ' + SIDE_LABEL[side] + ' ' + this.half + ' page. Undo takes ' + (moving.length === 1 ? 'it' : 'them') + ' back.');
    return true;
  };

  // Master Pages ▸ Clear: empties one side (undoable)
  P.clearMasterSide = async function (side) {
    if (!this.half) return false;
    const m = masterOf(this.week().halves[this.half]);
    if (!m[side].frames.length) { this.app.setStatus('The ' + SIDE_LABEL[side] + ' master page is already empty.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    const pages = this.app.pageNumbers().filter((k) => this.halfOf(k) === this.half && this.masterSide(k) === side);
    await this.commit(pages, () => { masterOf(this.week().halves[this.half])[side].frames = []; });
    this.select(this.lastPage, null);
    this.app.setStatus('The ' + SIDE_LABEL[side] + ' master page is empty. Undo takes its objects back.');
    return true;
  };
}
