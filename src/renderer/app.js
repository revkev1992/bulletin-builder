import { renderPage, renderPasteboard, layoutTabs, layoutWraps, findOverflow, fontsUsed, missingFonts } from './render.js';
import { Editor } from './editor.js';
import { isFlow, layoutFlow, flowHash } from './flow.js';
import { FlowPanel } from './flowpanel.js';
import { buildRibbon, onFileTab, selectTab, setContextual, syncMirrors, setLabel } from './ribbon.js';
import { Backstage } from './backstage.js';
import { insertPageDialog, movePageDialog, deletePageDialog, paragraphDialog, modal } from './pagedialogs.js';
import { paragraphSettings, captureFormat, applyFormat, currentParagraph } from './textedit.js';
import { galleryHtml, normStyle, styleFromPara } from './styles-gallery.js';
import { Rulers } from './ruler.js';
import { FindPane } from './findreplace.js';

const params = new URLSearchParams(location.search);
const PRINT = params.get('mode') === 'print';
const $ = (id) => document.getElementById(id);
if (!PRINT) buildRibbon($('toolbar'));

let week = null;
window.__bbWeek = () => week;   // debug aid (--eval)
let weekFile = null;
let zoom = 1;
let showingPasteboard = false;
const shells = new Map(); // page number -> .page-shell element
let editor = null;

// Reader spreads, as Publisher shows them: 1 alone on the right, then 2|3, 4|5 … and the last
// page alone on the left.
function spreadsOf(numbers) {
  const out = [[null, numbers[0]]];
  for (let i = 1; i < numbers.length; i += 2) out.push([numbers[i], numbers[i + 1] ?? null]);
  return out;
}

function setStatus(html) { $('status').innerHTML = html; }

