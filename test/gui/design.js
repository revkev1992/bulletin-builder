// GUI suite: Page Design — Page Background (colour, Apply Image), ruler guides (Guides menu, drag off
// the rulers, drag to move, drag off the page to remove), Align To, Page Setup (margins, size,
// orientation). Real mouse/keyboard; the native picture dialog is replaced by a path.
const fs = require('fs');
const path = require('path');
const P = 12;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const page = (n) => `.page-shell[data-page="${n}"] .page`;
  const guides = (n = P) => ed(`JSON.parse(JSON.stringify(ed.pageEntry(${n}).guides || []))`);
  const manifest = () => JSON.parse(fs.readFileSync(h.weekCopy, 'utf8'));

  await h.clickSel('.rb-tab[data-tab="design"]');
  for (const id of ['#pg-bg', '#pg-bgimage', '#pg-guides', '#pg-margins', '#pg-size', '#pg-orient']) h.ok('view only: ' + id.slice(1) + ' greyed', await h.disabled(id));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('#nav-pages .nav-page[data-page="' + P + '"]');
  await h.wait(700);
  await h.clickSel('.rb-tab[data-tab="design"]');

  // ---- Page Background ▸ a colour
  await h.clickSel('#pg-bg');
  h.ok('Background opens its colours', !!(await h.rect('.rb-menu[data-menu-name="background"]:not([hidden]) .bgswatch[data-color="#FFF2CC"]')));
  await h.clickSel('.bgswatch[data-color="#FFF2CC"]');
  await h.wait(400);
  h.ok('the page is marked with the colour', (await ed(`ed.pageEntry(${P}).background`)) === '#FFF2CC');
  h.ok('…and drawn in it', /255, 242, 204/.test(await h.js(`getComputedStyle(document.querySelector('${page(P)}')).backgroundColor`)));
  await h.shot('background');
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo takes the colour off', !(await ed(`ed.pageEntry(${P}).background`)));
  await h.clickSel('#redo');
  await h.wait(400);
  await h.clickSel('#pg-bg');
  await h.clickSel('#bg-none');
  await h.wait(400);
  h.ok('No Background clears it', !(await ed(`ed.pageEntry(${P}).background`)) && !/255, 242, 204/.test(await h.js(`getComputedStyle(document.querySelector('${page(P)}')).backgroundColor`)));

  // ---- Page Background ▸ Apply Image: a full-page picture behind everything
  const assets = path.join(path.dirname(h.weekCopy), 'assets');
  const pic = fs.readdirSync(assets).find((f) => /\.(jpg|png)$/i.test(f));
  global.__bbTestPicture = path.join(assets, pic);
  const n0 = await ed(`ed.pageEntry(${P}).frames.length`);
  await h.clickSel('#pg-bgimage');
  await h.until(`window.__bbEditor.pageEntry(${P}).frames.length === ${n0 + 1}`, 5000);
  await h.wait(400);
  const bg = await ed(`(() => { const fs = ed.pageEntry(${P}).frames; const f = fs[fs.length - 1]; const zs = fs.map((g) => g.z || 0); return { x: f.x, y: f.y, w: f.w, h: f.h, kind: f.kind, back: f.z < Math.min(...zs.slice(0, -1)), fit: f.image && f.image.fit }; })()`);
  const pg = await ed(`JSON.parse(JSON.stringify(ed.pageSize()))`);
  h.ok('Apply Image puts a picture over the whole page, behind everything, filled', bg.kind === 'image' && bg.x === 0 && bg.y === 0 && bg.w === pg.width && bg.h === pg.height && bg.back && bg.fit === 'fill', { bg, pg });
  await h.shot('background-image');
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo removes it', (await ed(`ed.pageEntry(${P}).frames.length`)) === n0);
  delete global.__bbTestPicture;

  // ---- Guides menu: add a horizontal guide, drag it, drag it off
  h.ok('no ruler guides on the page yet', (await guides()).length === 0);
  await h.clickSel('#pg-guides');
  await h.clickSel('#gd-h');
  await h.wait(400);
  let g = await guides();
  h.ok('Add Horizontal Ruler Guide: one guide across the middle of the page', g.length === 1 && g[0].axis === 'horizontal' && Math.abs(g[0].pos - pg.height / 2) < 0.6, { g });
  let gl = await h.rect(`.page-shell[data-page="${P}"] .rguide.h`);
  h.ok('…drawn as a line across the page', !!gl && gl.w > 300);
  const pr = await h.rect(page(P));
  const ppt = pr.w / pg.width;
  await h.drag(gl.cx, gl.cy, gl.cx, gl.cy + 72 * ppt, { steps: 10 });
  g = await guides();
  h.ok('drag the guide down 1": it moves', g.length === 1 && Math.abs(g[0].pos - (pg.height / 2 + 72)) < 2, { g });
  await h.shot('guide-moved');
  await h.clickSel('#undo');
  await h.wait(300);
  g = await guides();
  h.ok('Undo puts it back', Math.abs(g[0].pos - pg.height / 2) < 0.6, { g });
  await h.clickSel('#redo');       // the guide at 1" below the middle (not on the page's own centre line)
  await h.wait(300);
  const guideY = (await guides())[0].pos;
  // snapping: a dragged object snaps its top edge to the guide (Align To ▸ Guides on)
  const box = await ed(`(() => { const fs = ed.pageEntry(${P}).frames.filter((f) => f.kind === 'image' && !f.locked); fs.sort((a, b) => a.w * a.h - b.w * b.h); return fs[0] && { id: fs[0].id, y: fs[0].y, h: fs[0].h }; })()`);
  if (box) {
    const S = `.page-shell[data-page="${P}"] .frame[data-id="${box.id}"]`;
    const r = await h.rect(S);
    // aim the top edge 4 px below the guide: it should snap onto it
    const targetTop = pr.y + guideY * ppt + 4;
    await h.drag(r.cx, r.cy, r.cx, r.cy + (targetTop - r.y), { steps: 12 });
    const y1 = await ed(`ed.topFrame(${P}, '${box.id}').y`);
    h.ok('an object dragged near the guide snaps its edge onto it', Math.abs(y1 - guideY) < 0.6, { y1, guideY });
    await h.clickSel('#undo');
    await h.wait(300);
    await h.clickSel('#snap-guides');
    const r2 = await h.rect(S);
    await h.drag(r2.cx, r2.cy, r2.cx, r2.cy + (targetTop - r2.y), { steps: 12 });
    const y2 = await ed(`ed.topFrame(${P}, '${box.id}').y`);
    h.ok('Align To ▸ Guides off: it no longer snaps to the guide', Math.abs(y2 - guideY) > 1.5, { y2, guideY });
    await h.clickSel('#snap-guides');
    await h.clickSel('#undo');
    await h.wait(300);
  }
  gl = await h.rect(`.page-shell[data-page="${P}"] .rguide.h`);
  await h.drag(gl.cx, gl.cy, gl.cx, pr.y + pr.h + 40, { steps: 10 });
  h.ok('drag the guide off the page: removed', (await guides()).length === 0);

  // ---- drag a guide off the vertical ruler onto the page
  const rv = await h.rect('#ruler-v');
  await h.drag(rv.cx, pr.y + pr.h / 2, pr.x + 144 * ppt, pr.y + pr.h / 2, { steps: 12 });
  g = await guides();
  h.ok('drag off the left ruler: a vertical guide where you let go (2")', g.length === 1 && g[0].axis === 'vertical' && Math.abs(g[0].pos - 144) < 2, { g });
  const rh = await h.rect('#ruler-h');
  await h.drag(pr.x + pr.w / 2, rh.cy, pr.x + pr.w / 2, pr.y + 100 * ppt, { steps: 12 });
  g = await guides();
  h.ok('drag off the top ruler: a horizontal guide too', g.length === 2 && g.some((x) => x.axis === 'horizontal' && Math.abs(x.pos - 100) < 2), { g });
  await h.shot('guides-from-rulers');
  await h.clickSel('#pg-guides');
  await h.clickSel('#gd-clear');
  await h.wait(300);
  h.ok('Clear All Ruler Guides', (await guides()).length === 0);
  await h.clickSel('#save');
  await h.until(`/Saved/.test(document.getElementById('status').textContent)`, 5000);

  // ---- Page Setup: margins
  await h.clickSel('#pg-margins');
  h.ok('Margins opens Page Setup', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="top"]')`, 2000));
  await h.shot('page-setup');
  const top = await h.rect('dialog input[name="top"]');
  await h.click(top.cx, top.cy);
  await h.key('A', ['control']);
  await h.type('0.75');
  await h.clickSel('dialog .pd-ok');
  await h.until(`/Page Setup/.test(document.getElementById('status').textContent)`, 10000);
  await h.wait(600);
  h.ok('top margin 0.75" saved in the week file', manifest().margins.top === 54, { m: manifest().margins });
  h.ok('…and the margin guide moved', (await h.js(`document.querySelector('${page(P)} .margin-guide').style.top`)) === '54pt');
  const mb = await ed(`ed.marginBox(${P}).y`);
  h.ok('…alignment uses the new margin', mb === 54, { mb });

  // ---- Page Setup: size → tabloid booklet
  await h.clickSel('#pg-size');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] #ps-preset')`, 2000);
  await h.js(`(() => { const s = document.querySelector('#ps-preset'); s.value = 'tabloid-booklet'; s.dispatchEvent(new Event('change')); })()`);
  h.ok('a preset fills in the size (8.5 × 11)', (await h.js(`document.querySelector('#ps-width').value`)) === '8.5' && (await h.js(`document.querySelector('#ps-height').value`)) === '11');
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().manifest.page.width === 612`, 10000);
  await h.wait(800);
  h.ok('Size ▸ Tabloid booklet: 8.5 × 11 in pages on disk, preset recorded', manifest().page.width === 612 && manifest().page.height === 792 && manifest().preset === 'tabloid-booklet');
  const shown = await h.rect(page(P));
  h.ok('…the pages are drawn taller (ratio 8.5:11)', Math.abs(shown.w / shown.h - 612 / 792) < 0.01, { ratio: shown.w / shown.h });
  await h.shot('tabloid');

  // ---- Orientation ▸ Landscape, then back
  await h.clickSel('#pg-orient');
  await h.clickSel('#or-landscape');
  await h.until(`window.__bbWeek().manifest.page.width === 792`, 10000);
  await h.wait(600);
  h.ok('Orientation ▸ Landscape swaps width and height', manifest().page.width === 792 && manifest().page.height === 612);
  await h.clickSel('#pg-orient');
  await h.clickSel('#or-portrait');
  await h.until(`window.__bbWeek().manifest.page.width === 612`, 10000);
  h.ok('…Portrait swaps them back', manifest().page.width === 612);
  h.ok('a copy of the week before each Page Setup change is in its history folder', fs.readdirSync(path.join(path.dirname(h.weekCopy), 'history')).filter((f) => f.startsWith('manifest-pagesetup-')).length >= 3);
};
