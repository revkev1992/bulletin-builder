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
  const lastOver = await h.js(`document.querySelectorAll('#stage .frame[data-story].overflow').length`);
  h.ok('…and the story still fits (nothing left over at the end)', lastOver === 0, { lastOver });
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
};
