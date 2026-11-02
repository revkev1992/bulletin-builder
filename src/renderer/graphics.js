// View ▸ Show ▸ Graphics Manager (Publisher's task pane): every picture in the week — where it is,
// its printed size, its pixels and the resolution that gives, and the ones that are missing or too
// small to print well. Click a row to go to the picture. Read-only.
const LOW_DPI = 150;      // below this a photo prints visibly soft on the Toshiba
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class GraphicsPane {
  // app: { week(), editor(), goTo(n, id) }
  constructor(app) {
    this.app = app;
    this.el = document.createElement('aside');
    this.el.id = 'gmpane';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="fp-head"><span>Graphics Manager</span><button type="button" class="gm-close" title="Close">✕</button></div>' +
      '<div class="gm-sum"></div><div class="gm-list"></div>';
    document.getElementById('body').appendChild(this.el);
    this.el.querySelector('.gm-close').onclick = () => this.set(false);
    this.sizes = new Map();   // asset url -> { w, h } | null (missing)
  }

  get shown() { return !this.el.hidden; }

  set(on) {
    this.el.hidden = !on;
    const b = document.getElementById('gm-btn');
    if (b) b.checked = on;
    if (on) this.refresh();
  }

  // every picture: page objects (groups included), in-line pictures in text, and parked items
  pictures() {
    const week = this.app.week();
    const out = [];
    if (!week) return out;
    const visit = (f, where, id) => {
      if (f.kind === 'image') out.push({ ...where, id: id || f.id, asset: f.image && f.image.asset, missing: f.image && f.image.missing, w: f.w, h: f.h, crop: (f.image && f.image.crop) || [0, 0, 0, 0], low: f.image && f.image.matchConfidence === 'low' });
      if (f.text) for (const p of f.text.paragraphs) if (p.picture) out.push({ ...where, id: id || f.id, asset: p.picture.asset, w: p.picture.w, h: p.picture.h, crop: [0, 0, 0, 0], inline: true });
      (f.children || []).forEach((c) => visit(c, where, id || f.id));
    };
    for (const p of week.manifest.pages) {
      const half = week.halves[p.half];
      const pg = half && half.pages[String(p.number)];
      if (pg) for (const f of pg.frames) visit(f, { page: p.number, half: p.half });
    }
    for (const [hn, half] of Object.entries(week.halves)) for (const f of half.pasteboard || []) visit(f, { page: null, half: hn, parked: true });
    return out;
  }

  measure(url) {
    if (this.sizes.has(url)) return Promise.resolve(this.sizes.get(url));
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { this.sizes.set(url, { w: im.naturalWidth, h: im.naturalHeight }); res(this.sizes.get(url)); };
      im.onerror = () => { this.sizes.set(url, null); res(null); };
      im.src = url;
    });
  }

  async refresh() {
    if (!this.shown) return;
    const week = this.app.week();
    const list = this.el.querySelector('.gm-list');
    const sum = this.el.querySelector('.gm-sum');
    if (!week) { list.innerHTML = ''; sum.textContent = 'No week is open.'; return; }
    const pics = this.pictures();
    const rows = [];
    let lowRes = 0, missing = 0;
    for (const p of pics) {
      const url = p.asset ? new URL(p.asset, week.baseUrl).href : null;
      const nat = url ? await this.measure(url) : null;
      const [l, t, r, b] = p.crop;
      // the printed box shows (1-l-r) of the picture's width: pixels per printed inch
      const dpi = nat && p.w ? Math.round(nat.w * Math.max(0.01, 1 - l - r) / (p.w / 72)) : null;
      const bad = !nat;
      const soft = dpi != null && dpi < LOW_DPI;
      if (bad) missing++; else if (soft) lowRes++;
      const name = p.asset ? decodeURIComponent(p.asset.replace(/^assets\//, '')) : (p.missing || 'missing picture');
      rows.push({ p, url, nat, dpi, bad, soft, name });
    }
    sum.innerHTML = pics.length + ' picture' + (pics.length === 1 ? '' : 's') +
      (missing ? ' · <span class="warn">' + missing + ' missing</span>' : '') + (lowRes ? ' · <span class="warn">' + lowRes + ' low resolution (under ' + LOW_DPI + ' dpi)</span>' : '');
    list.innerHTML = rows.map((x, i) => '<button type="button" class="gm-row' + (x.bad ? ' bad' : x.soft ? ' soft' : '') + '" data-i="' + i + '">' +
      (x.url && !x.bad ? '<img src="' + esc(x.url) + '" alt="">' : '<span class="gm-noimg">?</span>') +
      '<span class="gm-text"><b>' + esc(x.name) + '</b>' +
      '<small>' + (x.p.parked ? 'Scratch area (' + x.p.half + ')' : 'Page ' + x.p.page + (x.p.inline ? ', in the text' : '')) + ' · ' + (x.p.w / 72).toFixed(2) + ' × ' + (x.p.h / 72).toFixed(2) + ' in</small>' +
      '<small>' + (x.bad ? '<span class="warn">Picture file missing</span>' : x.nat.w + ' × ' + x.nat.h + ' px · ' + x.dpi + ' dpi' + (x.soft ? ' <span class="warn">— low, prints soft</span>' : '')) +
      (x.p.low ? ' · <span class="warn">check picture</span>' : '') + '</small></span></button>').join('') || '<p class="gm-empty">No pictures in this week.</p>';
    for (const b of list.querySelectorAll('.gm-row')) b.onclick = () => { const x = rows[Number(b.dataset.i)]; if (x.p.page != null) this.app.goTo(x.p.page, x.p.id); };
  }
}
