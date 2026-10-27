// GUI suite: features meeting each other on a FINISHED worship week (bug hunt, 2026-10-27).
// Page delete/insert, Replace All, save + reopen, rulers — all on the one linked worship story.
exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const storyText = () => h.js(`(() => { const w = window.__bbWeek().halves.worship; const fs = [];
    for (const pg of Object.values(w.pages)) for (const f of pg.frames) if (f.text && f.text.chain) fs.push(f);
    fs.sort((a, b) => a.text.chain.index - b.text.chain.index);
    return fs.map((f) => f.text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('')).join('').replace(/[\\s\\u000c\\u00a0]+/g, ''); })()`);
  const overflowing = () => h.js(`document.querySelectorAll('#stage .frame.overflow').length`);
  const pageCount = () => h.js('window.__bbWeek().manifest.pages.length');

  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'worship'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(800);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#rb-finish');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().halves.worship.mode === 'finished'`, 8000);
  await h.wait(800);
  await h.clickSel('#save');
  await h.wait(600);
  const t0 = await storyText();
  const over0 = await overflowing();
  const n0 = await pageCount();

  // 1. delete a worship page in the middle of the story: no text may be lost
  await h.reveal('#nav-pages .nav-page[data-page="5"]');
  let r = await h.rect('#nav-pages .nav-page[data-page="5"]');
  await h.rightClick(r.cx, r.cy);
  await h.clickSel('.ctx-menu button[data-cmd="delete"]');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().manifest.pages.length === ${n0 - 1}`, 10000);
  await h.wait(1500);
  const t1 = await storyText();
  h.ok('deleting worship page 5 keeps every word of the service (poured into the other pages)', t1 === t0, { before: t0.length, after: t1.length });
  await h.shot('after-delete-p5');

  // 2. undo brings the page back, text in place
  await h.clickSel('#undo');
  await h.until(`window.__bbWeek().manifest.pages.length === ${n0}`, 10000);
  await h.wait(1200);
  h.ok('Undo puts page 5 back with the same text', (await storyText()) === t0);

  // 3. Replace All across the linked story
  await h.key('H', ['control']);
  await h.wait(300);
  const what = await h.rect('#fr-what'); await h.click(what.cx, what.cy); await h.key('A', ['control']); await h.type('Lord');
  const wth = await h.rect('#fr-with'); await h.click(wth.cx, wth.cy); await h.key('A', ['control']); await h.type('LORD');
  await h.clickSel('#fr-case');
  await h.clickSel('#fr-whole') .catch(() => {});
  await h.clickSel('#fr-all');
  await h.wait(1500);
  const t2 = await storyText();
  const nLord = (t0.match(/Lord/g) || []).length;
  h.ok('Replace All changes every "Lord" in the worship story', nLord > 3 && !/Lord/.test(t2) && (t2.match(/LORD/g) || []).length >= nLord, { nLord });
  h.ok('…and nothing new overflows', (await overflowing()) <= over0, { over0, now: await overflowing() });
  await h.clickSel('.fr-close');
  await h.clickSel('#undo'); await h.wait(1200);
  h.ok('Undo puts every "Lord" back', (await storyText()) === t0);

  // 4. insert a blank page after 4: the story does not change
  await h.reveal('#nav-pages .nav-page[data-page="4"]');
  r = await h.rect('#nav-pages .nav-page[data-page="4"]');
  await h.rightClick(r.cx, r.cy);
  await h.clickSel('.ctx-menu button[data-cmd="blank"]');
  await h.until(`window.__bbWeek().manifest.pages.length === ${n0 + 1}`, 10000);
  await h.wait(1200);
  h.ok('inserting a blank worship page leaves the story text alone', (await storyText()) === t0);
  await h.clickSel('#undo');
  await h.until(`window.__bbWeek().manifest.pages.length === ${n0}`, 10000);
  await h.wait(1000);

  // 5. save, reopen: the finished pages come back the same
  await h.clickSel('#save');
  await h.wait(600);
  const look = () => h.js(`[...document.querySelectorAll('#stage .page-shell')].map((s) => s.dataset.page + ':' + [...s.querySelectorAll('p.para')].map((p) => p.textContent.trim()).join('|').length)`);
  const l0 = await look();
  h.wc.send('week:open', h.weekCopy);
  await h.wait(4000);
  const l1 = await look();
  h.ok('save + reopen: every worship page comes back the same', JSON.stringify(l0) === JSON.stringify(l1));
  h.ok('…still finished after reopening', (await h.js(`window.__bbWeek().halves.worship.mode`)) === 'finished');
};