async function settle(root) {
  await document.fonts.ready;
  // let images and fonts finish before measuring anything
  await Promise.all([...root.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
  layoutTabs(root, week.manifest.defaultTabStop || 36);
  layoutWraps(root);
  layoutTabs(root, week.manifest.defaultTabStop || 36); // lines may have moved
  return findOverflow(root);
}

function marginGuide(pageEl, n) {
  const m = week.manifest.margins || {};
  const g = document.createElement('div');
  g.className = 'margin-guide';
  // mirrored margins: inside edge is on the left of a right-hand (odd) page
  const odd = n % 2 === 1;
  const inside = m.inside ?? 36, outside = m.outside ?? 36;
  Object.assign(g.style, {
    top: m.top + 'pt', bottom: m.bottom + 'pt',
    left: (odd ? inside : outside) + 'pt', right: (odd ? outside : inside) + 'pt',
  });
  pageEl.appendChild(g);
}

// a page on screen = shell (not clipped) > page (clipped, exactly what prints) + overlay (selection)
function buildShell(n) {
  const shell = document.createElement('div');
  shell.className = 'page-shell';
  shell.dataset.page = n;
  const pg = renderPage(week, n);
  marginGuide(pg, n);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  shell.append(pg, ov);
  shell.addEventListener('pointerdown', (e) => editor && editor.onDown(e, n));
  shell.addEventListener('dblclick', (e) => editor && editor.onDblClick(e, n));
  shells.set(n, shell);
  return shell;
}

async function rerender(nums) {
  const touched = [];
  for (const n of nums) {
    const shell = shells.get(n);
    if (!shell) continue;
    const old = shell.querySelector('.page');
    const pg = renderPage(week, n);
    marginGuide(pg, n);
    old.replaceWith(pg);
    touched.push(pg);
  }
  for (const pg of touched) await settle(pg);
  thumbsLater(nums);
  refreshStatusCounts();
  if (editor && editor.panel && editor.panel.active()) editor.panel.highlight(editor.panel.tab === 'order' ? editor.panel.selId : null);
}

let baseStatus = '';
function refreshStatusCounts() {
  const over = document.querySelectorAll('#stage .frame.overflow').length;
  const bits = [baseStatus];
  if (over) bits.push('<span class="warn">' + over + ' text frame(s) overflow</span>');
  const wh = week && week.halves.worship;
  const fo = isFlow(wh) && wh.layout ? (wh.layout.overflowBlocks || []).length : 0;
  if (fo) bits.push('<span class="warn">' + fo + ' worship block(s) do not fit the worship pages</span>');
  $('counts').innerHTML = bits.filter(Boolean).join(' · ');
}

async function showSpreads() {
  const stage = $('stage');
  stage.innerHTML = '';
  shells.clear();
  showingPasteboard = false;
  $('pasteboard-btn').checked = false;
  const { width, height } = week.manifest.page;
  const numbers = week.manifest.pages.map((p) => p.number);
  const wrap = document.createElement('div');
  wrap.className = 'spreads';
  wrap.style.setProperty('--page-w', width + 'pt');
  wrap.style.setProperty('--page-h', height + 'pt');
  const nav = $('nav-pages');
  nav.innerHTML = '';
  nav.style.setProperty('--thumb-ratio', String(width / height));
  for (const pair of spreadsOf(numbers)) {
    const label = pair.filter(Boolean).join('–');
    const sw = document.createElement('section');
    sw.className = 'spread-wrap';
    sw.id = 'spread-' + label;
    sw.innerHTML = '<div class="spread-label">Page ' + label + '</div>';
    const spread = document.createElement('div');
    spread.className = 'spread';
    for (const n of pair) {
      if (n == null) {
        const blank = document.createElement('div');
        blank.className = 'slot blank';
        spread.appendChild(blank);
        continue;
      }
      spread.appendChild(buildShell(n));
    }
    sw.appendChild(spread);
    wrap.appendChild(sw);

    // Pages pane, as Publisher: a thumbnail per page, paired in spreads, number underneath
    const row = document.createElement('div');
    row.className = 'nav-spread';
    for (const n of pair) {
      const cell = document.createElement('div');
      cell.className = 'nav-page' + (n == null ? ' blank' : '');
      if (n != null) {
        const h = week.manifest.pages.find((p) => p.number === n).half;
        cell.dataset.page = n;
        cell.title = 'Page ' + n + ' (' + h + ')';
        cell.innerHTML = '<div class="nav-thumb half-' + h + '"></div><div class="nav-num">' + n + '</div>';
        cell.addEventListener('click', () => goToPage(n));
        cell.addEventListener('contextmenu', (e) => { e.preventDefault(); goToPage(n); pageMenu(e.clientX, e.clientY, n); });
      }
      row.appendChild(cell);
    }
    nav.appendChild(row);
  }
  stage.appendChild(wrap);
  await settle(wrap);
  refreshThumbs();
  applyZoom();
  const missing = missingFonts(fontsUsed(week));
  const bits = [week.manifest.pages.length + ' pages'];
  if (missing.length) bits.push('<span class="warn">Fonts not installed on this PC: ' + missing.join(', ') + ' (a substitute is shown)</span>');
  const low = wrap.querySelectorAll('[data-low-confidence]').length;
  if (low) bits.push(low + ' picture(s) to check');
  baseStatus = bits.join(' · ');
  refreshStatusCounts();
  if (editor) editor.drawSelection();
}

// ---------------------------------------------------------------- Pages pane (thumbnails + right-click)
const THUMB_W = 46;   // px
function refreshThumbs(nums) {
  if (!week) return;
  const { width } = week.manifest.page;
  const scale = THUMB_W / (width * 96 / 72);
  for (const cell of document.querySelectorAll('#nav-pages .nav-page[data-page]')) {
    const n = Number(cell.dataset.page);
    if (nums && !nums.includes(n)) continue;
    const src = shells.get(n) && shells.get(n).querySelector('.page');
    const box = cell.querySelector('.nav-thumb');
    if (!src || !box) continue;
    const c = src.cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    c.querySelectorAll('.margin-guide, .editing').forEach((x) => x.classList.contains('margin-guide') ? x.remove() : x.classList.remove('editing'));
    // a picture only: nothing in it may be found by code looking for pages, frames or lines
    for (const x of [c, ...c.querySelectorAll('*')]) {
      for (const a of [...x.attributes]) if (a.name === 'id' || a.name.startsWith('data-')) x.removeAttribute(a.name);
    }
    c.className = 'thumb-page';
    c.style.transform = 'scale(' + scale + ')';
    box.replaceChildren(c);
  }
}
let thumbTimer = null;
const thumbsLater = (nums) => { clearTimeout(thumbTimer); thumbTimer = setTimeout(() => refreshThumbs(nums), 400); };

function goToPage(n, { scroll = true } = {}) {
  if (!editor) return;
  if (editor.textEdit) editor.endTextEdit();
  editor.select(n, null);
  const sh = shells.get(n);
  if (scroll && sh) sh.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateToolbar();
}

// Publisher's right-click menu on a page in the Pages pane
function pageMenu(x, y, n) {
  document.querySelectorAll('.ctx-menu').forEach((m) => m.remove());
  const own = editor.half && (week.manifest.pages.find((p) => p.number === n) || {}).half === editor.half;
  const why = !editor.half ? 'Choose which pages you are changing first (Bulletin ▸ I am changing)'
    : 'Page ' + n + ' belongs to the other half of the bulletin';
  const items = [
    ['Insert Page…', 'insert', !!editor.half], ['Insert Blank Page', 'blank', !!editor.half], ['Insert Duplicate Page', 'dup', !!editor.half],
    null, ['Delete Page', 'delete', own], ['Move Page…', 'move', own], ['Rename…', null, false],
  ];
  const m = document.createElement('div');
  m.className = 'ctx-menu';
  for (const it of items) {
    if (!it) { m.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' })); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cmd = it[1] || '';
    b.textContent = it[0];
    b.disabled = !it[2];
    b.title = it[1] == null ? 'Coming soon — not built yet' : it[2] ? '' : why;
    b.onclick = () => { m.remove(); pageCommand(it[1]); };
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
}
// a right-click menu: items are { label, cmd, run, on, tip } or null (separator)
function showMenu(x, y, items, cls = '') {
  document.querySelectorAll('.ctx-menu').forEach((m) => m.remove());
  const m = document.createElement('div');
  m.className = 'ctx-menu ' + cls;
  m.addEventListener('mousedown', (e) => e.preventDefault());   // keep the caret / text selection
  for (const it of items) {
    if (!it) { m.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' })); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cmd = it.cmd || '';
    b.textContent = it.label;
    b.disabled = !it.on;
    if (it.tip) b.title = it.tip;
    b.onclick = () => { m.remove(); it.run(); };
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(0, Math.min(x, innerWidth - r.width - 4)) + 'px';
  m.style.top = Math.max(0, Math.min(y, innerHeight - r.height - 4)) + 'px';
  return m;
}

// Publisher's right-click menus on the page: in text, on an object, or on the empty page
async function pageContextMenu(e) {
  const shellEl = e.target.closest('.page-shell');
  if (!shellEl || !week) return;
  e.preventDefault();
  const n = Number(shellEl.dataset.page);
  const ed = editor;
  const flow = ed.editingFlow();
  const can = !!ed.half && ed.editable(n);
  const cmd = (c) => () => ed.command(c);
  if (flow && flow.closest('.frame').contains(e.target)) {
    const sel = window.getSelection();
    const has = sel.rangeCount && !sel.isCollapsed;
    showMenu(e.clientX, e.clientY, [
      { label: 'Cut', cmd: 'text-cut', on: has, run: () => window.bb.edit('cut') },
      { label: 'Copy', cmd: 'text-copy', on: has, run: () => window.bb.edit('copy') },
      { label: 'Paste', cmd: 'text-paste', on: true, run: () => window.bb.edit('paste') },
      null,
      { label: 'Paragraph…', cmd: 'paragraph', on: true, run: () => $('t-paradlg').click() },
      { label: 'Tabs…', cmd: 'tabs', on: true, run: () => window.__bbRulers.tabsDialog() },
      { label: 'Styles…', cmd: 'styles', on: true, run: () => $('rb-styles').click() },
      null,
      { label: 'Format Text Box…', cmd: 'format', on: true, run: () => selectTab('format') },
    ], 'ctx-text');
    return;
  }
  const fr = e.target.closest('.frame');
  const top = fr && ed.topFrame(n, fr.dataset.id);
  if (top && !top.generated && can) {
    if (!(ed.sel && ed.sel.page === n && (ed.sel.id === top.id || ed.multi.includes(top.id)))) {
      if (ed.textEdit) await ed.endTextEdit();
      ed.select(n, top.id);
    }
    const f = ed.frame();
    const locked = ed.locked(n, f);
    const several = ed.multi.length > 0;
    const pic = f.kind === 'image';
    showMenu(e.clientX, e.clientY, [
      { label: 'Cut', cmd: 'cut', on: !locked, run: cmd('cut') },
      { label: 'Copy', cmd: 'copy', on: true, run: cmd('copy') },
      { label: 'Paste', cmd: 'paste', on: !!ed.clipboard, run: cmd('paste') },
      null,
      { label: 'Delete Object', cmd: 'delete', on: !locked, run: cmd('delete') },
      null,
      { label: 'Bring to Front', cmd: 'front', on: !locked, run: cmd('front') },
      { label: 'Send to Back', cmd: 'back', on: !locked, run: cmd('back') },
      { label: several ? 'Group' : 'Ungroup', cmd: several ? 'group' : 'ungroup', on: several || f.kind === 'group', run: cmd(several ? 'group' : 'ungroup') },
      { label: f.locked ? 'Unlock' : 'Lock', cmd: 'lock-frame', on: true, run: cmd('lock-frame') },
      ...(pic ? [null, { label: 'Crop', cmd: 'crop', on: !locked, run: cmd('crop') }, { label: 'Fit', cmd: 'fit', on: !locked, run: cmd('fit') },
        { label: 'Fill', cmd: 'fill', on: !locked, run: cmd('fill') }] : []),
      null,
      { label: pic ? 'Format Picture…' : f.kind === 'text' ? 'Format Text Box…' : 'Format Shape…', cmd: 'format', on: true, run: () => selectTab('format') },
    ], 'ctx-object');
    return;
  }
  // the empty page (or a laid-out line)
  if (ed.textEdit) await ed.endTextEdit();
  ed.select(n, null);
  updateToolbar();
  const own = can;
  showMenu(e.clientX, e.clientY, [
    { label: 'Paste', cmd: 'paste', on: can && !!ed.clipboard, run: cmd('paste') },
    { label: 'Select All', cmd: 'select-all', on: can, run: cmd('select-all') },
    null,
    { label: 'Insert Page…', cmd: 'insert', on: !!ed.half, run: () => pageCommand('insert') },
    { label: 'Insert Duplicate Page', cmd: 'dup', on: !!ed.half, run: () => pageCommand('dup') },
    { label: 'Delete Page', cmd: 'delete-page', on: own, run: () => pageCommand('delete') },
    { label: 'Move Page…', cmd: 'move', on: own, run: () => pageCommand('move') },
  ], 'ctx-page');
}

document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.ctx-menu')) document.querySelectorAll('.ctx-menu').forEach((m) => m.remove()); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.ctx-menu').forEach((m) => m.remove()); });

async function showPasteboard() {
  const stage = $('stage');
  const half = editor && editor.half;
  const target = half && editor.targetPage();
  stage.innerHTML = '<h3 class="pasteboard-title">Pasteboard — parked items (never printed)' +
    (half ? ' · <b>Place</b> puts an item in the middle of page ' + (target ?? '—') + ' (the page you last clicked)' : ' · choose Edit to place items') + '</h3>';
  shells.clear();
  const wrap = document.createElement('div');
  wrap.className = 'spreads pb-cards';
  let count = 0;
  for (const [h, body] of Object.entries(week.halves)) {
    for (const f of body.pasteboard || []) {
      count++;
      const card = document.createElement('div');
      card.className = 'pb-card';
      const mini = renderPasteboard({ ...week, halves: { [h]: { pages: {}, pasteboard: [f] } } });
      const scale = Math.min(1, 180 / Math.max(f.w, f.h, 1));
      mini.style.transform = 'scale(' + scale + ')';
      mini.style.transformOrigin = 'top left';
      const box = document.createElement('div');
      box.className = 'pb-thumb';
      box.style.width = (f.w + 72) * scale + 'pt';
      box.style.height = (f.h + 72) * scale + 'pt';
      box.appendChild(mini);
      card.appendChild(box);
      const label = document.createElement('div');
      label.className = 'pb-label';
      label.textContent = (f.source && f.source.name) || f.kind;
      card.appendChild(label);
      if (half === h) {
        const b = document.createElement('button');
        b.textContent = 'Place on page ' + (target ?? '—');
        b.disabled = target == null;
        b.onclick = async () => { await showSpreads(); await editor.placeFromPasteboard(f.id, target); };
        card.appendChild(b);
      }
      wrap.appendChild(card);
    }
  }
  if (!count) wrap.textContent = 'The pasteboard is empty.';
  stage.appendChild(wrap);
  await settle(wrap);
  showingPasteboard = true;
  $('pasteboard-btn').checked = true;
}

// Publisher keeps the spot you are looking at in the middle of the window when you zoom
function applyZoom() {
  const w = document.querySelector('.spreads');
  const stage = $('stage');
  const old = w ? Number(w.style.getPropertyValue('--zoom')) || zoom : zoom;
  const pad = 32;
  const cx = stage.scrollLeft + stage.clientWidth / 2 - pad, cy = stage.scrollTop + stage.clientHeight / 2 - pad;
  if (w) w.style.setProperty('--zoom', zoom);
  if (w && old && old !== zoom) {
    const r = zoom / old;
    stage.scrollLeft = cx * r + pad - stage.clientWidth / 2;
    stage.scrollTop = cy * r + pad - stage.clientHeight / 2;
  }
  $('zoom-label').textContent = Math.round(zoom * 100) + '%';
  if (window.__bbRulers) window.__bbRulers.update();
}

function zoomBy(factor) {
  if (!week) return;
  if (factor === -1) {
    // page width: the two pages of a spread fill the width of the window
    const { width } = week.manifest.page;
    zoom = ($('stage').clientWidth - 64) / (2 * width * 96 / 72);
  } else if (factor === 0) {
    // whole spread: fit two pages side by side into the stage
    const stage = $('stage');
    const { width, height } = week.manifest.page;
    const pxPerPt = 96 / 72;
    zoom = Math.min((stage.clientWidth - 64) / (2 * width * pxPerPt), (stage.clientHeight - 90) / (height * pxPerPt));
  } else {
    zoom = Math.min(4, Math.max(0.2, zoom * factor));
  }
  applyZoom();
}

async function open(file) {
  try {
    week = await window.bb.loadWeek(file);
    weekFile = file;
  } catch (err) {
    setStatus('<span class="warn">' + String(err.message || err) + '</span>');
    return;
  }
  await ensureLayout();
  document.title = 'Bulletin Builder — ' + week.manifest.title;
  if (PRINT) return printLayout();
  $('title').textContent = week.manifest.title;
  if (editor && editor.half) await editor.release();
  await showSpreads();
  zoomBy(0);
  updateToolbar();
}

async function reload() {
  week = await window.bb.loadWeek(weekFile);
  await ensureLayout();
  const keep = zoom;
  await showSpreads();
  zoom = keep;
  applyZoom();
}

// Flow-mode worship half whose saved layout is missing or stale (the flow changed, or the layout
// rules did): lay it out now, in memory. It is saved with the next save of the worship half.
async function ensureLayout() {
  const half = week && week.halves.worship;
  if (!isFlow(half)) return;
  if (half.layout && half.layout.flowHash === flowHash(week, half)) return;
  await layoutFlow(week, half);
}

// ---------------------------------------------------------------- toolbar state
const IN = 72;
function updateToolbar() {
  const half = editor && editor.half;
  $('mode').value = half || '';
  $('badge').textContent = half ? 'Editing ' + half : (week ? 'View only' : 'No week open');
  $('badge').className = half ? 'editing-' + half : '';
  $('save').disabled = !half;
  $('save').classList.toggle('dirty', !!(editor && editor.dirty));
  $('undo').disabled = !(half && editor.undo.length);
  $('redo').disabled = !(half && editor.redo.length);
  document.title = (editor && editor.dirty ? '• ' : '') + 'Bulletin Builder' + (week ? ' — ' + week.manifest.title : '');
  const lp = editor && (editor.sel ? editor.sel.page : editor.lastPage);
  const pg = lp != null && editor.pageEntry(lp);
  $('lock-page').disabled = !(half && lp != null && editor.editable(lp));
  $('lock-page').classList.toggle('active', !!(pg && pg.locked));
  setLabel('lock-page', pg && pg.locked ? 'Unlock Page ' + lp : 'Lock Page' + (lp != null ? ' ' + lp : ''));
  for (const id of ['ins-text', 'ins-picture', 'ins-line', 'ins-rect', 'rb-paste', 'pg-blank', 'pg-dup', 'pg-insert', 'pg-delete', 'pg-move']) $(id).disabled = !half;
  $('rb-newweek').disabled = !week;
  for (const c of document.querySelectorAll('#nav-pages .nav-page[data-page]')) c.classList.toggle('current', Number(c.dataset.page) === lp);
  if (window.__bbRulers) window.__bbRulers.update();
  syncMirrors();
}

function onSelection(info) {
  const has = !!info;
  for (const id of ['fx', 'fy', 'fw', 'fh']) $(id).disabled = !has || info.locked || !(editor && editor.half);
  $('lock-frame').disabled = !(has && editor.half);
  $('delete').disabled = !(has && editor.half && !info.locked);
  for (const id of ['front', 'back', 'to-pasteboard']) $(id).disabled = !(has && editor.half && !info.locked);
  const pic = has && editor.half && !info.locked && info.frame.kind === 'image';
  for (const id of ['crop', 'fit', 'fill']) $(id).disabled = !pic;
  $('crop').classList.toggle('active', !!(pic && editor.crop));
  $('lock-frame').classList.toggle('active', !!(has && info.frame.locked));
  setLabel('lock-frame', has && info.frame.locked ? 'Unlock' : 'Lock');
  for (const id of ['rb-copy', 'rb-cut']) $(id).disabled = !(has && editor.half && (id === 'rb-copy' || !info.locked));
  setContextual(has && editor.half ? (info.frame.kind === 'image' ? 'image' : info.frame.kind === 'text' ? 'text' : 'shape') : null);
  const can = !!(has && editor.half && !info.locked);
  for (const id of ['rb-wrap', 'rb-align', 'rb-rotate']) $(id).disabled = !can;
  $('rb-group').disabled = !(can && info.count >= 2);
  $('rb-ungroup').disabled = !(can && info.frame.kind === 'group' && info.count === 1);
  $('rb-columns').dataset.frameOk = can && info.frame.kind === 'text' ? '1' : '';
  $('rb-columns').disabled = !(editor.textEdit || (can && info.frame.kind === 'text'));
  $('rb-textbox-group').hidden = !(has && info.frame.kind === 'text');
  $('rb-linking-group').hidden = !(has && info.frame.kind === 'text');
  const lk = editor.linkState();
  $('lk-create').disabled = !lk.create; $('lk-break').disabled = !lk.brk; $('lk-prev').disabled = !lk.prev; $('lk-next').disabled = !lk.next;
  $('lk-create').classList.toggle('active', !!editor.linking);
  syncMirrors();
  if (has) {
    const f = info.frame;
    $('fx').value = (f.x / IN).toFixed(2);
    $('fy').value = (f.y / IN).toFixed(2);
    $('fw').value = (f.w / IN).toFixed(2);
    $('fh').value = (f.h / IN).toFixed(2);
  } else {
    for (const id of ['fx', 'fy', 'fw', 'fh']) $(id).value = '';
  }
}

function numericChange() {
  const f = editor.frame();
  if (!f) return;
  const v = (id) => parseFloat($(id).value) * IN;
  const box = { x: v('fx'), y: v('fy'), w: v('fw'), h: v('fh') };
  if (Object.values(box).some((x) => !Number.isFinite(x))) return onSelection({ frame: f, page: editor.sel.page });
  const sizeChanged = Math.abs(box.w - f.w) > 0.01 || Math.abs(box.h - f.h) > 0.01;
  if (sizeChanged) editor.setBox(box);
  else editor.moveBy(box.x - f.x, box.y - f.y);
}

// ---------------------------------------------------------------- print mode (PDF export)
async function printLayout() {
  document.body.classList.add('print');
  const { width, height } = week.manifest.page;
  const st = document.createElement('style');
  st.textContent = '@page { size: ' + width + 'pt ' + height + 'pt; margin: 0; }';
  document.head.appendChild(st);
  const stage = $('stage');
  stage.innerHTML = '';
  for (const p of week.manifest.pages) stage.appendChild(renderPage(week, p.number));
  const overflow = await settle(stage);
  return { missingFonts: missingFonts(fontsUsed(week)), overflow, fontsUsed: fontsUsed(week) };
}

// ---------------------------------------------------------------- File commands
async function newWeek() {
  if (!weekFile) return;
  if (editor.dirty && !(await editor.save())) return;
  try {
    const f = await window.bb.newWeekFrom(weekFile);
    if (f) { await open(f); setStatus('New week created from the previous one. Check the dates, Sunday name and every item.'); }
  } catch (err) {
    setStatus('<span class="warn">' + String(err.message || err) + '</span>');
  }
}

// File ▸ Save As (F12), as Publisher: the copy gets your unsaved changes, this week stays as last saved
async function saveAs() {
  if (!weekFile) return;
  if (editor.textEdit) await editor.endTextEdit();
  const half = editor.half;
  const pending = half && editor.dirty ? JSON.parse(JSON.stringify(week.halves[half])) : null;
  let nf;
  try {
    nf = await window.bb.saveAs(weekFile);
  } catch (err) {
    setStatus('<span class="warn">' + String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '</span>');
    return;
  }
  if (!nf) return;
  if (half) { editor.setDirty(false); await editor.release(); }    // nothing is written to the old week
  await open(nf);
  if (half && (await editor.claim(half)) && pending) {
    week.halves[half] = pending;
    await editor.save({ quiet: true });
    await reload();
  }
  updateToolbar();
  setStatus('Saved as ' + week.manifest.title + ' — you are now working in the copy.');
  return nf;
}
window.__bbSaveAs = saveAs;

// Export and Print render the SAVED week, so pending changes are saved first
async function savedFirst() {
  if (!weekFile) return false;
  if (editor.dirty && !(await editor.save())) return false;
  return true;
}
async function exportPdf() {
  if (!(await savedFirst())) return;
  setStatus('Creating PDF…');
  try {
    const out = await window.bb.exportPdf(weekFile);
    setStatus(out ? 'PDF saved: ' + out : '');
  } catch (err) { setStatus('<span class="warn">' + String(err.message || err) + '</span>'); }
}
async function printWeek() {
  if (!(await savedFirst())) return;
  setStatus('Preparing to print…');
  try {
    const r = await window.bb.print(weekFile);
    setStatus(r === 'printed' ? 'Sent to the printer.' : '');
  } catch (err) { setStatus('<span class="warn">' + String(err.message || err) + '</span>'); }
}
function weekInfo() {
  const halves = {};
  for (const p of week.manifest.pages) halves[p.half] = (halves[p.half] || 0) + 1;
  return {
    halves: Object.entries(halves).map(([h, n]) => n + ' ' + h).join(', '),
    editing: editor && editor.half ? 'You are changing the ' + editor.half + ' pages' : 'View only',
    fonts: fontsUsed(week), missing: missingFonts(fontsUsed(week)),
  };
}

// ---------------------------------------------------------------- pages (Insert ▸ Page, Page Design ▸ Pages)
// The "current page" is the one last clicked; it must belong to the half being changed for Delete
// and Move. The operation runs on disk in the main process (it renumbers both halves).
function currentPage() {
  const nums = week.manifest.pages.map((p) => p.number);
  const lp = editor.sel ? editor.sel.page : editor.lastPage;
  if (lp != null && nums.includes(lp)) return lp;
  const own = week.manifest.pages.find((p) => p.half === editor.half);
  return own ? own.number : nums[0];
}

async function runPageOp(op, { undoing = null } = {}) {
  if (editor.dirty && !(await editor.save())) return null;
  let r;
  try {
    r = await window.bb.pageOp(weekFile, editor.half, op);
  } catch (err) {
    setStatus('<span class="warn">' + String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '</span>');
    return null;
  }
  // a page change is one undo step: Undo puts back the whole week from the snapshot taken before it
  const step = JSON.stringify({ pageop: r.stamp, focus: currentPage() });
  if (undoing) undoing.push(step);
  else { editor.undo.push(step); editor.redo = []; }
  editor.sel = null;
  editor.lastPage = r.focus;
  await reload();
  updateToolbar();
  const shell = shells.get(r.focus);
  if (shell) shell.scrollIntoView({ block: 'center' });
  const what = { insert: op.count > 1 ? op.count + ' pages inserted' : 'Page inserted', delete: 'Page deleted', move: 'Page moved',
    restore: 'Page change ' + (undoing === editor.redo ? 'undone' : 'redone') }[op.type];
  setStatus(what + ' — now page ' + r.focus + ' of ' + r.pages + '.' + (r.warnings.length ? ' <span class="warn">' + r.warnings.join(' ') + '</span>' : ''));
  return r;
}

async function pageCommand(kind) {
  if (!week || !editor.half) { setStatus('Choose which pages you are changing first (Bulletin ▸ I am changing).'); return; }
  const cur = currentPage();
  const nums = week.manifest.pages.map((p) => p.number);
  const ownPage = (week.manifest.pages.find((p) => p.number === cur) || {}).half === editor.half;
  if ((kind === 'delete' || kind === 'move') && !ownPage) {
    setStatus('<span class="warn">Page ' + cur + ' belongs to the other half. Click one of the ' + editor.half + ' pages first.</span>');
    return;
  }
  let op = null;
  if (kind === 'blank') op = { type: 'insert', ref: cur, where: 'after', count: 1 };
  else if (kind === 'dup') op = { type: 'insert', ref: cur, where: 'after', count: 1, duplicate: cur };
  else if (kind === 'insert') op = await insertPageDialog(cur, nums, week.manifest.preset);
  else if (kind === 'move') op = await movePageDialog(cur, nums);
  else if (kind === 'delete') op = await deletePageDialog(cur, (editor.pageEntry(cur)?.frames || []).filter((f) => !f.generated).length);
  if (op) await runPageOp(op);
}

// ---------------------------------------------------------------- wiring
if (PRINT) {
  window.__bbReady = open(params.get('week'));
} else {
  document.body.classList.add('screen', 'show-guides', 'show-halves');
  editor = new Editor({
    week: () => week,
    file: () => weekFile,
    shellOf: (n) => shells.get(n),
    pageNumbers: () => week.manifest.pages.map((p) => p.number),
    rerender,
    reload,
    setStatus,
    onState: updateToolbar,
    onSelection,
    pageRestore: (op, toStack) => runPageOp(op, { undoing: toStack }),
    // Publisher keeps Font/Paragraph on Home, greyed until you are typing in a text box
    onTextMode: (on) => {
      for (const el of document.querySelectorAll('.rb-text button:not(.todo):not(.rb-always), .rb-text select, .rb-text input, button.rb-typing')) el.disabled = !on;
      $('rb-columns').disabled = !on && !($('rb-columns').dataset.frameOk === '1');
      $('rb-painter').disabled = !on && !painter;
      syncMirrors();
      if (on) selectTab('home');
    },
  });
  window.__bbEditor = editor;

  // ---- Home ▸ Clipboard ▸ Format Painter (Publisher): click = paint once, double-click = keep
  // painting until Esc or a second click on the button
  let painter = null;
  const stopPaint = () => {
    painter = null;
    document.body.classList.remove('painting');
    $('rb-painter').classList.remove('active');
    $('rb-painter').disabled = !editor.textEdit;
  };
  $('rb-painter').addEventListener('mousedown', (e) => e.preventDefault());   // keep the text selected
  $('rb-painter').addEventListener('click', (e) => {
    if (painter && e.detail < 2) { stopPaint(); return; }
    const flow = editor.editingFlow();
    const fmt = painter ? painter.fmt : flow && captureFormat(flow);
    if (!fmt) { setStatus('Click in some text first: Format Painter copies its formatting.'); return; }
    painter = { fmt, sticky: e.detail >= 2 };
    document.body.classList.add('painting');
    $('rb-painter').classList.add('active');
    setStatus('Format Painter: select the text to paint' + (painter.sticky ? ' (as many times as you like; Esc to stop).' : '.'));
  });
  $('stage').addEventListener('mouseup', () => setTimeout(() => {
    if (!painter) return;
    const flow = editor.editingFlow();
    const s = window.getSelection();
    if (!flow || !s.rangeCount || s.isCollapsed || !flow.contains(s.anchorNode)) return;
    if (applyFormat(flow, painter.fmt)) { editor.setDirty(true); setStatus('Formatting painted.'); }
    if (!painter.sticky) stopPaint();
  }, 0));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && painter) stopPaint(); }, true);
  const rulers = new Rulers(editor, { $ });
  window.__bbRulers = rulers;
  $('t-tabsdlg').onclick = () => rulers.tabsDialog();
  const find = new FindPane(editor, { $ });
  window.__bbFind = find;
  for (const b of [$('rb-find'), $('rb-replace')]) b.addEventListener('mousedown', (e) => e.preventDefault());   // keep the selected text for "Find what"
  $('rb-find').onclick = () => find.show('find');
  $('rb-replace').onclick = () => find.show('replace');
  // ---- Home ▸ Styles: gallery of the week's styles (applies to the paragraph(s) you are in)
  $('rb-styles').addEventListener('mousedown', (e) => e.preventDefault());
  $('rb-styles').onclick = () => {
    const flow = editor.editingFlow();
    if (!flow) return;
    document.querySelectorAll('.ctx-menu').forEach((m) => m.remove());
    const styles = week.manifest.styles || [];
    const cur = (paragraphSettings(flow) || {}).style;
    const m = document.createElement('div');
    m.className = 'ctx-menu sg-menu';
    m.innerHTML = galleryHtml(styles, cur);
    m.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });   // keep the caret
    document.body.appendChild(m);
    const r = $('rb-styles').getBoundingClientRect();
    m.style.left = r.left + 'px';
    m.style.top = r.bottom + 2 + 'px';
    for (const b of m.querySelectorAll('.sg-item')) {
      b.onclick = () => {
        m.remove();
        const s = styles.find((x) => x.name === b.dataset.style);
        if (s) { editor.format('style', normStyle(s)); setStatus('Style applied: ' + s.name + '.'); }
      };
    }
    m.querySelector('#sg-new').onclick = async () => {
      m.remove();
      const para = currentParagraph(flow);
      const sel = window.getSelection();
      const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const v = await modal('New Style', '<label class="pd-row">Name for the new style: <input name="name" required></label>' +
        '<p class="pd-note">The new style takes the font, size, spacing and indents of the paragraph you are in.</p>');
      flow.focus();
      if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
      const name = v && v.name.trim();
      if (!name || !para) return;
      const list = (week.manifest.styles || []).filter((x) => x.name !== name);
      const st = styleFromPara(name, para);
      list.push(st);
      try {
        await window.bb.setStyles(weekFile, list);
        week.manifest.styles = list;
        editor.format('style', normStyle(st));
        setStatus('New style "' + name + '" saved in this week and applied.');
      } catch (err) {
        setStatus('<span class="warn">' + String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') + '</span>');
      }
    };
  };
  $('stage').addEventListener('contextmenu', (e) => { pageContextMenu(e); });
  // ---- Insert ▸ Symbol / Date & Time (at the caret), View ▸ Zoom ▸ Selected Objects
  const typeAtCaret = (t) => { if (!editor.editingFlow()) return; document.execCommand('insertText', false, t); editor.setDirty(true); };
  for (const b of document.querySelectorAll('.sym')) b.onclick = () => { typeAtCaret(b.dataset.sym); document.querySelectorAll('.rb-menu').forEach((m) => { m.hidden = true; }); };
  $('ins-date').addEventListener('mousedown', (e) => e.preventDefault());
  $('ins-symbol').addEventListener('mousedown', (e) => e.preventDefault());
  $('ins-date').addEventListener('click', () => {
    const d = new Date();
    const f = (o) => d.toLocaleDateString('en-US', o);
    const fm = [f({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), f({ month: 'long', day: 'numeric', year: 'numeric' }), f({ month: 'numeric', day: 'numeric', year: 'numeric' }),
      f({ month: 'numeric', day: 'numeric', year: '2-digit' }), f({ month: 'short', day: 'numeric', year: 'numeric' }), d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })];
    fm.forEach((t, i) => { setLabel('dt-' + i, t); $('dt-' + i).dataset.text = t; });
  }, true);
  for (let i = 0; i < 6; i++) $('dt-' + i).onclick = () => typeAtCaret($('dt-' + i).dataset.text || '');
  $('zoom-sel').onclick = () => {
    const fs = editor.selection();
    if (!fs.length) { setStatus('Select an object first.'); return; }
    const x0 = Math.min(...fs.map((f) => f.x)), y0 = Math.min(...fs.map((f) => f.y)), x1 = Math.max(...fs.map((f) => f.x + f.w)), y1 = Math.max(...fs.map((f) => f.y + f.h));
    const st = $('stage');
    zoom = Math.min(4, Math.max(0.2, Math.min((st.clientWidth - 80) / ((x1 - x0) * 96 / 72), (st.clientHeight - 80) / ((y1 - y0 || 1) * 96 / 72))));
    applyZoom();
    requestAnimationFrame(() => { const el = shells.get(editor.sel.page).querySelector('.frame[data-id="' + editor.sel.id + '"]'); if (el) el.scrollIntoView({ block: 'center', inline: 'center' }); });
  };
  $('sel-all').onclick = async () => { if (editor.textEdit) await editor.endTextEdit(); editor.command('select-all'); };
  $('sel-text').onclick = () => { const fl = editor.editingFlow(); if (!fl) return; fl.focus(); const r = document.createRange(); r.selectNodeContents(fl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  for (const id of ['lk-create', 'lk-break', 'lk-prev', 'lk-next']) $(id).addEventListener('mousedown', (e) => e.preventDefault());
  $('lk-create').onclick = () => (editor.linking ? editor.cancelLink('Linking cancelled.') : editor.startLink());
  $('lk-break').onclick = () => editor.breakLink();
  $('lk-prev').onclick = () => editor.stepLink(-1);
  $('lk-next').onclick = () => editor.stepLink(1);
  $('brk-frame').onclick = () => editor.insertBreak('frame');
  $('brk-column').onclick = () => editor.insertBreak('column');
  // at start nothing is being typed in: Font/Paragraph greyed, as in Publisher
  queueMicrotask(() => editor.app.onTextMode(false));
  editor.panel = new FlowPanel(editor, { week: () => week, file: () => weekFile });
  const backstage = new Backstage($('backstage'), {
    week: () => week, file: () => weekFile, open, choose: () => window.bb.chooseWeek(),
    save: () => (editor.half ? editor.command('save') : setStatus('Nothing to save: choose Bulletin, I am changing, first.')),
    newWeek, saveAs, exportPdf, print: printWeek, closeWindow: () => window.close(), info: weekInfo,
  });
  window.bb.version().then((v) => { backstage.api.version = v; });
  onFileTab(() => backstage.show(week ? 'info' : 'home'));
  if (!params.get('week') && !params.get('selftest')) backstage.show('home');
  $('zoom-in').onclick = () => zoomBy(1.15);
  $('zoom-out').onclick = () => zoomBy(1 / 1.15);
  $('zoom-fit').onclick = () => zoomBy(0);
  $('zoom-100').onclick = () => { if (week) { zoom = 1; applyZoom(); } };
  $('zoom-width').onclick = () => zoomBy(-1);
  $('show-boundaries').onchange = (e) => document.body.classList.toggle('show-boundaries', e.target.checked);
  $('show-nav').onchange = (e) => { $('nav').hidden = !e.target.checked; };
  $('rb-paste').onclick = () => editor.command('paste');
  $('rb-copy').onclick = () => editor.command('copy');
  $('rb-cut').onclick = async () => { await editor.command('copy'); await editor.command('delete'); };
  $('rb-newweek').onclick = () => newWeek();
  for (const [id, kind] of Object.entries({ 'pg-blank': 'blank', 'pg-dup': 'dup', 'pg-insert': 'insert', 'pg-delete': 'delete', 'pg-move': 'move' })) {
    $(id).onclick = () => pageCommand(kind);
  }
  window.__bbPageOp = runPageOp;   // self-test hook (no dialog)
  $('show-guides').onchange = (e) => document.body.classList.toggle('show-guides', e.target.checked);
  $('show-halves').onchange = (e) => document.body.classList.toggle('show-halves', e.target.checked);
  $('pasteboard-btn').onchange = () => { if (!week) { $('pasteboard-btn').checked = false; return; } if (showingPasteboard) showSpreads(); else showPasteboard(); };
  $('mode').onchange = async (e) => {
    const v = e.target.value;
    const ok = v ? await editor.claim(v) : (await editor.release(), true);
    if (!ok) e.target.value = editor.half || '';
    updateToolbar();
  };
  $('save').onclick = () => editor.command('save');
  $('undo').onclick = () => editor.command('undo');
  $('redo').onclick = () => editor.command('redo');
  $('lock-frame').onclick = () => editor.command('lock-frame');
  $('lock-page').onclick = () => editor.command('lock-page');
  $('delete').onclick = () => editor.command('delete');
  const cmdButtons = { front: 'front', back: 'back', 'to-pasteboard': 'to-pasteboard', crop: 'crop', fit: 'fit', fill: 'fill',
    'ins-text': 'insert-text', 'ins-picture': 'insert-picture', 'ins-line': 'insert-line', 'ins-rect': 'insert-rect' };
  for (const [id, cmd] of Object.entries(cmdButtons)) $(id).onclick = () => editor.command(cmd);
  for (const id of ['fx', 'fy', 'fw', 'fh']) $(id).addEventListener('change', numericChange);
  // text toolbar: mousedown is cancelled so the caret/selection stays in the frame
  for (const b of document.querySelectorAll('.rb-text button')) b.addEventListener('mousedown', (e) => e.preventDefault());
  $('t-bold').onclick = () => editor.format('bold');
  $('t-italic').onclick = () => editor.format('italic');
  $('t-underline').onclick = () => editor.format('underline');
  for (const b of document.querySelectorAll('.rb-text [data-align]')) b.onclick = () => editor.format('align', b.dataset.align);
  // font and size take focus away from the frame; put the selection back before applying
  let saved = null;
  const keep = () => { const s = window.getSelection(); if (s.rangeCount) saved = s.getRangeAt(0).cloneRange(); };
  const back = () => { if (!saved) return; const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); };
  $('t-font').addEventListener('mousedown', keep); $('t-size').addEventListener('mousedown', keep);
  $('t-font').onchange = (e) => { back(); editor.format('font', e.target.value); };
  $('t-size').onchange = (e) => { back(); editor.format('size', e.target.value); };
  // ---- Home ▸ Font / Paragraph (while typing in a text box)
  const fmt = (cmd, v) => editor.format(cmd, v);
  for (const [id, cmd] of Object.entries({ 't-grow': 'grow', 't-shrink': 'shrink', 't-clear': 'clear', 't-sub': 'subscript', 't-sup': 'superscript',
    't-bullets': 'bullets', 't-numbering': 'numbering', 't-indent': 'indent', 't-outdent': 'outdent' })) $(id).onclick = () => fmt(cmd);
  for (const b of document.querySelectorAll('[id^="case-"]')) b.onclick = () => fmt('case', b.id.slice(5));
  for (const b of document.querySelectorAll('[id^="trk-"]')) b.onclick = () => fmt('tracking', Number(b.id.slice(4)));
  for (const b of document.querySelectorAll('[id^="ls-"]')) b.onclick = () => fmt('lineSpacing', Number(b.id.slice(3)));
  for (const b of document.querySelectorAll('.swatch')) b.onclick = () => fmt('color', b.dataset.color);
  $('t-color-more').addEventListener('mousedown', keep);
  $('t-color-more').addEventListener('change', (e) => { back(); fmt('color', e.target.value.toUpperCase()); });
  $('t-paradlg').onclick = async () => {
    const flow = editor.editingFlow();
    if (!flow) return;
    keep();
    const v = await paragraphDialog(paragraphSettings(flow) || {});
    back();
    if (v) fmt('paragraph', v);
  };
  window.addEventListener('keydown', (e) => {
    if (!editor.textEdit || !(e.ctrlKey && e.shiftKey)) return;
    if (e.key === '>' || e.key === '.') { e.preventDefault(); fmt('grow'); }
    if (e.key === '<' || e.key === ',') { e.preventDefault(); fmt('shrink'); }
  });
  // Publisher: Font / Size boxes and B I U / alignment buttons show the formatting where the caret is
  document.addEventListener('selectionchange', () => {
    const flow = editor.textEdit && editor.editingFlow();
    const s = window.getSelection();
    if (!flow || !s.rangeCount || !flow.contains(s.anchorNode)) return;
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    const cs = getComputedStyle(el);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').replace(/^bbx-/, '');
    const fsel = $('t-font');
    if (![...fsel.options].some((o) => o.value === fam)) fsel.add(new Option(fam, fam));
    if (document.activeElement !== fsel) fsel.value = fam;
    const shifted = cs.verticalAlign === 'super' || cs.verticalAlign === 'sub';
    if (document.activeElement !== $('t-size')) $('t-size').value = String(Math.round(parseFloat(cs.fontSize) * 0.75 / (shifted ? 0.66 : 1) * 2) / 2);
    const deco = (line) => { for (let e = el; e && e !== flow; e = e.parentElement) if ((getComputedStyle(e).textDecorationLine || '').includes(line)) return true; return false; };
    $('t-bold').classList.toggle('active', parseInt(cs.fontWeight, 10) >= 600);
    $('t-italic').classList.toggle('active', cs.fontStyle === 'italic');
    $('t-underline').classList.toggle('active', deco('underline'));
    const p = el.closest('p');
    const al = p ? getComputedStyle(p).textAlign : 'left';
    for (const b of document.querySelectorAll('.rb-text [data-align]')) b.classList.toggle('active', b.dataset.align === (al === 'start' ? 'left' : al));
  });
  $('rb-marks').onclick =() => { const on = document.body.classList.toggle('show-marks'); $('rb-marks').classList.toggle('active', on); };
  // ---- Arrange
  for (const b of document.querySelectorAll('[id^="col-"]')) b.onclick = () => editor.setColumns(Number(b.id.slice(4)));
  for (const b of document.querySelectorAll('[id^="wrap-"]')) b.onclick = () => editor.setWrap(b.id.slice(5));
  for (const b of document.querySelectorAll('[id^="al-"]:not(input)')) b.onclick = () => editor.alignSelection(b.id.slice(3), $('al-margins').checked);
  $('dist-h').onclick = () => editor.distributeSelection('h', $('al-margins').checked);
  $('dist-v').onclick = () => editor.distributeSelection('v', $('al-margins').checked);
  for (const [id, cmd] of Object.entries({ 'rb-group': 'group', 'rb-ungroup': 'ungroup', 'rot-right': 'rotate-right', 'rot-left': 'rotate-left', 'flip-h': 'flip-h', 'flip-v': 'flip-v' })) {
    $(id).onclick = () => editor.command(cmd);
  }
  window.bb.onOpen(open);
  window.bb.onZoom(zoomBy);
  window.bb.onCommand(async (name) => (name === 'new-week' ? newWeek() : name === 'save-as' ? saveAs() : editor.command(name)));
  if (params.get('week')) {
    const opened = open(params.get('week'));
    if (params.get('selftest') === 'flow') {
      window.__bbSelftest = opened.then(() => import('./selftest-flow.js')).then((m) => m.run(editor, { shells, week: () => week }));
    } else if (params.get('selftest')) {
      window.__bbSelftest = opened.then(() => import('./selftest.js')).then((m) => m.run(editor, { shells, week: () => week }));
    }
  }
}
