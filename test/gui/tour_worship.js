// Acceptance tour (not in run-all): Kevin's ☐ YOU items from test batch 5 (+ B6 #8) on a DRAFT worship week
// (10-18): the volunteers form, Page Setup top 0.75", Finish Layout leaves the cover alone, typing on page 3
// flows onto page 4, typing in the Great Thanksgiving moves the music below it. Screenshots for a human eye.
//   electron . --gui test/gui/tour_worship.js "<10-18 week.bulletin>" out/tour-wor
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const blocks = () => h.js('window.__bbWeek().halves.worship.flow.blocks');
  const go = async (n) => { await h.clickSel(`#nav-pages .nav-page[data-page="${n}"]`); await h.wait(800); await h.js(`document.querySelector('.page-shell[data-page="${n}"]').scrollIntoView({ block: 'start' })`); await h.wait(400); };
  const typeIn = async (test, text) => { await h.reveal(`#flowpanel [data-test="${test}"]`); const r = await h.rect(`#flowpanel [data-test="${test}"]`); await h.click(r.cx, r.cy); await h.key('A', ['control']); await h.type(text); await h.key('Tab'); await h.wait(900); };

  await h.js(`window.__bbSetMode('worship')`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(800);
  await h.clickSel('#zoom-100');

  // ---- B5 #3: the volunteers & attendance lines → the form; a name and next Sunday's numbers
  const id = (await blocks()).find((b) => b.kind === 'text' && JSON.stringify(b.paragraphs || []).includes('Attendance for'))?.id;
  h.ok('B5#3 found the volunteers/attendance lines', !!id);
  if (id) {
    await h.reveal(`#flowpanel .fp-row[data-id="${id}"]`);
    await h.clickSel(`#flowpanel .fp-row[data-id="${id}"]`);
    await h.wait(1200);
    await typeIn('names-0', 'Jamie Pierce');
    await typeIn('inp-0', '112');
    await typeIn('str-0', '48');
    if (await h.rect('#flowpanel [data-test="inp-1"]')) { await typeIn('inp-1', '205'); await typeIn('str-1', '61'); }
    const pageOf = await h.js(`(() => { const p = document.querySelector('.page p.para[data-block="${id}"]'); return p ? Number(p.closest('.page-shell').dataset.page) : null; })()`);
    if (pageOf) { await go(pageOf); await h.js(`document.querySelector('.page p.para[data-block="${id}"]').scrollIntoView({ block: 'center' })`); await h.wait(400); }
    await h.shot('b5-3-volunteers-form');
    console.log('VOLUNTEER LINES: ' + JSON.stringify(await h.js(`[...document.querySelectorAll('.page p.para[data-block="${id}"]')].map((p) => p.textContent.replace(/\\s+/g, ' ').trim())`)));
  }

  // ---- B6 #8: Page Setup ▸ top 0.75" on a draft week → the worship pages re-flow
  await go(2);
  await h.shot('b6-8-before-margins');
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-margins');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="top"]')`, 2000);
  await h.js(`document.querySelector('dialog input[name="top"]').value = '0.75'`);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().manifest.margins.top === 54`, 15000);
  await h.wait(1500);
  await go(2);
  await h.shot('b6-8-after-top-0.75');
  h.ok('B6#8 margins top = 0.75" and the flow grid followed', (await h.js(`window.__bbWeek().manifest.margins.top`)) === 54 && (await h.js(`window.__bbWeek().halves.worship.flow.grid.top`)) === 54, { grid: await h.js(`window.__bbWeek().halves.worship.flow.grid`) });
  // back to 0.5" so the rest of the tour matches Kevin's week
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-margins');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="top"]')`, 2000);
  await h.js(`document.querySelector('dialog input[name="top"]').value = '0.5'`);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().manifest.margins.top === 36`, 15000);
  await h.wait(1500);

  // ---- B5 #6: Finish Layout leaves the cover alone
  await go(1);
  await h.shot('b5-6-cover-before-finish');
  const coverBefore = await h.js(`JSON.stringify((window.__bbWeek().halves.worship.pages['1'] || { frames: [] }).frames.map((f) => [f.kind, f.x, f.y, f.w, f.h, f.wrap || null]))`);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#rb-finish');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().halves.worship.mode === 'finished'`, 10000);
  await h.wait(1000);
  await go(1);
  await h.shot('b5-6-cover-after-finish');
  const coverAfter = await h.js(`JSON.stringify((window.__bbWeek().halves.worship.pages['1'] || { frames: [] }).frames.map((f) => [f.kind, f.x, f.y, f.w, f.h, f.wrap || null]))`);
  h.ok('B5#6 cover frames unchanged by Finish Layout (positions, sizes, wrap)', coverBefore === coverAfter, { before: coverBefore.slice(0, 200), after: coverAfter.slice(0, 200) });

  // ---- B5 #4: several lines typed on page 3 push onto page 4
  const firstLineOf = (n) => h.js(`(() => { const ps = [...document.querySelectorAll('.page-shell[data-page="${n}"] .frame[data-story] p.para')].filter((p) => p.textContent.trim()); return ps.length ? ps[0].textContent.trim().slice(0, 60) : ''; })()`);
  const p4Before = await firstLineOf(4);
  await go(3);
  await h.shot('b5-4-page-3-before');
  const spot = await h.js(`(() => { const ps = [...document.querySelectorAll('.page-shell[data-page="3"] .frame[data-story] p.para')].filter((p) => p.textContent.trim().length > 12);
    const p = ps[Math.min(2, ps.length - 1)]; const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let t = tw.nextNode(); while (t && !t.data.trim()) t = tw.nextNode();
    const r = document.createRange(); r.setStart(t, t.data.length); r.setEnd(t, t.data.length); const b = r.getBoundingClientRect(); return { x: b.left - 0.5, y: b.top + b.height / 2 }; })()`);
  await h.click(spot.x, spot.y);
  await h.key('End');
  await h.type('\nADDED LINE ONE — typed on page three.\nADDED LINE TWO — and another.\nADDED LINE THREE — and a third, long enough to wrap onto a second line on the page.');
  await h.key('Escape', [], 2000);
  await go(3);
  await h.shot('b5-4-page-3-after-typing');
  await go(4);
  await h.shot('b5-4-page-4-after-typing');
  const p4After = await firstLineOf(4);
  h.ok('B5#4 page 4 now starts with what was pushed off page 3', p4Before !== p4After, { p4Before, p4After });

  // ---- B5 #5: a few lines in the Great Thanksgiving: the music below moves down
  const gt = await h.js(`(() => { const ps = [...document.querySelectorAll('.page-shell[data-page] .frame[data-story] p.para')]; const i = ps.findIndex((p) => /great thanksgiving/i.test(p.textContent));
    if (i < 0) return null; const p = ps[i + 1] || ps[i]; const n = Number(p.closest('.page-shell').dataset.page);
    const pics = [...p.closest('.page').querySelectorAll('img.inline-pic, .frame-image')].map((e) => ({ top: e.getBoundingClientRect().top - p.closest('.page').getBoundingClientRect().top }));
    const picsBoth = []; for (const k of [0, 1]) { const pg = document.querySelector('.page-shell[data-page="' + (n + k) + '"] .page'); if (!pg) continue; for (const e of pg.querySelectorAll('img.inline-pic, .frame-image')) picsBoth.push({ page: n + k, top: Math.round(e.getBoundingClientRect().top - pg.getBoundingClientRect().top) }); }
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let t = tw.nextNode(); while (t && !t.data.trim()) t = tw.nextNode();
    const r = document.createRange(); r.setStart(t, t.data.length); r.setEnd(t, t.data.length); const b = r.getBoundingClientRect(); return { n, x: b.left - 0.5, y: b.top + b.height / 2, pics, picsBoth }; })()`);
  h.ok('B5#5 found the Great Thanksgiving on a finished page', !!gt, { gt: gt && { n: gt.n, pics: gt.pics.length } });
  if (gt) {
    await go(gt.n);
    await h.shot('b5-5-great-thanksgiving-before');
    const gt2 = await h.js(`(() => { const ps = [...document.querySelectorAll('.page-shell[data-page="${gt.n}"] .frame[data-story] p.para')]; const i = ps.findIndex((p) => /great thanksgiving/i.test(p.textContent)); const p = ps[i + 1] || ps[i];
      const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let t = tw.nextNode(); while (t && !t.data.trim()) t = tw.nextNode(); const r = document.createRange(); r.setStart(t, t.data.length); r.setEnd(t, t.data.length); const b = r.getBoundingClientRect(); return { x: b.left - 0.5, y: b.top + b.height / 2 }; })()`);
    await h.click(gt2.x, gt2.y);
    await h.key('End');
    await h.type('\nADDED COMMUNION LINE ONE.\nADDED COMMUNION LINE TWO.\nADDED COMMUNION LINE THREE.\nADDED COMMUNION LINE FOUR.\nADDED COMMUNION LINE FIVE.\nADDED COMMUNION LINE SIX.\nADDED COMMUNION LINE SEVEN.\nADDED COMMUNION LINE EIGHT.');
    await h.key('Escape', [], 2000);
    await go(gt.n);
    await h.shot('b5-5-great-thanksgiving-after');
    const picsNow = () => h.js(`(() => { const out = []; for (const n of [${gt.n}, ${gt.n + 1}]) { const pg = document.querySelector('.page-shell[data-page="' + n + '"] .page'); if (!pg) continue;
      for (const e of pg.querySelectorAll('img.inline-pic, .frame-image')) out.push({ page: n, top: Math.round(e.getBoundingClientRect().top - pg.getBoundingClientRect().top) }); } return out; })()`);
    const picsAfter = await picsNow();
    await go(gt.n + 1);
    await h.shot('b5-5-next-page-after');
    h.ok('B5#5 the music below the typing moved (this page or the next)', JSON.stringify(picsAfter) !== JSON.stringify(gt.picsBoth), { before: gt.picsBoth, after: picsAfter });
  }
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 5000);
  const pdf = path.join(h.outDir || path.dirname(h.weekCopy), 'tour-10-18.pdf');
  global.__bbTestExportPdf = pdf;
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.until(`!!document.querySelector('.bs-item[data-pane="export"]')`, 2000);
  await h.clickSel('.bs-item[data-pane="export"]');
  await h.clickSel('#bs-pdf');
  h.ok('PDF exported', await h.until(`/PDF saved/.test(document.getElementById('status').textContent)`, 40000) && fs.existsSync(pdf), { pdf });
  delete global.__bbTestExportPdf;
};
