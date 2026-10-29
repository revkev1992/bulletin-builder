// GUI suite: item 6 — Bulletin ▸ Finish Layout / Back to Draft on an Order-of-Worship week.
// The pages must look the same after finishing, become typeable, keep their page breaks after an
// edit, save, and Back to Draft / Undo must work.
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  // what is on each worship page: frame boxes + text, read from the screen
  const pagesNow = () => h.js(`(() => { const w = window.__bbWeek(); const out = {};
    for (const p of w.manifest.pages.filter((p) => p.half === 'worship')) {
      const sh = document.querySelector('.page-shell[data-page="' + p.number + '"] .page');
      out[p.number] = [...sh.querySelectorAll('p.para')].map((x) => x.textContent.replace(/[\\s\\u200b]+/g, ' ').trim()).filter(Boolean); }
    return out; })()`);
  const firstLines = (pg) => Object.fromEntries(Object.entries(pg).map(([n, ps]) => [n, ps[0] || '']));

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  h.ok('Finish Layout greyed until you are changing the worship pages', await h.disabled('#rb-finish'));
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'worship'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(800);
  h.ok('Finish Layout enabled for a drafted week; Back to Draft greyed', !(await h.disabled('#rb-finish')) && (await h.disabled('#rb-draft')));
  const before = await pagesNow();
  // every line's place on its page, to the pixel (one box per page now: the gaps become space before)
  const linesAt = () => h.js(`(() => { const w = window.__bbWeek(); const out = [];
    for (const p of w.manifest.pages.filter((p) => p.half === 'worship')) {
      const sh = document.querySelector('.page-shell[data-page="' + p.number + '"] .page'); const o = sh.getBoundingClientRect();
      for (const x of sh.querySelectorAll('p.para')) { if (!x.textContent.trim()) continue; const r = x.getClientRects()[0] || x.getBoundingClientRect();
        out.push(p.number + ':' + Math.round(r.top - o.top) + ':' + x.textContent.trim().slice(0, 24)); } }
    return out.sort(); })()`);
  const lines0 = await linesAt();
  // where the music is: picture boxes now, in-line pictures after finishing (page + rectangle, to the pixel)
  const musicAt = () => h.js(`(() => { const w = window.__bbWeek(); const first = w.manifest.pages.filter((p) => p.half === 'worship')[0].number; const out = [];
    for (const p of w.manifest.pages.filter((p) => p.half === 'worship' && p.number !== first)) {
      const sh = document.querySelector('.page-shell[data-page="' + p.number + '"] .page');
      for (const e of sh.querySelectorAll('.frame-image, img.inline-pic')) { const r = e.getBoundingClientRect(), o = sh.getBoundingClientRect(); out.push([p.number, (r.left - o.left).toFixed(1), (r.top - o.top).toFixed(1), r.width.toFixed(1), r.height.toFixed(1)].join(',')); } }
    return out.sort(); })()`);
  const music0 = await musicAt();

  await h.clickSel('#rb-finish');
  h.ok('Finish Layout asks first', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000));
  await h.shot('finish-confirm');
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().halves.worship.mode === 'finished'`, 8000);
  await h.wait(800);
  const half = await h.js(`(() => { const w = window.__bbWeek().halves.worship; let gen = 0, chained = 0, ff = 0; const stories = new Set();
    for (const pg of Object.values(w.pages)) for (const f of pg.frames) { if (f.generated) gen++; if (f.text && f.text.chain) { chained++; stories.add(f.text.chain.story); }
      if (f.text) for (const p of f.text.paragraphs) for (const r of p.runs) if (r.text.includes('\\u000c')) ff++; }
    return { mode: w.mode, gen, chained, stories: stories.size, ff, draft: !!w.draft }; })()`);
  h.ok('worship pages finished: no laid-out (locked) objects left, draft kept', half.mode === 'finished' && half.gen === 0 && half.draft, half);
  h.ok('…body text boxes linked into ONE story', half.chained > 5 && half.stories === 1, half);
  h.ok('…each page ends with a text box break', half.ff >= 7, half);
  h.ok('…the Order of Worship panel is put away', await h.js(`document.getElementById('flowpanel').hidden`));
  const after = await pagesNow();
  h.ok('the pages read exactly the same after finishing', JSON.stringify(after) === JSON.stringify(before),
    { diff: Object.keys(before).filter((n) => JSON.stringify(before[n]) !== JSON.stringify(after[n])) });
  const lines1 = await linesAt();
  // within a pixel: the gaps become rounded spacing (0.01 pt), so a line can land a sub-pixel off
  const near = (x, list, tol) => { const [pg, y, ...t] = x.split(':'); return list.some((z) => { const [pg2, y2, ...t2] = z.split(':'); return pg2 === pg && t2.join(':') === t.join(':') && Math.abs(y2 - y) <= tol; }); };
  const moved0 = lines0.filter((x) => !near(x, lines1, 1));
  h.ok('…every line exactly where it was', moved0.length === 0, { moved: moved0.slice(0, 6), now: lines1.filter((x) => !lines0.includes(x)).slice(0, 6) });
  const boxesPerPage = await h.js(`(() => { const out = {}; for (const pg of Object.entries(window.__bbWeek().halves.worship.pages)) out[pg[0]] = pg[1].frames.filter((f) => f.text && f.text.chain).length; return out; })()`);
  h.ok('…one linked text box per page (typing pushes the whole page down)', Object.values(boxesPerPage).every((c) => c <= 1), { boxesPerPage });
  const music1 = await musicAt();
  const inl = await h.js(`document.querySelectorAll('#stage img.inline-pic').length`);
  h.ok('the music is in the text now (in-line pictures), each exactly where it was', inl > 0 && inl === music0.length && music0.every((x, i) => { const p = x.split(','), q = (music1[i] || '').split(','); return p[0] === q[0] && p.slice(1).every((v, k) => Math.abs(v - q[k + 1]) <= 0.6); }),
    { inl, n0: music0.length, gone: music0.filter((x) => !music1.includes(x)), now: music1.filter((x) => !music0.includes(x)) });
  await h.shot('finished');

  // the text of the whole story (to prove nothing is lost when text flows on)
  const storyText = () => h.js(`(() => { const w = window.__bbWeek().halves.worship; const fs = [];
    for (const pg of Object.values(w.pages)) for (const f of pg.frames) if (f.text && f.text.chain) fs.push(f);
    fs.sort((a, b) => a.text.chain.index - b.text.chain.index);
    return fs.map((f) => f.text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('')).join('').replace(/[\\s\\u000c\\u00a0]+/g, ''); })()`);
  // a page whose last linked box still has room at the bottom
  const roomy = await h.js(`(() => { for (const sh of document.querySelectorAll('.page-shell')) { const n = Number(sh.dataset.page); if (n < 3) continue;
      const fr = [...sh.querySelectorAll('.frame[data-story]')]; if (!fr.length) continue; const last = fr[fr.length - 1];
      const ps = [...last.querySelectorAll('p.para')].filter((p) => p.textContent.trim().length > 12); if (!ps.length) continue;
      const room = last.getBoundingClientRect().bottom - ps[ps.length - 1].getBoundingClientRect().bottom; const page = sh.querySelector('.page').getBoundingClientRect();
      if (room > page.height * 0.12) return n; } return null; })()`);
  h.ok('found a worship page with room at the bottom', !!roomy, { roomy });
  const clickInto = async (n) => {
    await h.clickSel('#nav-pages .nav-page[data-page="' + n + '"]');
    await h.wait(800);
    const w = await h.js(`(() => { const ps = [...document.querySelectorAll('.page-shell[data-page="${n}"] .frame[data-story] p.para')].filter((p) => p.textContent.trim().length > 12);
      const p = ps[ps.length - 1]; const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let t = tw.nextNode(); while (t && !t.data.trim()) t = tw.nextNode();
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 1); const b = r.getBoundingClientRect(); return { x: b.left + 0.3, y: b.top + b.height / 2 }; })()`);
    await h.click(w.x, w.y);
  };
  await clickInto(roomy);
  h.ok('one click in worship text starts typing', await ed('!!ed.textEdit'));
  await h.type('ADDED LINE ONE. ');
  await h.key('Escape', [], 1500);
  let edited = await pagesNow();
  let f0 = firstLines(before), f1 = firstLines(edited);
  let moved = Object.keys(f0).filter((n) => f0[n] !== f1[n]);
  h.ok('typing on page ' + roomy + ' (room at the bottom) is kept', JSON.stringify(edited[roomy]).includes('ADDED LINE ONE'));
  h.ok('…and no other page moved: the page breaks hold', moved.length === 0, { moved });
  await h.shot('typed-roomy-page');

  // with ¶ on, typing on one page must not move the next (the break label used to take room and
  // re-wrap a full page's last line)
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-marks');
  const m0 = await pagesNow();
  await clickInto(2);
  await h.type('Z');
  await h.key('Backspace');
  await h.key('Escape', [], 1500);
  const m1 = await pagesNow();
  h.ok('with ¶ showing, an edit leaves every page as it was', JSON.stringify(m0) === JSON.stringify(m1),
    { diff: Object.keys(m0).filter((n) => JSON.stringify(m0[n]) !== JSON.stringify(m1[n])) });
  await h.shot('marks-on');
  await h.clickSel('#rb-marks');


  // a NEW paragraph on full page 5 (it ends with a whole paragraph + its page-end break): the page-end break must not travel
  // with the pushed text — one line pushed on must not empty a later page (batch-3 run 2026-10-27:
  // page 6 went nearly blank and page 7 overflowed)
  const perPage = () => h.js(`(() => { const out = {}; for (const sh of document.querySelectorAll('.page-shell')) {
      out[sh.dataset.page] = [...sh.querySelectorAll('.frame[data-story] p.para')].map((p) => p.textContent).join('').length; } return out; })()`);
  const overNow = () => h.js(`[...document.querySelectorAll('#stage .frame[data-story].overflow')].filter((f) => window.__bbWeek().manifest.pages.find((p) => p.number === Number(f.closest('[data-page]').dataset.page)).half === 'worship').length`);
  const overWhere = () => h.js(`[...document.querySelectorAll('#stage .frame.overflow')].map((f) => f.closest('[data-page]').dataset.page + ':' + f.dataset.id + ':' + (f.dataset.story || ''))`);
  const c0 = await perPage();
  await clickInto(5);
  await h.type('EXTRA LINE THREE.');
  await h.key('Enter');
  await h.key('Escape', [], 2000);
  const c1 = await perPage();
  const emptied = Object.keys(c0).filter((n) => Number(n) > 5 && c0[n] > 300 && c1[n] < c0[n] * 0.6);
  h.ok('a new line on a full page pushes text on a line at a time — no later page empties', emptied.length === 0, { emptied, c0, c1 });
  h.ok('…and the story still fits', (await overNow()) === 0, { over: await overNow(), where: await overWhere() });
  await h.shot('new-line-on-full-page');

  // a full page (3): extra text flows on into the next pages, as in Publisher — and nothing is lost
  const t0 = await storyText();
  await clickInto(3);
  await h.type('ADDED LINE TWO, WHICH DOES NOT FIT ON A FULL PAGE AND MUST FLOW ON. ');
  await h.key('Escape', [], 2000);
  const t1 = await storyText();
  const added = 'ADDEDLINETWO,WHICHDOESNOTFITONAFULLPAGEANDMUSTFLOWON.';
  const i = t1.indexOf(added);
  h.ok('typing on a full page: the text flows on and none of the story is lost', i >= 0 && t1.slice(0, i) + t1.slice(i + added.length) === t0,
    { t0: t0.length, t1: t1.length, at: i, around: JSON.stringify(t1.slice(t1.indexOf('ADDED') - 10, t1.indexOf('ADDED') + 90)) });
  const lastOver = await h.js(`[...document.querySelectorAll('#stage .frame[data-story].overflow')].filter((f) => window.__bbWeek().manifest.pages.find((p) => p.number === Number(f.closest('[data-page]').dataset.page)).half === 'worship').length`);
  h.ok('…and the story still fits (nothing left over at the end)', lastOver === 0, { lastOver });
  // the music went along with its text: every in-line picture is still below the line before it
  // (batch-3 run 2026-10-28: the psalm music stayed put and PSALTER ended up under it)
  const musicOrder = await h.js(`(() => { const boxes = [...document.querySelectorAll('#stage .frame[data-story]')]
      .sort((a, b) => Number(a.dataset.story.split('#')[1]) - Number(b.dataset.story.split('#')[1]));
    const ps = []; for (const b of boxes) for (const p of b.querySelectorAll('p.para')) ps.push({ p, page: Number(b.closest('[data-page]').dataset.page) });
    const bad = []; let n = 0;
    ps.forEach((x, i) => { if (!x.p.querySelector('img.inline-pic')) return; n++;
      let j = i - 1; while (j >= 0 && !ps[j].p.textContent.trim()) j--; if (j < 0) return;
      const a = ps[j].p.getBoundingClientRect(), b = x.p.querySelector('img.inline-pic').getBoundingClientRect();
      if (!(ps[j].page < x.page || (ps[j].page === x.page && a.bottom <= b.top + 1))) bad.push(x.page + ': under "' + ps[j].p.textContent.slice(0, 30) + '"'); });
    return { n, bad }; })()`);
  h.ok('…and the music moved with its text: each picture still follows the line before it', musicOrder.n > 0 && musicOrder.bad.length === 0, musicOrder);
  const badJust = await h.js(`(() => { const out = []; for (const [n, pg] of Object.entries(window.__bbWeek().halves.worship.pages)) for (const f of pg.frames)
    if (f.text) for (const p of f.text.paragraphs) if (p.justifyLast && !p.continues) out.push(n + ': ' + p.runs.map((r) => r.text).join('').slice(0, 40)); return out; })()`);
  h.ok('only a paragraph cut at a box edge stretches its last line (no stretched real last lines)', badJust.length === 0, { badJust });

  // save → on disk
  await h.clickSel('#save');
  await h.until(`/Saved/.test(document.getElementById('status').textContent)`, 5000);
  const disk = JSON.parse(fs.readFileSync(path.join(h.tmp, 'worship.json'), 'utf8'));
  h.ok('saved: the worship file says finished, keeps the draft and the typing', disk.mode === 'finished' && !!disk.draft && JSON.stringify(disk.pages).includes('ADDED LINE ONE'));

  // Back to Draft, then Undo
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  h.ok('Back to Draft enabled; Finish Layout greyed', !(await h.disabled('#rb-draft')) && (await h.disabled('#rb-finish')));
  await h.clickSel('#rb-draft');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().halves.worship.mode === 'flow'`, 8000);
  await h.wait(800);
  const back = await pagesNow();
  h.ok('Back to Draft: laid out by the panel again (hand typing gone), panel back', JSON.stringify(back) === JSON.stringify(before) && !(await h.js(`document.getElementById('flowpanel').hidden`)),
    { diff: Object.keys(before).filter((n) => JSON.stringify(before[n]) !== JSON.stringify(back[n])) });
  await h.clickSel('#undo');
  await h.until(`window.__bbWeek().halves.worship.mode === 'finished'`, 8000);
  await h.wait(600);
  h.ok('Undo: finished again, with the typing', JSON.stringify(await pagesNow()).includes('ADDED LINE ONE'));

  // delete a page: its text pours into the later pages, and must go AROUND their margin notes and
  // music, not under them (batch-3 run 2026-10-28: 10-11 page 6 deleted → the sermon line ran under
  // the "Lift Up Your Hearts" note)
  const overlaps = () => h.js(`(() => { const w = window.__bbWeek().halves.worship; const ids = new Set();
    for (const pg of Object.values(w.pages)) for (const f of pg.frames) if (f.note || f.kind === 'image') ids.add(f.id);
    const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const out = [];
    for (const sh of document.querySelectorAll('.page-shell')) {
      const pics = [...sh.querySelectorAll('img.inline-pic')];
      const obs0 = [...sh.querySelectorAll('.frame')].filter((e) => ids.has(e.dataset.id)).map((e) => e.getBoundingClientRect());
      for (const p of sh.querySelectorAll('.frame[data-story] p.para')) {
        const obs = [...obs0, ...pics.filter((i) => !p.contains(i)).map((i) => i.getBoundingClientRect())];
        const r = document.createRange(); r.selectNodeContents(p);
        for (const line of r.getClientRects()) if (line.width > 2 && obs.some((o) => hit(line, o))) out.push(sh.dataset.page + ': ' + p.textContent.slice(0, 40));
      }
    } return [...new Set(out)]; })()`);
  h.ok('finished pages: no text under a margin note or music', (await overlaps()).length === 0, { over: await overlaps() });
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#nav-pages .nav-page[data-page="6"]');
  await h.wait(600);
  await h.clickSel('#pg-delete');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(2000);
  const over = await overlaps();
  h.ok('…after deleting page 6, its text flows on around the notes and music', over.length === 0, { over });
  await h.shot('page-deleted');
};
