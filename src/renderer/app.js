import { renderPage, renderPasteboard, layoutTabs, layoutWraps, findOverflow, fontsUsed, missingFonts } from './render.js';

const params = new URLSearchParams(location.search);
const PRINT = params.get('mode') === 'print';
const $ = (id) => document.getElementById(id);

let week = null;
let zoom = 1;
let showingPasteboard = false;

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

async function showSpreads() {
  const stage = $('stage');
  stage.innerHTML = '';
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
      const pg = renderPage(week, n);
      marginGuide(pg, n);
      spread.appendChild(pg);
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
  const overflow = await settle(wrap);
  applyZoom();
  const missing = missingFonts(fontsUsed(week));
  const bits = [week.manifest.pages.length + ' pages'];
  if (missing.length) bits.push('<span class="warn">Fonts not installed on this PC: ' + missing.join(', ') + ' (a substitute is shown)</span>');
  if (overflow.length) bits.push('<span class="warn">' + overflow.length + ' text frame(s) overflow on screen</span>');
  const low = wrap.querySelectorAll('[data-low-confidence]').length;
  if (low) bits.push(low + ' picture(s) to check');
  setStatus(bits.join(' · '));
}

async function showPasteboard() {
  const stage = $('stage');
  stage.innerHTML = '<h3 class="pasteboard-title">Pasteboard — parked items (never printed)</h3>';
  const wrap = document.createElement('div');
  wrap.className = 'spreads';
  const board = renderPasteboard(week);
  if (board) wrap.appendChild(board);
  else wrap.textContent = 'The pasteboard is empty.';
  stage.appendChild(wrap);
  await settle(wrap);
  applyZoom();
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
  } catch (err) {
    setStatus('<span class="warn">' + String(err.message || err) + '</span>');
    return;
  }
  document.title = 'Bulletin Builder — ' + week.manifest.title;
  $('title').textContent = week.manifest.title;
  if (PRINT) return printLayout();
  await showSpreads();
  zoomBy(0);
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
  $('open').onclick = async () => { const f = await window.bb.chooseWeek(); if (f) open(f); };
  $('zoom-in').onclick = () => zoomBy(1.15);
  $('zoom-out').onclick = () => zoomBy(1 / 1.15);
  $('zoom-fit').onclick = () => zoomBy(0);
  $('show-guides').onchange = (e) => document.body.classList.toggle('show-guides', e.target.checked);
  $('show-halves').onchange = (e) => document.body.classList.toggle('show-halves', e.target.checked);
  $('pasteboard-btn').onclick = () => { if (!week) return; showingPasteboard ? showSpreads() : showPasteboard(); };
  window.bb.onOpen(open);
  window.bb.onZoom(zoomBy);
  if (params.get('week')) open(params.get('week'));
}
