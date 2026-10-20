// Publisher's Home ▸ Arrange (and the Format tabs' Arrange group): several objects selected at
// once (Shift+click), Align / Distribute, Group / Ungroup, Rotate / Flip, Wrap Text, and text-box
// Columns. Installed onto Editor.prototype so they share its selection, commit() and undo.
//
// Selection model: `sel` is the primary object (handles, size boxes); `multi` holds the ids of the
// other selected objects ON THE SAME PAGE. Everything here works on the whole set.

const r2 = (v) => Math.round(v * 100) / 100;
const each = (f, fn) => { fn(f); (f.children || []).forEach((c) => each(c, fn)); };

export function installArrange(Editor) {
  const P = Editor.prototype;

  P.selection = function () {
    if (!this.sel) return [];
    const ids = [this.sel.id, ...(this.multi || [])];
    return ids.map((id) => this.topFrame(this.sel.page, id)).filter(Boolean);
  };
  P.movableSelection = function () {
    return this.selection().filter((f) => !this.locked(this.sel.page, f));
  };

  P.toggleMulti = function (n, id) {
    if (!this.sel || this.sel.page !== n) { this.select(n, id); return; }
    if (id === this.sel.id) {
      // shift+click the primary: drop it, promote the next one
      if (!this.multi.length) { this.select(n, null); return; }
      this.sel = { page: n, id: this.multi.shift() };
    } else if (this.multi.includes(id)) {
      this.multi = this.multi.filter((x) => x !== id);
    } else {
      this.multi.push(id);
    }
    this.drawSelection();
  };

  // one undo step for any change to the selected objects
  P.changeSelection = function (mutate, { needTwo = false } = {}) {
    const n = this.sel && this.sel.page;
    if (n == null || !this.editable(n)) return Promise.resolve(false);
    const fs = this.movableSelection();
    if (!fs.length || (needTwo && fs.length < 2)) return Promise.resolve(false);
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      const live = fs.map((f) => pg.frames.find((x) => x.id === f.id));
      mutate(live, pg, n);
    }).then(() => true);
  };

  P.moveSelection = function (dx, dy) {
    return this.changeSelection((live) => {
      for (const f of live) each(f, (g) => { g.x = r2(g.x + dx); g.y = r2(g.y + dy); });
    });
  };

  // margins of page n as a box (mirrored margins: inside edge is on the left of an odd page)
  P.marginBox = function (n) {
    const { width: W, height: H } = this.pageSize();
    const m = this.week().manifest.margins || {};
    const odd = n % 2 === 1;
    const inside = m.inside ?? 36, outside = m.outside ?? 36;
    const left = odd ? inside : outside, right = odd ? outside : inside;
    return { x: left, y: m.top ?? 36, w: W - left - right, h: H - (m.top ?? 36) - (m.bottom ?? 36) };
  };

  // Align: with one object (or "Relative to Margin Guides") it aligns to the page margins, like Publisher
  P.alignSelection = function (how, toMargins) {
    const fs = this.movableSelection();
    if (!fs.length) return Promise.resolve(false);
    const n = this.sel.page;
    const box = toMargins || fs.length < 2 ? this.marginBox(n) : bounds(fs);
    return this.changeSelection((live) => {
      for (const f of live) {
        let dx = 0, dy = 0;
        if (how === 'left') dx = box.x - f.x;
        if (how === 'center') dx = box.x + box.w / 2 - (f.x + f.w / 2);
        if (how === 'right') dx = box.x + box.w - (f.x + f.w);
        if (how === 'top') dy = box.y - f.y;
        if (how === 'middle') dy = box.y + box.h / 2 - (f.y + f.h / 2);
        if (how === 'bottom') dy = box.y + box.h - (f.y + f.h);
        each(f, (g) => { g.x = r2(g.x + dx); g.y = r2(g.y + dy); });
      }
    });
  };

  // Distribute: equal gaps between the objects (3+), or across the margins
  P.distributeSelection = function (axis, toMargins) {
    const fs = this.movableSelection();
    if (fs.length < (toMargins ? 1 : 3)) return Promise.resolve(false);
    const X = axis === 'h' ? 'x' : 'y', S = axis === 'h' ? 'w' : 'h';
    const box = toMargins ? this.marginBox(this.sel.page) : bounds(fs);
    const total = fs.reduce((t, f) => t + f[S], 0);
    const gap = (box[S] - total) / (fs.length + (toMargins ? 1 : -1));
    return this.changeSelection((live) => {
      const order = [...live].sort((a, b) => a[X] - b[X]);
      let at = box[X] + (toMargins ? gap : 0);
      for (const f of order) {
        const d = at - f[X];
        each(f, (g) => { g[X] = r2(g[X] + d); });
        at += f[S] + gap;
      }
    });
  };

  P.groupSelection = function () {
    const fs = this.movableSelection();
    if (fs.length < 2) return Promise.resolve(false);
    const id = this.newId();
    const b = bounds(fs);
    const ok = this.changeSelection((live, pg) => {
      const ids = new Set(live.map((f) => f.id));
      const z = Math.max(...live.map((f) => f.z || 0));
      const children = pg.frames.filter((f) => ids.has(f.id)).sort((a, b2) => (a.z || 0) - (b2.z || 0));
      pg.frames = pg.frames.filter((f) => !ids.has(f.id));
      pg.frames.push({ id, kind: 'group', x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h), z, children });
    }, { needTwo: true });
    return ok.then((done) => { if (done) { this.multi = []; this.select(this.sel.page, id); } return done; });
  };

  P.ungroupSelection = function () {
    const f = this.frame();
    if (!f || f.kind !== 'group' || this.locked(this.sel.page, f)) return Promise.resolve(false);
    const kids = f.children.map((c) => c.id);
    return this.changeSelection((live, pg) => {
      const g = live[0];
      pg.frames = pg.frames.filter((x) => x.id !== g.id).concat(g.children);
    }).then((done) => {
      if (done) { this.sel = { page: this.sel.page, id: kids[0] }; this.multi = kids.slice(1); this.drawSelection(); }
      return done;
    });
  };

  P.rotateSelection = function (deg) {
    return this.changeSelection((live) => {
      for (const f of live) {
        const r = (((f.rotation || 0) + deg) % 360 + 360) % 360;
        if (r) f.rotation = r; else delete f.rotation;
      }
    });
  };
  P.flipSelection = function (axis) {
    const k = axis === 'h' ? 'flipH' : 'flipV';
    return this.changeSelection((live) => { for (const f of live) { if (f[k]) delete f[k]; else f[k] = true; } });
  };

  // Wrap Text: none / square / tight / topBottom (the importer's frame.wrap)
  P.setWrap = function (type) {
    return this.changeSelection((live) => {
      for (const f of live) {
        if (type === 'none') delete f.wrap;
        else f.wrap = { type, dist: (f.wrap && f.wrap.dist) || [7.2, 7.2, 7.2, 7.2] };
      }
    }).then(async (done) => { if (done) await this.app.rerender(this.app.pageNumbers().filter((k) => k === this.sel.page)); return done; });
  };

  // text box columns (Text Box Format ▸ Columns / Home ▸ Paragraph ▸ Columns)
  P.setColumns = function (cols) {
    const t = this.textEdit;
    const target = t ? { page: t.n, id: t.id } : this.sel;
    if (!target) return Promise.resolve(false);
    const go = async () => {
      const f = this.anyFrame(target.page, target.id);
      if (!f || f.kind !== 'text' || !this.editable(target.page) || this.locked(target.page, f)) return false;
      await this.commit([target.page], () => {
        const live = this.anyFrame(target.page, target.id);
        if (cols > 1) { live.text.columns = cols; live.text.columnGap = live.text.columnGap || 9; }
        else { delete live.text.columns; delete live.text.columnGap; }
      });
      if (f.text.chain) await this.app.rerender(this.reflow(f.text.chain.story));
      return true;
    };
    return t ? this.endTextEdit().then(go) : go();
  };
}

function bounds(fs) {
  const x0 = Math.min(...fs.map((f) => f.x)), y0 = Math.min(...fs.map((f) => f.y));
  const x1 = Math.max(...fs.map((f) => f.x + f.w)), y1 = Math.max(...fs.map((f) => f.y + f.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
