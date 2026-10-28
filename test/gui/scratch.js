// GUI suite: parked objects (Kevin 2026-10-27). The Shelf down the left stays put while the pages scroll;
// Publisher's free-form Scratch Area beside the pages is built but off by default (while it is off,
// its items are on the shelf). Park, scroll, drag onto a page, drag off a page, facing page, Delete,
// Undo, View toggles, the other half, save.
const fs = require('fs');
const path = require('path');
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const pbf = () => h.js(`(window.__bbWeek().halves.announcements.pasteboard || []).map((f) => ({ id: f.id, shelf: !!f.shelf, fx: f.fx }))`);
  const pb = async () => (await pbf()).map((f) => f.id);
  const shelfItem = (id) => `#shelf .scratch-item[data-id="${id}"] .frame`;
  const freeItem = (id) => `.free-area .scratch-item[data-id="${id}"] .frame`;
  const onPage = (n, id) => ed(`!!ed.topFrame(${n}, '${id}')`);
  // Pages pane click scrolls smoothly: wait until the pages stop moving
  const goTo = async (n) => {
    await h.clickSel(`#nav-pages .nav-page[data-page="${n}"]`);
    let last = -1;
    for (let k = 0; k < 40; k++) { await h.wait(120); const t = await h.js("document.getElementById('stage').scrollTop"); if (t === last) break; last = t; }
  };
  const newRect = async (n) => {
    await goTo(n);
    await h.clickSel('.rb-tab[data-tab="insert"]');
    await h.clickSel('#rb-shapes');
    await h.clickSel('#ins-rect');
    await h.wait(300);
    return ed('ed.sel && ed.sel.id');
  };

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.wait(500);
  const pb0 = await pb();
  h.ok('Shelf on, free-form Scratch Area off by default', await h.js(`document.getElementById('shelf-btn').checked && !document.getElementById('pasteboard-btn').checked && getComputedStyle(document.getElementById('shelf')).display !== 'none'`));
  h.ok('…with it off, Publisher\'s old scratch items are on the shelf (none out of reach)', pb0.length > 0 && (await h.js(`document.querySelectorAll('#shelf .scratch-item').length`)) === pb0.length, { n: pb0.length });
  const st = await h.rect('#stage');
  const sh = await h.rect('#shelf');
  const firstPage = await h.rect('.page-shell .page');
  h.ok('the shelf does not cover the pages', sh.x + sh.w <= firstPage.x + 1, { sh, firstPage });
  await h.shot('shelf');

  // Park a rectangle: it goes on the shelf
  const id = await newRect(P);
  h.ok('a rectangle on page ' + P, !!id && (await onPage(P, id)));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#to-pasteboard');
  await h.wait(600);
  h.ok('Park: off the page, onto the shelf', !(await onPage(P, id)) && (await pbf()).some((f) => f.id === id && f.shelf));
  await h.js(`document.querySelector('#shelf .scratch-item[data-id="${id}"]').scrollIntoView({ block: 'nearest' })`);
  const r0 = await h.rect(shelfItem(id));
  h.ok('…shown on the shelf, small enough to fit', !!r0 && r0.x >= sh.x && r0.x + r0.w <= sh.x + sh.w, { r0, sh });

  // scroll the pages: the shelf item stays put
  await h.js(`document.getElementById('stage').scrollTop += 1500`);
  await h.wait(400);
  const r1 = await h.rect(shelfItem(id));
  h.ok('scrolling the pages leaves the shelf where it is', Math.abs(r1.x - r0.x) < 1 && Math.abs(r1.y - r0.y) < 1);

  // drag it from the shelf onto page 16 (it lands at full size where it is dropped)
  await goTo(16);
  const r2 = await h.rect(shelfItem(id));
  const pg = await h.rect('.page-shell[data-page="16"] .page');
  await h.drag(r2.cx, r2.cy, pg.cx, pg.cy, { steps: 14 });
  await h.wait(800);
  h.ok('drag from the shelf onto page 16: on the page, off the shelf', (await onPage(16, id)) && !(await pb()).includes(id));
  const fr = await h.rect(`.page-shell[data-page="16"] .frame[data-id="${id}"]`);
  h.ok('…at full size, where the mouse let go', fr && Math.abs(fr.cx - pg.cx) < 16 && Math.abs(fr.cy - pg.cy) < 16, { fr, pg });
  await h.shot('placed-on-16');
  await h.clickSel('#undo'); await h.wait(700);
  h.ok('Undo: back on the shelf', !(await onPage(16, id)) && (await pbf()).some((f) => f.id === id && f.shelf));
  await h.clickSel('#redo'); await h.wait(700);
  h.ok('Redo: on page 16 again', await onPage(16, id));

  // drag a page object off its page onto the shelf
  let f16 = await h.rect(`.page-shell[data-page="16"] .frame[data-id="${id}"]`);
  await h.drag(f16.cx, f16.cy, sh.x + sh.w / 2, sh.y + 80, { steps: 16, mods: ['alt'] });
  await h.wait(800);
  h.ok('drag a page object onto the shelf: shelved', !(await onPage(16, id)) && (await pbf()).some((f) => f.id === id && f.shelf));

  // Delete on a selected shelf item; Undo
  await h.js(`document.querySelector('#shelf .scratch-item[data-id="${id}"]').scrollIntoView({ block: 'nearest' })`);
  const r4 = await h.rect(shelfItem(id));
  await h.click(r4.cx, r4.cy);
  h.ok('click a shelf item: selected', await h.js(`!!document.querySelector('#shelf .scratch-item.selected[data-id="${id}"]')`));
  await h.key('Delete', [], 600);
  h.ok('Delete removes it', !(await pb()).includes(id));
  await h.clickSel('#undo'); await h.wait(600);
  h.ok('Undo puts it back on the shelf', (await pbf()).some((f) => f.id === id && f.shelf));

  // with the free-form area off, a drop in the grey (not a page) goes on the shelf
  const id3 = await newRect(16);
  const a3 = await h.rect(`.page-shell[data-page="16"] .frame[data-id="${id3}"]`);
  const p16 = await h.rect('.page-shell[data-page="16"] .page');
  await h.drag(a3.cx, a3.cy, p16.x + p16.w + 60, a3.cy, { steps: 14, mods: ['alt'] });
  await h.wait(800);
  h.ok('drop in the grey with the Scratch Area off: onto the shelf', !(await onPage(16, id3)) && (await pbf()).some((f) => f.id === id3 && f.shelf));

  // facing pages: a page-14 object dragged onto page 15 moves there
  const id2 = await newRect(P);
  const a = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${id2}"]`);
  const p15 = await h.rect('.page-shell[data-page="15"] .page');
  await h.drag(a.cx, a.cy, p15.cx, a.cy, { steps: 14, mods: ['alt'] });
  await h.wait(800);
  h.ok('drag from page 14 onto the facing page 15: it moves there', (await onPage(15, id2)) && !(await onPage(P, id2)));

  // View ▸ Scratch Area on: Publisher's items are laid out beside the pages, as Publisher had them
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#pasteboard-btn');
  await h.wait(800);
  h.ok('View ▸ Scratch Area on: the old Publisher items move into it beside the pages', (await h.js(`document.querySelectorAll('.free-area .scratch-item').length`)) === pb0.length && (await h.js(`document.querySelectorAll('#shelf .scratch-item').length`)) === 2);
  const legacy = await h.rect(freeItem(pb0[0]));
  const pageR = await h.rect('.page-shell .page');
  h.ok('…to the right of the pages', !!legacy && legacy.x > pageR.x, { legacy });
  await h.shot('scratch-area-on');
  // a page object dropped in the grey now lands in the free-form area where you let go
  const id4 = await newRect(16);
  const a4 = await h.rect(`.page-shell[data-page="16"] .frame[data-id="${id4}"]`);
  const q16 = await h.rect('.page-shell[data-page="16"] .page');
  const drop = { x: q16.x + q16.w + 70, y: a4.cy };
  await h.drag(a4.cx, a4.cy, drop.x, drop.y, { steps: 14, mods: ['alt'] });
  await h.wait(800);
  const ff = (await pbf()).find((f) => f.id === id4);
  const r5 = await h.rect(freeItem(id4));
  h.ok('with the Scratch Area on, a drop in the grey parks it there, where you let go', !!ff && !ff.shelf && ff.fx != null && r5 && Math.abs(r5.cx - drop.x) < 16 && Math.abs(r5.cy - drop.y) < 16, { ff, r5, drop });
  // it scrolls with the pages
  const y5 = r5.y;
  await h.js(`document.getElementById('stage').scrollTop -= 300`);
  await h.wait(300);
  h.ok('…and scrolls with the pages (Publisher)', Math.abs((await h.rect(freeItem(id4))).y - (y5 + 300)) < 3, { y5, now: (await h.rect(freeItem(id4))).y });
  // Scratch Area off again: everything is on the shelf
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#pasteboard-btn');
  await h.wait(600);
  h.ok('Scratch Area off: its items are on the shelf again', (await h.js(`document.querySelectorAll('#shelf .scratch-item').length`)) === pb0.length + 3);
  // Shelf off / on
  await h.clickSel('#shelf-btn');
  h.ok('View ▸ Shelf off hides it', (await h.js(`getComputedStyle(document.getElementById('shelf')).display`)) === 'none');
  await h.clickSel('#shelf-btn');
  h.ok('…on shows it', (await h.js(`getComputedStyle(document.getElementById('shelf')).display`)) !== 'none');

  // the other half sees the items but cannot move them
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'worship'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(400);
  h.ok('changing the worship pages: announcement items shown but not movable', !(await h.js(`document.querySelector('#shelf .scratch-item[data-id="${id}"]').classList.contains('mine')`)));
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');

  // saved with the week, on no page
  await h.clickSel('#save');
  await h.wait(800);
  const disk = JSON.parse(fs.readFileSync(path.join(h.tmp, 'announcements.json'), 'utf8'));
  h.ok('saved with the week: shelf item marked, free-form item with its place', disk.pasteboard.some((f) => f.id === id && f.shelf) && disk.pasteboard.some((f) => f.id === id4 && f.fx != null));
  h.ok('…on no page', ![id, id3, id4].some((x) => Object.values(disk.pages).some((pg) => JSON.stringify(pg).includes('"' + x + '"'))));
  h.ok('Publisher\'s old scratch items are all still there', pb0.every((x) => disk.pasteboard.some((f) => f.id === x)));
};
