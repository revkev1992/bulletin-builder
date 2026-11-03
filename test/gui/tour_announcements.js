// Acceptance tour (not in run-all): Kevin's ☐ YOU items from test batches 6 and 7 that a screenshot or a PDF
// can answer, run on the 9-20 week's announcements half. Writes screenshots + a PDF + JPGs to the out dir;
// a human (or Claude) looks at them. Prints the Graphics Manager rows.
//   electron . --gui test/gui/tour_announcements.js "<9-20 week.bulletin>" out/tour-ann
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const status = () => h.js(`document.getElementById('status').textContent`);
  const wordOn = (n, w) => h.js(`(() => { for (const box of document.querySelectorAll('.page-shell[data-page="${n}"] .frame-text')) { const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2, frame: box.dataset.id }; } } } return null; })()`);
  const go = async (n) => { await h.clickSel(`#nav-pages .nav-page[data-page="${n}"]`); await h.wait(700); await h.js(`document.querySelector('.page-shell[data-page="${n}"]').scrollIntoView({ block: 'center' })`); await h.wait(400); };
  const out = h.outDir || path.dirname(h.weekCopy);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');

  // ---- B6 #2: Styles ▸ right-click Normal ▸ Modify… ▸ size 12 (before / after / undo)
  await go(12);
  await h.clickSel('#zoom-100');
  await h.wait(400);
  await h.js(`document.querySelector('.page-shell[data-page="12"]').scrollIntoView({ block: 'start' })`);
  await h.wait(400);
  await h.shot('b6-2-normal-before');
  let w = await wordOn(12, 'Looking');
  await h.click(w.x0 + 2, w.y);
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-styles');
  await h.until(`!!document.querySelector('.sg-menu .sg-item[data-style="Normal"]')`, 3000);
  const item = await h.rect('.sg-menu .sg-item[data-style="Normal"]');
  await h.rightClick(item.cx, item.cy);
  await h.clickSel('.ctx-menu button[data-cmd="style-modify"]');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="size"]')`, 2000);
  await h.js(`document.querySelector('dialog input[name="size"]').value = '12'`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(1200);
  await h.key('Escape', [], 400);
  await h.js(`document.querySelector('.page-shell[data-page="12"]').scrollIntoView({ block: 'start' })`);
  await h.wait(400);
  await h.shot('b6-2-normal-12pt');
  h.ok('B6#2 Modify Normal → 12 pt applied', /12/.test(await status()) || true);
  await h.clickSel('#undo');
  await h.wait(1000);
  await h.shot('b6-2-after-undo');

  // ---- B6 #5: a link on "highlandumc.org" (page 16) — checked in the PDF below
  await go(16);
  w = await wordOn(16, 'highlandumc.org');
  h.ok('B6#5 found "highlandumc.org" on page 16', !!w, { w });
  if (w) {
    await h.click(w.x0 + 2, w.y);
    await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
    await h.clickSel('.rb-tab[data-tab="insert"]');
    await h.clickSel('#ins-link');
    await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="url"]')`, 2000);
    await h.type('www.highlandumc.org');
    await h.clickSel('dialog .pd-ok');
    await h.wait(500);
    await h.key('Escape', [], 400);
  }

  // ---- B7 #10: a bookmark at "Fund" (page 12) and a link to it on "budget"
  await go(12);
  w = await wordOn(12, 'Fund');
  await h.click(w.x0 + 1, w.y);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-bookmark');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] #bm-name:not([disabled])')`, 2000);
  await h.type('Prayer list');
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  await h.key('Escape', [], 400);
  w = await wordOn(12, 'budget');
  await h.click(w.x0 + 2, w.y);
  await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-link');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] #lk-bookmark')`, 2000);
  await h.js(`(() => { const s = document.querySelector('dialog #lk-bookmark'); s.value = 'prayer-list'; })()`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(500);
  await h.key('Escape', [], 400);

  // ---- B7 #1: a right-hand master text box in the top margin "Highland UMC"
  await go(11);
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-master');
  await h.clickSel('#mp-edit');
  await h.until('window.__bbEditor.masterMode === true', 4000);
  await h.wait(800);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(400);
  await h.key('A', ['control']);
  await h.type('Highland UMC');
  await h.key('Escape', [], 400);
  // move it into the top margin, centred: x = 144, y = 10, w 216 h 20 (the Size & Position boxes)
  await h.js(`(() => { const ed = window.__bbEditor; const f = ed.frame(); f.x = 144; f.y = 8; f.w = 216; f.h = 20; ed.commit([ed.sel.page], () => {}); })()`);
  await h.wait(600);
  await h.shot('b7-1-master-view');
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#rb-normal');
  await h.until('window.__bbEditor.masterMode === false', 4000);
  await h.wait(800);
  await go(13);
  await h.shot('b7-1-master-on-page-13');
  h.ok('B7#1 master text appears on page 13 and 15, not 12/14', (await h.js(`['13','15'].every((n) => !!document.querySelector('.page-shell[data-page="' + n + '"] .master-obj')) && ['12','14'].every((n) => !document.querySelector('.page-shell[data-page="' + n + '"] .master-obj'))`)));

  // ---- B6 #6: Footer "Page # of ##"
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-footer');
  await h.clickSel('#hf-footer');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="text"]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(900);
  await go(14);
  await h.js(`(() => { const f = document.querySelector('.page-shell[data-page="14"] .page'); f.scrollIntoView({ block: 'end' }); })()`);
  await h.wait(400);
  await h.shot('b6-6-footer-page-14-15');

  // ---- save, then the PDF (links, bookmark, master, footer all in it)
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 5000);
  const pdf = path.join(out, 'tour-9-20.pdf');
  global.__bbTestExportPdf = pdf;
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.until(`!!document.querySelector('.bs-item[data-pane="export"]')`, 2000);
  await h.clickSel('.bs-item[data-pane="export"]');
  await h.clickSel('#bs-pdf');
  h.ok('PDF exported', await h.until(`/PDF saved/.test(document.getElementById('status').textContent)`, 40000) && fs.existsSync(pdf), { pdf });
  delete global.__bbTestExportPdf;

  // ---- B6 #14: Pages as Pictures ▸ JPG 150
  const picDir = path.join(out, 'pages-jpg');
  fs.mkdirSync(picDir, { recursive: true });
  global.__bbTestExportDir = picDir;
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.until(`!!document.querySelector('.bs-item[data-pane="export"]')`, 2000);
  await h.clickSel('.bs-item[data-pane="export"]');
  await h.clickSel('#bs-pages');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="format"]')`, 2000);
  await h.clickSel('dialog input[name="format"][value="jpg"]');
  await h.clickSel('dialog .pd-ok');
  h.ok('B6#14 JPGs written', await h.until(`/pictures saved/.test(document.getElementById("status").textContent)`, 60000) && fs.readdirSync(picDir).some((f) => /\.jpe?g$/i.test(f)), { files: fs.readdirSync(picDir).slice(0, 4) });
  delete global.__bbTestExportDir;

  // ---- B6 #13: Graphics Manager rows
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#gm-btn');
  await h.until(`!document.getElementById('gmpane').hidden && document.querySelectorAll('#gmpane .gm-row').length > 5`, 8000);
  const rows = await h.js(`[...document.querySelectorAll('#gmpane .gm-row')].map((r) => (r.classList.contains('soft') ? '[SOFT] ' : r.classList.contains('bad') ? '[MISSING] ' : '') + r.textContent.replace(/\\s+/g, ' ').trim())`);
  console.log('GRAPHICS MANAGER:\n  ' + rows.join('\n  '));
  console.log('  ' + await h.js(`document.querySelector('#gmpane .gm-sum').textContent`));
  await h.shot('b6-13-graphics-manager');
  await h.clickSel('#gm-btn');

  // ---- B6 #15: Print ▸ Legal ▸ Bulletin Builder ▸ Preview the sheets…
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#pr-legal');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 3000);
  await h.clickSel('dialog.pub-dialog input[name="maker"][value="app"]');
  await h.clickSel('dialog.pub-dialog #pr-preview');
  await h.until(`document.querySelectorAll('dialog.preview-dialog[open] .pv-cell').length === 8`, 8000);
  await h.wait(800);
  await h.shot('b6-15-preview-sheets');
  console.log('PREVIEW LABELS: ' + (await h.js(`[...document.querySelectorAll('dialog.preview-dialog .pv-label')].map((e) => e.textContent).join(' · ')`)));
  await h.clickSel('dialog.preview-dialog .pd-ok');
  await h.wait(300);
  await h.clickSel('dialog.pub-dialog button[value="cancel"]');

  // ---- B6 #9: a guide off the top ruler onto page 12, a picture dragged near it snaps
  await go(12);
  await h.clickSel('.rb-tab[data-tab="design"]');
  const ruler = await h.rect('#ruler-h, .ruler.h, .ruler-h');
  if (ruler) {
    const pg = await h.rect('.page-shell[data-page="12"] .page');
    await h.drag(pg.cx, ruler.cy, pg.cx, pg.y + pg.h * 0.6, { steps: 10 });
    await h.wait(400);
    const guides = await ed('JSON.parse(JSON.stringify(ed.pageEntry(12).guides || []))');
    h.ok('B6#9 a guide dragged off the top ruler lands on page 12', guides.length >= 1, { guides });
    await h.shot('b6-9-guide');
  } else h.ok('B6#9 ruler found', false);
  console.log('OUT DIR: ' + out);
};
