// Show Formatting (Publisher's "Special Characters", Ctrl+Shift+Y — Kevin 2026-10-27): a dot for each
// space, ¶ at each paragraph end, an arrow for each tab, ↵ for each line break, and the text box
// breaks. One switch, at the top right of the ribbon (every tab) and on Home ▸ Paragraph; remembered
// on this PC. Never printed, and nothing moves: ¶, the arrows and the break labels are CSS that takes
// no room (styles.css, body.show-marks), and the space dots and ↵ are drawn on a see-through layer
// over each page, placed from where the browser actually set the text.
const KEY = 'bb.marks';

export class Marks {
  constructor(stage) {
    this.stage = stage;
    this.dirty = new Set();
    this.timer = 0;
    let on = false;
    try { on = localStorage.getItem(KEY) === '1'; } catch (_) { /* off */ }
    this.on = false;
    this.observer = new MutationObserver((list) => {
      for (const m of list) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!t || t.closest('.marks-layer')) continue;
        if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every((n) => n.classList && n.classList.contains('marks-layer'))) continue;
        const pg = t.closest('.page');
        if (pg) this.dirty.add(pg);
        else for (const p of (t.querySelectorAll ? t.querySelectorAll('.page') : [])) this.dirty.add(p);
      }
      this.later();
    });
    this.set(on);
  }

  set(on) {
    this.on = !!on;
    document.body.classList.toggle('show-marks', this.on);
    try { localStorage.setItem(KEY, this.on ? '1' : '0'); } catch (_) { /* not kept */ }
    if (this.on) {
      this.observer.observe(this.stage, { childList: true, subtree: true, characterData: true });
      this.refresh();
    } else {
      this.observer.disconnect();
      clearTimeout(this.timer);
      this.dirty.clear();
      for (const l of this.stage.querySelectorAll('.marks-layer')) l.remove();
    }
    for (const b of document.querySelectorAll('.marks-btn')) { b.classList.toggle('active', this.on); b.setAttribute('aria-pressed', String(this.on)); }
  }

  toggle() { this.set(!this.on); }

  later() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const pages = [...this.dirty];
      this.dirty.clear();
      for (const pg of pages) if (pg.isConnected) this.draw(pg);
    }, 120);
  }

  refresh() {
    if (!this.on) return;
    for (const pg of this.stage.querySelectorAll('.page')) this.draw(pg);
  }

  draw(pg) {
    if (!this.on) return;
    pg.querySelectorAll(':scope > .marks-layer').forEach((l) => l.remove());
    const box = pg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const layer = document.createElement('div');
    layer.className = 'marks-layer';
    const at = (x, y) => ({ left: ((x - box.left) / box.width * 100).toFixed(3) + '%', top: ((y - box.top) / box.height * 100).toFixed(3) + '%' });
    const range = document.createRange();
    const frag = document.createDocumentFragment();
    for (const p of pg.querySelectorAll('p.para')) {
      const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('.brk') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const s = t.data;
        // (typing makes some spaces non-breaking for a moment: they are dots too)
        for (let i = 0; i < s.length; i++) {
          if (s[i] !== ' ' && s[i] !== ' ') continue;
          range.setStart(t, i); range.setEnd(t, i + 1);
          const r = range.getBoundingClientRect();
          if (!r.width) continue;                 // a space swallowed at a line end
          const d = document.createElement('i');
          d.className = 'mk-dot';
          Object.assign(d.style, at(r.left + r.width / 2, r.top + r.height * 0.55));
          frag.appendChild(d);
        }
      }
      for (const br of p.querySelectorAll('br')) {
        range.selectNode(br);
        const r = range.getBoundingClientRect();
        if (!r.height) continue;
        const d = document.createElement('i');
        d.className = 'mk-br';
        d.textContent = '↵';
        Object.assign(d.style, at(r.left, r.top + r.height * 0.55));
        frag.appendChild(d);
      }
    }
    layer.appendChild(frag);
    pg.appendChild(layer);
  }
}
