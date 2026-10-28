// GUI suite: Show Formatting (Kevin 2026-10-27, Publisher's Special Characters, Ctrl+Shift+Y): dots for
// spaces, ¶, tab arrows, line-break marks; ONE switch at the top right of the ribbon on every tab (and
// Home ▸ ¶); it must toggle off cleanly and the marks must take no room (no line may move).
const A = 'f502';

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  // where every paragraph sits, to the pixel (the marks must never move a line)
  const lines = () => h.js(`[...document.querySelectorAll('#stage p.para')].map((p) => { const r = p.getBoundingClientRect(); return [Math.round(r.left * 4), Math.round(r.top * 4), Math.round(r.height * 4)].join(','); }).join(';')`);
  const state = () => h.js(`({ on: document.body.classList.contains('show-marks'), layers: document.querySelectorAll('#stage .marks-layer').length,
    dots: document.querySelectorAll('#stage .mk-dot').length, top: document.getElementById('marks-toggle').classList.contains('active'),
    home: document.getElementById('rb-marks').classList.contains('active'), kept: localStorage.getItem('bb.marks') })`);
  const dotsOn = (n) => h.js(`document.querySelectorAll('.page-shell[data-page="${n}"] .mk-dot').length`);

  // start from off whatever this PC remembered
  if ((await state()).on) await h.clickSel('#marks-toggle');
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.js(`document.querySelector('.page-shell[data-page="10"]').scrollIntoView({ block: 'start' })`);
  await h.wait(600);
  const s0 = await state();
  const l0 = await lines();
  h.ok('starts off: no marks', !s0.on && s0.layers === 0, s0);

  // the switch sits at the top right of the ribbon, on every tab
  const nav = await h.rect('.rb-tabs');
  for (const tab of ['home', 'insert', 'view', 'bulletin']) {
    await h.clickSel(`.rb-tab[data-tab="${tab}"]`);
    const b = await h.rect('#marks-toggle');
    h.ok('Show Formatting is at the top right with the ' + tab + ' tab', b && b.w > 0 && b.x + b.w > nav.x + nav.w - 12 && b.y < nav.y + nav.h, { b, nav });
  }

  // on
  await h.clickSel('#marks-toggle');
  await h.wait(500);
  const s1 = await state();
  h.ok('click: on — a dot for each space on every page, both buttons lit, remembered', s1.on && s1.layers >= 10 && s1.dots > 500 && s1.top && s1.home && s1.kept === '1', s1);
  h.ok('…and no line moved', (await lines()) === l0);
  const para = await h.js(`getComputedStyle(document.querySelector('#stage .page p.para'), '::after').content`);
  h.ok('¶ at the end of each paragraph', para.includes('¶'), { para });
  const tab = await h.js(`(() => { const t = document.querySelector('#stage .page .tab'); return t ? getComputedStyle(t, '::after').content : 'none'; })()`);
  h.ok('an arrow for each tab', tab.includes('→'), { tab });
  // the dots are where the spaces are
  const miss = await h.js(`(() => { const out = []; const pg = document.querySelector('.page-shell[data-page="10"] .page');
    const dots = [...pg.querySelectorAll('.mk-dot')].map((d) => d.getBoundingClientRect()).map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
    const tw = document.createTreeWalker(pg.querySelector('.frame[data-id="${A}"]'), NodeFilter.SHOW_TEXT); let n = 0;
    for (let t; (t = tw.nextNode()) && n < 40;) for (let i = 0; i < t.data.length && n < 40; i++) if (t.data[i] === ' ') {
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getBoundingClientRect(); if (!b.width) continue; n++;
      const cx = b.left + b.width / 2; if (!dots.some((d) => Math.abs(d.x - cx) < 1.5 && d.y > b.top && d.y < b.bottom)) out.push(Math.round(cx)); }
    return { n, out }; })()`);
  h.ok('each dot sits in its space (40 spaces checked)', miss.n === 40 && miss.out.length === 0, miss);
  await h.shot('marks-on');

  // typing: the dots follow the text
  const d0 = await dotsOn(10);
  const w = await h.js(`(() => { const r = document.querySelector('.page-shell[data-page="10"] .frame[data-id="${A}"] p.para').getBoundingClientRect(); return { x: r.left + 2, y: r.top + r.height / 2 }; })()`);
  await h.click(w.x, w.y);
  await h.key('Home');
  h.ok('typing in the page-10 box with marks showing', await ed(`ed.textEdit && ed.textEdit.id === '${A}'`));
  await h.type('Ab cd ef ');
  await h.wait(500);
  const d1 = await dotsOn(10);
  h.ok('typing three spaces adds three dots', d1 === d0 + 3, { d0, d1 });
  await h.key('Enter', ['shift']);
  await h.wait(500);
  h.ok('Shift+Enter shows a line-break arrow', (await h.js(`document.querySelectorAll('.page-shell[data-page="10"] .mk-br').length`)) >= 1,
    await h.js(`(() => { const brs = [...document.querySelectorAll('.page-shell[data-page="10"] p.para br')]; return { n: brs.length,
      r: brs.slice(0, 2).map((b) => { const r = document.createRange(); r.selectNode(b); return [JSON.stringify(r.getBoundingClientRect()), r.getClientRects().length, JSON.stringify(b.getBoundingClientRect())]; }),
      html: document.querySelector('.page-shell[data-page="10"] .frame[data-id="${A}"] p.para').innerHTML.slice(0, 200) }; })()`));
  await h.shot('typing-with-marks');
  // put it back: Undo (ribbon) the typing
  await h.key('Escape', [], 600);
  await h.clickSel('#undo');
  await h.wait(800);

  // the Home ▸ ¶ button is the same switch
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-marks');
  await h.wait(300);
  const s2 = await state();
  h.ok('Home ▸ ¶ turns it off too (both buttons follow)', !s2.on && s2.layers === 0 && !s2.top && !s2.home && s2.kept === '0', s2);
  await h.clickSel('#rb-marks');
  await h.wait(400);
  h.ok('…and on again', (await state()).on && (await state()).top);

  // Ctrl+Shift+Y: off, cleanly (lines compared with marks on, just before)
  const lOn = await lines();
  await h.key('Y', ['control', 'shift'], 400);
  const s3 = await state();
  h.ok('Ctrl+Shift+Y turns it off: no dots, no ¶, buttons out', !s3.on && s3.layers === 0 && s3.dots === 0 && !s3.top && !s3.home, s3);
  const paraOff = await h.js(`getComputedStyle(document.querySelector('#stage .page p.para'), '::after').content`);
  h.ok('…no ¶ left', !paraOff.includes('¶'), { paraOff });
  h.ok('…and no line moved', (await lines()) === lOn);
  await h.key('Y', ['control', 'shift'], 400);
  h.ok('Ctrl+Shift+Y again: back on', (await state()).on);
  await h.clickSel('#marks-toggle');      // leave this PC with it off
  h.ok('top-right switch: off', !(await state()).on);
  await h.shot('marks-off');
};
