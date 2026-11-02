// Page Design ▸ Layout ▸ Guides, and Page Background (Publisher). Ruler guides are the green lines
// you drag off a ruler onto a page (or add from the Guides menu); objects snap to them; they are
// kept in the half file (page.guides = [{ pos, axis }]) and never printed. Drag a guide to move it,
// drag it off the page to remove it. Installed on Editor.prototype (shares select / commit / undo).
const r2 = (v) => Math.round(v * 100) / 100;

export function installGuides(Editor) {
  const P = Editor.prototype;

  // draw page n's guides into its overlay (app.js calls this after every render of the page)
  P.drawGuides = function (n) {
    const sh = this.app.shellOf(n);
    if (!sh) return;
    const ov = sh.querySelector('.overlay');
    ov.querySelectorAll('.rguide').forEach((g) => g.remove());
    const pg = this.pageEntry(n);
    if (!pg || !pg.guides) return;
    pg.guides.forEach((g, i) => {
      const el = document.createElement('div');
      const horizontal = g.axis === 'horizontal';
      el.className = 'rguide ' + (horizontal ? 'h' : 'v');
      el.dataset.guide = i;
      el.style[horizontal ? 'top' : 'left'] = g.pos + 'pt';
      el.title = (horizontal ? 'Horizontal' : 'Vertical') + ' ruler guide at ' + (g.pos / 72).toFixed(2) + '" — drag to move, drag off the page to remove';
      ov.appendChild(el);
    });
  };

  P.addGuide = function (n, axis, pos) {
    n = n ?? this.targetPage();
    if (n == null || !this.editable(n)) { this.app.setStatus('Click a page you are editing first.'); return Promise.resolve(false); }
    const { width: W, height: H } = this.pageSize();
    if (pos == null) pos = axis === 'horizontal' ? H / 2 : W / 2;
    pos = Math.max(0, Math.min(axis === 'horizontal' ? H : W, pos));
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      (pg.guides ||= []).push({ pos: r2(pos), axis });
    }).then(() => { this.drawGuides(n); this.app.setStatus('Ruler guide added. Drag it where you want it; drag it off the page to remove it.'); return true; });
  };

  P.clearGuides = function (n = this.targetPage()) {
    if (n == null || !this.editable(n)) return Promise.resolve(false);
    const pg = this.pageEntry(n);
    if (!pg || !(pg.guides || []).length) { this.app.setStatus('Page ' + n + ' has no ruler guides.'); return Promise.resolve(false); }
    return this.commit([n], () => { delete this.pageEntry(n).guides; }).then(() => { this.drawGuides(n); this.app.setStatus('Ruler guides cleared from page ' + n + '.'); return true; });
  };

  // a guide dragged on the page: moved, or removed when let go off the page
  P.beginGuideDrag = function (e, n, el) {
    if (!this.editable(n)) { this.app.setStatus('Page ' + n + ' belongs to the other half.'); return; }
    const pg = this.pageEntry(n);
    const i = Number(el.dataset.guide);
    const g = pg.guides && pg.guides[i];
    if (!g) return;
    e.preventDefault();
    this.select(n, null);
    this.drag = { n, mode: 'guide', i, axis: g.axis, el, cx: e.clientX, cy: e.clientY, started: false, pos: g.pos, off: false };
  };
  P.moveGuideDrag = function (e) {
    const d = this.drag;
    const p = this.ptOf(d.n, e);
    const { width: W, height: H } = this.pageSize();
    const horizontal = d.axis === 'horizontal';
    const raw = horizontal ? p.y : p.x;
    d.off = raw < -8 || raw > (horizontal ? H : W) + 8;
    d.pos = r2(Math.max(0, Math.min(horizontal ? H : W, Math.round(raw * 2) / 2)));
    d.el.style[horizontal ? 'top' : 'left'] = d.pos + 'pt';
    d.el.classList.toggle('removing', d.off);
    this.app.setStatus(d.off ? 'Let go to remove this ruler guide.' : (horizontal ? 'Horizontal' : 'Vertical') + ' ruler guide: ' + (d.pos / 72).toFixed(2) + '"');
  };
  P.endGuideDrag = function (d) {
    return this.commit([d.n], () => {
      const pg = this.pageEntry(d.n);
      if (!pg.guides) return;
      if (d.off) pg.guides.splice(d.i, 1); else pg.guides[d.i] = { ...pg.guides[d.i], pos: d.pos };
      if (!pg.guides.length) delete pg.guides;
    }).then(() => { this.drawGuides(d.n); this.app.setStatus(d.off ? 'Ruler guide removed.' : 'Ruler guide moved to ' + (d.pos / 72).toFixed(2) + '".'); });
  };

  // Page Design ▸ Page Background ▸ Background: a colour for the current page (null = none)
  P.setPageBackground = function (color, n = this.targetPage()) {
    if (n == null || !this.editable(n)) { this.app.setStatus('Click a page you are editing first.'); return Promise.resolve(false); }
    if (this.pageEntry(n).locked) { this.app.setStatus('Page ' + n + ' is locked.'); return Promise.resolve(false); }
    return this.commit([n], () => {
      const pg = this.pageEntry(n);
      if (color && color.toUpperCase() !== '#FFFFFF') pg.background = color.toUpperCase(); else delete pg.background;
    }).then(() => { this.app.setStatus(color ? 'Page ' + n + ' background: ' + color.toUpperCase() + '.' : 'Page ' + n + ' background removed.'); return true; });
  };
}
