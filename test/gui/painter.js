// GUI suite: Home ▸ Clipboard ▸ Format Painter — click = once, double-click = until Esc, works
// across text boxes.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const word = (w, sel = BOX) => h.js(`(() => { const box = document.querySelector('${sel}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  const pick = async (w, sel) => { const r = await word(w, sel); await h.drag(r.x0, r.y, r.x1, r.y, { steps: 5 }); await h.wait(150); return h.js('getSelection().toString()'); };
  // style of a word found anywhere on the page
  const styleOf = (w, sel = BOX) => h.js(`(() => { const box = document.querySelector('${sel}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { if (t.data.includes(${JSON.stringify(w)})) { const cs = getComputedStyle(t.parentElement); return { bold: parseInt(cs.fontWeight) >= 600, color: cs.color }; } } return null; })()`);
  const RED = 'rgb(192, 0, 0)';

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  h.ok('Format Painter greyed until you are in some text', await h.disabled('#rb-painter'));
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);

  // make "budget" bold red, keep it selected
  let r = await word('budget');
  await h.click(r.x0 + 2, r.y);
  await pick('budget');
  await h.clickSel('#t-bold');
  await h.clickSel('#t-color');
  await h.clickSel('.swatch[data-color="#C00000"]');
  h.ok('source word is bold red', JSON.stringify(await styleOf('budget')) === JSON.stringify({ bold: true, color: RED }));

  // one click: paint once
  await h.clickSel('#rb-painter');
  h.ok('Format Painter button is on', await h.js(`document.getElementById('rb-painter').classList.contains('active')`));
  await pick('funds');
  h.ok('selecting "funds" paints it bold red', JSON.stringify(await styleOf('funds')) === JSON.stringify({ bold: true, color: RED }), { got: await styleOf('funds') });
  h.ok('…and the painter turns itself off (single click)', !(await h.js(`document.getElementById('rb-painter').classList.contains('active')`)));
  await pick('beyond');
  h.ok('the next selection is NOT painted', !(await styleOf('beyond')).bold);

  // double-click: paint several, across boxes, until Esc
  await pick('budget');
  const pb = await h.rect('#rb-painter');
  await h.dblclick(pb.cx, pb.cy);
  h.ok('double-click keeps Format Painter on', await h.js(`document.getElementById('rb-painter').classList.contains('active')`));
  await pick('discretion');
  await pick('congregational');
  h.ok('paints a first and a second selection', (await styleOf('discretion')).bold && (await styleOf('congregational')).bold);
  // another text box, on another page (page 15, the SCAM ALERT box)
  await h.js(`document.querySelector('.page-shell[data-page="15"] .frame[data-id="f445"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const sel2 = '.page-shell[data-page="15"] .frame-text[data-id="f445"]';
  const w2 = await word('Staff', sel2);
  await h.click(w2.x0 + 2, w2.y);
  await pick('Staff', sel2);
  h.ok('…painting carries on in another text box (page 15)', JSON.stringify(await styleOf('Staff', sel2)) === JSON.stringify({ bold: true, color: RED }), { got: await styleOf('Staff', sel2) });
  await h.key('Escape');
  h.ok('Esc turns Format Painter off', !(await h.js(`document.getElementById('rb-painter').classList.contains('active')`)));
  await h.shot('painted');
  await h.key('Escape', [], 600);
  const saved = await h.js(`(() => { const f = window.__bbEditor.anyFrame(${P}, 'f459'); return f.text.paragraphs.flatMap((p) => p.runs).filter((r) => /funds|discretion/.test(r.text)).map((r) => ({ t: r.text.trim().slice(0, 12), bold: !!r.bold, color: r.color })); })()`);
  h.ok('painted formatting is saved', saved.length >= 2 && saved.every((x) => x.bold && x.color === '#C00000'), { saved });
};
