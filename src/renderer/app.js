import { renderPage, renderPasteboard, layoutTabs, layoutWraps, findOverflow, fontsUsed, missingFonts } from './render.js';
import { Editor } from './editor.js';

const params = new URLSearchParams(location.search);
const PRINT = params.get('mode') === 'print';
const $ = (id) => document.getElementById(id);

let week = null;
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
  refreshStatusCounts();
}

let baseStatus = '';
function refreshStatusCounts() {
  const over = document.querySelectorAll('.frame.overflow').length;
  const bits = [baseStatus];
  if (over) bits.push('<span class="warn">' + over + ' text frame(s) overflow</span>');
  $('counts').innerHTML = bits.filter(Boolean).join(' · ');
}

async function showSpreads() {
  const stage = $('stage');
  stage.innerHTML = '';
  shells.clear();
  showingPasteboard = false;
  $('pasteboard-btn').classList.remove('active');
  const { width, height } = week.manifest.page;
  const numbers = week.manifest.pages.map((p) => p.number);
  const wrap = document.createElement('div');
  wrap.className = 'spreads';
  wrap.style.setProperty('--page-w', width + 'pt');
  wrap.style.setProperty('--page-h', height + 'pt');
  const nav = $('nav');
  nav.innerHTML = '';
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

    const b = document.createElement('button');
    b.innerHTML = label + ' ' + pair.filter(Boolean).map((n) => {
      const h = week.manifest.pages.find((p) => p.number === n).half;
      return '<span class="half-dot half-' + h + '" title="' + h + '"></span>';
    }).join('');
    b.onclick = () => sw.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nav.appendChild(b);
  }
  stage.appendChild(wrap);
  await settle(wrap);
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
  $('pasteboard-btn').classList.add('active');
}

function applyZoom() {
  const w = document.querySelector('.spreads');
  if (w) w.style.setProperty('--zoom', zoom);
  $('zoom-label').textContent = Math.round(zoom * 100) + '%';
}

function zoomBy(factor) {
  if (!week) return;
  if (factor === 0) {
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
  document.title = 'Bulletin Builder — ' + week.manifest.title;
  $('title').textContent = week.manifest.title;
  if (PRINT) return printLayout();
  if (editor && editor.half) await editor.release();
  await showSpreads();
  zoomBy(0);
  updateToolbar();
}

async function reload() {
  week = await window.bb.loadWeek(weekFile);
  const keep = zoom;
  await showSpreads();
  zoom = keep;
  applyZoom();
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
  $('lock-page').textContent = pg && pg.locked ? 'Unlock page ' + lp : 'Lock page' + (lp != null ? ' ' + lp : '');
  for (const id of ['ins-text', 'ins-picture', 'ins-line', 'ins-rect']) $(id).disabled = !half;
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
  $('lock-frame').textContent = has && info.frame.locked ? 'Unlock' : 'Lock';
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
    onTextMode: (on) => { $('textbar').hidden = !on; $('arrange').hidden = on; },
  });
  window.__bbEditor = editor;
  $('open').onclick = async () => { const f = await window.bb.chooseWeek(); if (f) open(f); };
  $('zoom-in').onclick = () => zoomBy(1.15);
  $('zoom-out').onclick = () => zoomBy(1 / 1.15);
  $('zoom-fit').onclick = () => zoomBy(0);
  $('show-guides').onchange = (e) => document.body.classList.toggle('show-guides', e.target.checked);
  $('show-halves').onchange = (e) => document.body.classList.toggle('show-halves', e.target.checked);
  $('pasteboard-btn').onclick = () => { if (!week) return; showingPasteboard ? showSpreads() : showPasteboard(); };
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
  for (const b of document.querySelectorAll('#textbar button')) b.addEventListener('mousedown', (e) => e.preventDefault());
  $('t-bold').onclick = () => editor.format('bold');
  $('t-italic').onclick = () => editor.format('italic');
  $('t-underline').onclick = () => editor.format('underline');
  for (const b of document.querySelectorAll('#textbar [data-align]')) b.onclick = () => editor.format('align', b.dataset.align);
  $('t-done').onclick = () => editor.endTextEdit();
  // font and size take focus away from the frame; put the selection back before applying
  let saved = null;
  const keep = () => { const s = window.getSelection(); if (s.rangeCount) saved = s.getRangeAt(0).cloneRange(); };
  const back = () => { if (!saved) return; const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); };
  $('t-font').addEventListener('mousedown', keep); $('t-size').addEventListener('mousedown', keep);
  $('t-font').onchange = (e) => { back(); editor.format('font', e.target.value); };
  $('t-size').onchange = (e) => { back(); editor.format('size', e.target.value); };
  window.bb.onOpen(open);
  window.bb.onZoom(zoomBy);
  window.bb.onCommand((name) => editor.command(name));
  if (params.get('week')) {
    const opened = open(params.get('week'));
    if (params.get('selftest')) {
      window.__bbSelftest = opened.then(() => import('./selftest.js')).then((m) => m.run(editor, { shells, week: () => week }));
    }
  }
}
