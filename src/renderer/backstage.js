// File ▸ Backstage, laid out like Publisher's: a left rail (Home, New, Open | Info, Save, Save As,
// Print, Share, Export, Close … Account, Options) and a page to its right.
import { icon } from './ribbon.js';

const RAIL = [
  ['home', 'Home', 'home'], ['new', 'New', 'page'], ['open', 'Open', 'open'], null,
  ['info', 'Info', 'info'], ['save', 'Save', 'save'], ['saveas', 'Save As', 'saveas'], ['print', 'Print', 'print'],
  ['share', 'Share', 'share'], ['export', 'Export', 'export'], ['close', 'Close', 'close'],
];
const RAIL_BOTTOM = [['account', 'Account', 'info'], ['options', 'Options', 'options']];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Backstage {
  // api: { week(), file(), open(file), choose(), save(), newWeek(), exportPdf(), print(), closeWindow(), info(), version }
  constructor(el, api) {
    this.el = el;
    this.api = api;
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
  }

  show(pane = 'home') {
    const rail = (list) => list.map((r) => r ? '<button type="button" class="bs-item" data-pane="' + r[0] + '">' + icon(r[2], 18) + '<span>' + r[1] + '</span></button>'
      : '<div class="bs-sep"></div>').join('');
    this.el.innerHTML = '<aside class="bs-rail"><button type="button" class="bs-back" title="Back (Esc)">' + icon('back', 28) + '</button>' +
      rail(RAIL) + '<div class="bs-spacer"></div>' + rail(RAIL_BOTTOM) + '</aside><section class="bs-page"></section>';
    this.el.hidden = false;
    this.el.querySelector('.bs-back').onclick = () => this.hide();
    for (const b of this.el.querySelectorAll('.bs-item')) b.onclick = () => this.pane(b.dataset.pane);
    this.pane(pane);
    this.el.querySelector('.bs-back').focus();
  }

  hide() { this.el.hidden = true; this.el.innerHTML = ''; }

  async pane(name) {
    for (const b of this.el.querySelectorAll('.bs-item')) b.classList.toggle('active', b.dataset.pane === name);
    const page = this.el.querySelector('.bs-page');
    const week = this.api.week();
    const file = this.api.file();
    const run = async (fn) => { this.hide(); await fn(); };
    switch (name) {
      case 'home':
      case 'new': {
        const h = new Date().getHours();
        const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        page.innerHTML = (name === 'home' ? '<h1>' + hello + '</h1>' : '<h1>New</h1>') +
          '<h2>New</h2><div class="bs-tiles">' +
          '<button type="button" class="bs-tile" id="bs-newweek"' + (file ? '' : ' disabled') + '>' + icon('newweek', 56) + '<span>New Week from This One</span></button>' +
          '<button type="button" class="bs-tile todo" disabled title="Coming soon">' + icon('page', 56) + '<span>Blank 8.5 x 11"</span></button>' +
          '<button type="button" class="bs-tile todo" disabled title="Coming soon">' + icon('size', 56) + '<span>More Blank Page Sizes</span></button></div>' +
          (name === 'home' ? '<h2>Recent</h2><div class="bs-recent"></div>' : '');
        page.querySelector('#bs-newweek').onclick = () => run(this.api.newWeek);
        if (name === 'home') await this.recent(page.querySelector('.bs-recent'));
        break;
      }
      case 'open':
        page.innerHTML = '<h1>Open</h1><div class="bs-actions"><button type="button" class="bs-action" id="open">' + icon('open', 32) +
          '<span>Browse…</span></button></div><h2>Recent</h2><div class="bs-recent"></div>';
        page.querySelector('#open').onclick = () => run(async () => { const f = await this.api.choose(); if (f) await this.api.open(f); });
        await this.recent(page.querySelector('.bs-recent'));
        break;
      case 'info': {
        const i = this.api.info();
        page.innerHTML = '<h1>Info</h1>' + (week ? '<table class="bs-info">' +
          '<tr><th>Week</th><td>' + esc(week.manifest.title) + '</td></tr>' +
          '<tr><th>Location</th><td>' + esc(file) + ' <button type="button" id="bs-reveal">Open file location</button></td></tr>' +
          '<tr><th>Pages</th><td>' + week.manifest.pages.length + ' (' + i.halves + ')</td></tr>' +
          '<tr><th>Editing</th><td>' + esc(i.editing) + '</td></tr>' +
          '<tr><th>Fonts used</th><td>' + esc(i.fonts.join(', ')) + '</td></tr>' +
          '<tr><th>Fonts missing on this PC</th><td>' + (i.missing.length ? '<span class="warn">' + esc(i.missing.join(', ')) + '</span>' : 'none') + '</td></tr>' +
          '</table>' : '<p>No week is open.</p>');
        const r = page.querySelector('#bs-reveal');
        if (r) r.onclick = () => window.bb.reveal(file);
        break;
      }
      case 'save':
        return run(this.api.save);
      case 'print':
        page.innerHTML = '<h1>Print</h1><div class="bs-actions"><button type="button" class="bs-action" id="bs-print"' + (file ? '' : ' disabled') + '>' + icon('print', 40) +
          '<span>Print</span></button></div><p class="bs-note">Prints the saved week, every page in reading order, at its real size ' +
          '(choose the printer, copies and two-sided printing in the next window). Save first if you have changes. ' +
          'Booklet imposition and a sheet preview are not built yet.</p>';
        page.querySelector('#bs-print').onclick = () => run(this.api.print);
        break;
      case 'export':
        page.innerHTML = '<h1>Export</h1><div class="bs-actions"><button type="button" class="bs-action" id="bs-pdf"' + (file ? '' : ' disabled') + '>' + icon('pdf', 40) +
          '<span>Create PDF</span></button></div><p class="bs-note">Every page at its real size, ready to print or email. Your changes are saved first.</p>';
        page.querySelector('#bs-pdf').onclick = () => run(this.api.exportPdf);
        break;
      case 'close':
        return run(this.api.closeWindow);
      case 'account':
        page.innerHTML = '<h1>Account</h1><p>Bulletin Builder ' + esc(this.api.version || '') + '</p><p class="bs-note">Updates install automatically when you start the app.</p>';
        break;
      default:
        page.innerHTML = '<h1>' + esc({ saveas: 'Save As', share: 'Share', options: 'Options' }[name] || name) + '</h1><p class="bs-note">Coming soon — not built yet.</p>';
    }
  }

  async recent(box) {
    const list = await window.bb.recent();
    if (!list.length) { box.innerHTML = '<p class="bs-note">Weeks you open will be listed here.</p>'; return; }
    box.innerHTML = '<div class="bs-recent-head"><span>Name</span><span>Last opened</span></div>' + list.map((r, i) =>
      '<button type="button" class="bs-recent-row" data-i="' + i + '"' + (r.exists ? '' : ' disabled title="This week has been moved or deleted"') + '>' +
      icon('file', 28) + '<span class="bs-recent-name"><b>' + esc(r.title) + '</b><small>' + esc(r.file) + '</small></span>' +
      '<span class="bs-recent-when">' + esc(when(r.at)) + '</span></button>').join('');
    for (const b of box.querySelectorAll('.bs-recent-row')) {
      b.onclick = async () => { const r = list[+b.dataset.i]; this.hide(); await this.api.open(r.file); };
    }
  }
}

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const days = Math.floor((Date.now() - d) / 864e5);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}
