// Print preview (Publisher's File ▸ Print pane shows the sheet as it will come out): the imposed
// booklet sides for Legal / Ledger, or the single pages for Letter, drawn with the one renderer and
// scaled to fit a dialog, each side labelled with the pages on it and whether it is a front or a back.
import { PAPER, bookletSides, buildSheets } from './impose.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// paper: legal | ledger | letter; inOrder: the printer's own booklet preset gets the pages one per
// page (so the preview shows the pages in order, not the imposed sheets)
export function showPrintPreview(week, paper, renderPage, { inOrder = false } = {}) {
  const P = PAPER[paper];
  const numbers = week.manifest.pages.map((p) => p.number);
  const d = document.createElement('dialog');
  d.className = 'pub-dialog preview-dialog';
  const title = inOrder ? 'Print preview — ' + numbers.length + ' pages in order (the printer makes the booklet)'
    : 'Print preview — ' + P.label + ' ' + P.inches + (P.booklet ? ' booklet, ' + bookletSides(numbers.length).sides.length / 2 + ' sheets, both sides' : ', one page per sheet');
  d.innerHTML = '<form method="dialog"><div class="pd-title">' + esc(title) + '</div><div class="pd-body pv-body"></div>' +
    '<div class="pd-buttons"><button value="ok" class="pd-ok">Close</button></div></form>';
  const body = d.querySelector('.pv-body');
  const stage = document.createElement('div');
  stage.className = 'pv-stage';
  let labels = [];
  if (inOrder || !P.booklet) {
    for (const n of numbers) {
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      const { width, height } = week.manifest.page;
      Object.assign(sheet.style, { position: 'relative', width: width + 'pt', height: height + 'pt', overflow: 'hidden', background: '#fff' });
      sheet.appendChild(renderPage(n));
      stage.appendChild(sheet);
      labels.push('Page ' + n);
    }
  } else {
    buildSheets(stage, paper, week.manifest.page, numbers, renderPage);
    const sides = bookletSides(numbers.length).sides;
    labels = sides.map((s, i) => 'Sheet ' + (Math.floor(i / 2) + 1) + ' ' + (i % 2 ? 'back' : 'front') + ' — pages ' + s.map((k) => (k == null ? 'blank' : k)).join(' | '));
  }
  // scale every sheet to the dialog's width, with its label above it
  const sheets = [...stage.children];
  const W = 520;   // px
  sheets.forEach((sheet, i) => {
    const wpt = parseFloat(sheet.style.width), hpt = parseFloat(sheet.style.height);
    const scale = W / (wpt * 96 / 72);
    const cell = document.createElement('div');
    cell.className = 'pv-cell';
    cell.innerHTML = '<div class="pv-label">' + esc(labels[i] || '') + '</div>';
    const box = document.createElement('div');
    box.className = 'pv-box';
    box.style.width = W + 'px';
    box.style.height = Math.round(hpt * 96 / 72 * scale) + 'px';
    sheet.style.transform = 'scale(' + scale + ')';
    sheet.style.transformOrigin = 'top left';
    sheet.style.breakAfter = 'auto';
    box.appendChild(sheet);
    cell.appendChild(box);
    body.appendChild(cell);
  });
  document.body.appendChild(d);
  return new Promise((resolve) => {
    d.addEventListener('close', () => { d.remove(); resolve(true); });
    d.showModal();
  });
}
